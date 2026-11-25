// Capa de acceso a datos: cliente de la API (Apps Script) + cola persistente sin conexión.
// Para migrar a otro backend (p. ej. PostgreSQL + API REST) sólo hay que reemplazar este módulo.
import { get, set, del, keys, createStore } from 'idb-keyval';
import { uuid } from './domain';

export const API_URL: string = import.meta.env.VITE_API_URL || '';
export const CLIENT_ID: string = import.meta.env.VITE_CLIENT_ID || '';

const queueStore = createStore('activos-cola', 'ops');
const mapStore = createStore('activos-map', 'ids');
export const cacheStore = createStore('activos-cache', 'kv');

let token = '';
let onAuthError: (() => void) | null = null;
export function setToken(t: string) { token = t; }
export function getToken() { return token; }
export function setOnAuthError(fn: () => void) { onAuthError = fn; }

export class ApiError extends Error { code: string; constructor(msg: string, code = '') { super(msg); this.code = code; } }

/** Llamada directa (requiere conexión). Se usa text/plain para evitar preflight CORS en Apps Script. */
export async function call<T = any>(action: string, payload: any = {}): Promise<T> {
  if (!API_URL) throw new ApiError('La aplicación no tiene configurada la URL del backend.');
  let res: Response;
  try {
    res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, action, payload }), redirect: 'follow' });
  } catch (e) {
    throw new ApiError('Sin conexión con el servidor.', 'NETWORK');
  }
  let j: any;
  try { j = await res.json(); } catch { throw new ApiError('Respuesta inválida del servidor (' + res.status + ').', 'NETWORK'); }
  if (!j.ok) {
    if (String(j.error).startsWith('AUTH')) { onAuthError?.(); throw new ApiError(j.error, 'AUTH'); }
    throw new ApiError(j.error, j.code);
  }
  return j.data as T;
}

/* --------------------------- Cola sin conexión --------------------------- */

export interface QueuedOp { qid: string; action: string; payload: any; label: string; createdAt: string; status: 'pendiente' | 'error'; error?: string; tempId?: string }

type Listener = (ops: QueuedOp[]) => void;
const listeners = new Set<Listener>();
export function onQueueChange(fn: Listener) { listeners.add(fn); listQueue().then(fn); return () => { listeners.delete(fn); }; }
async function emit() { const ops = await listQueue(); listeners.forEach(l => l(ops)); }

export async function listQueue(): Promise<QueuedOp[]> {
  const ks = await keys(queueStore);
  const ops = await Promise.all(ks.map(k => get(k, queueStore)));
  return (ops.filter(Boolean) as QueuedOp[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Encola una operación. `tempId` permite referenciar registros creados sin conexión ("tmp:<uuid>"). */
export async function enqueue(action: string, payload: any, label: string, tempId?: string): Promise<QueuedOp> {
  const op: QueuedOp = { qid: new Date().toISOString() + '_' + uuid(), action, payload, label, createdAt: new Date().toISOString(), status: 'pendiente', tempId };
  await set(op.qid, op, queueStore); await emit();
  return op;
}
export async function removeOp(qid: string) { await del(qid, queueStore); await emit(); }

async function resolveTemps(obj: any): Promise<any> {
  if (typeof obj === 'string' && obj.startsWith('tmp:')) { const real = await get(obj, mapStore); if (!real) throw new ApiError('Pendiente de sincronizar registro previo', 'DEP'); return real; }
  if (Array.isArray(obj)) return Promise.all(obj.map(resolveTemps));
  if (obj && typeof obj === 'object') { const o: any = {}; for (const k of Object.keys(obj)) o[k] = await resolveTemps(obj[k]); return o; }
  return obj;
}

let flushing = false;
/** Envía la cola en orden. Las operaciones son idempotentes (client_uuid), así que reintentar no duplica. */
export async function flushQueue(onResult?: (op: QueuedOp, data: any) => void): Promise<{ sent: number; failed: number }> {
  if (flushing || !token || !navigator.onLine) return { sent: 0, failed: 0 };
  flushing = true; let sent = 0, failed = 0;
  try {
    for (const op of await listQueue()) {
      try {
        const payload = await resolveTemps(op.payload);
        const data = await call(op.action, payload);
        if (op.tempId) { const id = data?.id || data?.record?.id; if (id) await set(op.tempId, id, mapStore); }
        await del(op.qid, queueStore); sent++;
        onResult?.(op, data);
      } catch (e: any) {
        if (e.code === 'NETWORK' || e.code === 'AUTH') break;
        if (e.code === 'DEP') continue;
        op.status = 'error'; op.error = e.message; await set(op.qid, op, queueStore); failed++;
      }
    }
  } finally { flushing = false; await emit(); }
  return { sent, failed };
}

/** Ejecuta en línea si es posible; si no hay conexión, encola. */
export async function mutate<T = any>(action: string, payload: any, label: string, tempId?: string): Promise<{ data?: T; queued: boolean }> {
  if (navigator.onLine && token) {
    try { return { data: await call<T>(action, payload), queued: false }; }
    catch (e: any) { if (e.code !== 'NETWORK') throw e; }
  }
  await enqueue(action, payload, label, tempId);
  return { queued: true };
}

/* --------------------------- Utilidades de archivos --------------------------- */

/** Reduce imágenes (máx. 1920 px, JPEG 0.85) antes de subirlas. */
export async function fileToBase64(file: File, maxSide = 1920): Promise<{ base64: string; mimeType: string; filename: string }> {
  if (file.type.startsWith('image/') && !file.type.includes('svg')) {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (bmp) {
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.85);
      return { base64: url.split(',')[1], mimeType: 'image/jpeg', filename: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
    }
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), mimeType: file.type || 'application/octet-stream', filename: file.name };
}

/** Miniaturas de Drive a través del backend (los archivos siguen privados). Cacheadas en IndexedDB. */
export async function thumbnail(driveId: string, size = 640): Promise<string> {
  const k = `thumb:${driveId}:${size}`;
  const c = await get(k, cacheStore); if (c) return c;
  const r = await call<{ mimeType: string; base64: string }>('thumbnail', { drive_id: driveId, size });
  const url = `data:${r.mimeType};base64,${r.base64}`;
  await set(k, url, cacheStore).catch(() => {});
  return url;
}
