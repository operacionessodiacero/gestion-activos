// Estado global: sesión, datos (copia en memoria de las hojas), cola de sincronización y avisos.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import * as api from './api';
import { DB, emptyDB, buildIndex, Index, pkOf, uuid, Row, config } from './domain';

export interface User { email: string; nombre: string; rol: string; foto?: string }
interface Toast { id: string; kind: 'ok' | 'error' | 'info' | 'warn'; text: string }

interface Ctx {
  user: User | null; db: DB; idx: Index; loading: boolean; online: boolean; queue: api.QueuedOp[];
  lastSync: string; reload: () => Promise<void>; signOut: () => void; signIn: (credential: string) => Promise<void>;
  can: (table: string) => boolean; isAdmin: boolean; cfg: (k: string, d?: string) => string;
  toast: (text: string, kind?: Toast['kind']) => void; toasts: Toast[];
  /** Guardado genérico (crear/actualizar). Devuelve el registro (o uno provisional si quedó en cola). */
  save: (table: string, record: Row, opts?: { label?: string; version?: number }) => Promise<Row>;
  run: <T = any>(action: string, payload: any, label: string, opts?: { tempId?: string; applyLocal?: (db: DB) => void }) => Promise<T | undefined>;
  upsertLocal: (table: string, rec: Row) => void;
  sync: () => Promise<void>;
}

const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

const WRITE: Record<string, string[] | '*'> = {
  ADMINISTRADOR: '*',
  INGENIERO: ['ACTIVOS', 'JERARQUIA', 'RELACIONES', 'DATOS_TECNICOS', 'VERIFICACIONES', 'INSPECCIONES', 'HALLAZGOS', 'CRITICIDAD', 'FOTOGRAFIAS', 'DOCUMENTOS', 'REPUESTOS', 'ACTIVOS_REPUESTOS', 'MANTENIMIENTO_BASE', 'TIPOS_ACTIVOS', 'CAMPOS_TECNICOS'],
  INSPECTOR: ['ACTIVOS', 'JERARQUIA', 'RELACIONES', 'DATOS_TECNICOS', 'VERIFICACIONES', 'INSPECCIONES', 'HALLAZGOS', 'FOTOGRAFIAS', 'DOCUMENTOS', 'ACTIVOS_REPUESTOS', 'REPUESTOS'],
  CONSULTA: []
};

function decodeJwt(t: string): any { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return {}; } }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [db, setDb] = useState<DB>(emptyDB());
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<api.QueuedOp[]>([]);
  const [lastSync, setLastSync] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef(db); dbRef.current = db;

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const t = { id: uuid(), kind, text }; setToasts(x => [...x, t]);
    setTimeout(() => setToasts(x => x.filter(y => y.id !== t.id)), kind === 'error' ? 8000 : 3500);
  }, []);

  const persist = (d: DB) => set('db', d, api.cacheStore).catch(() => {});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.call<DB>('bootstrap');
      const full = { ...emptyDB(), ...d };
      setDb(full); persist(full); setLastSync(new Date().toISOString());
    } catch (e: any) {
      if (e.code === 'NETWORK') { const c = await get('db', api.cacheStore); if (c) { setDb(c); toast('Sin conexión: mostrando la última copia descargada.', 'warn'); } }
      else toast(e.message, 'error');
    } finally { setLoading(false); }
  }, [toast]);

  const signIn = useCallback(async (credential: string) => {
    api.setToken(credential);
    const p = decodeJwt(credential);
    localStorage.setItem('ga_token', credential);
    try {
      const me = await api.call<User>('me');
      setUser(me); localStorage.setItem('ga_user', JSON.stringify(me));
    } catch (e: any) {
      if (e.code === 'NETWORK') {
        const cached = localStorage.getItem('ga_user');
        if (cached && JSON.parse(cached).email === String(p.email).toLowerCase()) { setUser(JSON.parse(cached)); toast('Modo sin conexión', 'warn'); }
        else throw e;
      } else { localStorage.removeItem('ga_token'); throw e; }
    }
  }, [toast]);

  const signOut = useCallback(() => {
    localStorage.removeItem('ga_token'); api.setToken(''); setUser(null);
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  // sesión guardada (el ID token dura ~1 h)
  useEffect(() => {
    const t = localStorage.getItem('ga_token');
    if (t) { const p = decodeJwt(t); if (p.exp * 1000 > Date.now() + 60000) signIn(t).catch(() => {}); }
    api.setOnAuthError(() => { localStorage.removeItem('ga_token'); setUser(u => u ? { ...u, _expired: true } as any : u); });
  }, [signIn]);

  useEffect(() => { if (user && !(user as any)._expired) reload(); }, [user?.email]); // eslint-disable-line

  useEffect(() => {
    const on = () => { setOnline(true); sync(); }; const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const un = api.onQueueChange(setQueue);
    const iv = setInterval(() => { if (navigator.onLine) sync(); }, 60000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); un(); clearInterval(iv); };
  }, []); // eslint-disable-line

  const upsertLocal = useCallback((table: string, rec: Row) => {
    if (!rec) return;
    setDb(prev => {
      const pk = pkOf(table); const rows = [...((prev as any)[table] || [])];
      const i = rows.findIndex((r: Row) => r[pk] === rec[pk] || (rec.client_uuid && r.client_uuid === rec.client_uuid));
      if (rec.eliminado === true || rec.eliminado === 'true') { if (i >= 0) rows.splice(i, 1); }
      else if (i >= 0) rows[i] = { ...rows[i], ...rec, _pendiente: rec._pendiente || false }; else rows.push(rec);
      const next = { ...prev, [table]: rows }; persist(next); return next;
    });
  }, []);

  const sync = useCallback(async () => {
    const r = await api.flushQueue();
    if (r.sent) { toast(`${r.sent} registro(s) sincronizados con Google Sheets/Drive`); await reload(); }
    if (r.failed) toast(`${r.failed} registro(s) no se pudieron sincronizar. Revise la cola.`, 'error');
  }, [reload, toast]);

  const can = useCallback((table: string) => { if (!user) return false; const w = WRITE[user.rol]; return w === '*' || (Array.isArray(w) && w.includes(table)); }, [user]);

  const save = useCallback(async (table: string, record: Row, opts: { label?: string; version?: number } = {}) => {
    const pk = pkOf(table);
    const isNew = !record[pk];
    const rec = { ...record };
    if (isNew && !rec.client_uuid && table !== 'USUARIOS' && table !== 'CONFIGURACION') rec.client_uuid = uuid();
    const tempId = isNew && pk === 'id' ? 'tmp:' + rec.client_uuid : undefined;
    const r = await api.mutate<Row>('save', { table, record: rec, version: opts.version }, opts.label || `Guardar en ${table}`, tempId);
    if (r.queued) {
      const local = { ...rec, [pk]: rec[pk] || tempId, _pendiente: true };
      upsertLocal(table, local); toast('Sin conexión: guardado en la cola local. Se enviará al recuperar la señal.', 'warn');
      return local;
    }
    upsertLocal(table, r.data!); return r.data!;
  }, [toast, upsertLocal]);

  const run = useCallback(async <T,>(action: string, payload: any, label: string, opts: { tempId?: string; applyLocal?: (db: DB) => void } = {}) => {
    const r = await api.mutate<T>(action, payload, label, opts.tempId);
    if (r.queued) toast('Sin conexión: guardado en la cola local.', 'warn');
    return r.data;
  }, [toast]);

  const idx = useMemo(() => buildIndex(db), [db]);
  const cfg = useCallback((k: string, d = '') => config(db, k, d), [db]);

  const value: Ctx = { user, db, idx, loading, online, queue, lastSync, reload, signOut, signIn, can, isAdmin: user?.rol === 'ADMINISTRADOR', cfg, toast, toasts, save, run, upsertLocal, sync };
  return <C.Provider value={value}>{children}</C.Provider>;
}
