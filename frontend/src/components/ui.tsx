import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../store';
import { Activo, critColor, condColor, verifColor, norm, uuid, catalog } from '../domain';
import { thumbnail, fileToBase64 } from '../api';

export const Badge = ({ text, color }: { text: string; color?: string }) =>
  text ? <span className="badge" style={{ background: (color || '#64748b') + '22', color: color || '#94a3b8', borderColor: (color || '#64748b') + '66' }}>{text}</span> : null;
export const VerifBadge = ({ v }: { v: string }) => <Badge text={v || 'Pendiente de verificación'} color={verifColor(v || 'Pendiente de verificación')} />;
export const CritBadge = ({ v }: { v: string }) => v ? <Badge text={'Crit. ' + v} color={critColor(v)} /> : null;
export const CondBadge = ({ v }: { v: string }) => v && v !== 'No evaluada' ? <Badge text={v} color={condColor(v)} /> : null;

export function Field({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return <label className={'field' + (wide ? ' wide' : '')}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Select({ value, onChange, options, empty = '— Seleccione —', disabled }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[]; empty?: string | false; disabled?: boolean }) {
  return <select value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
    {empty !== false && <option value="">{empty}</option>}
    {options.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
    {value && !options.some(o => (Array.isArray(o) ? o[0] : o) === value) && <option value={value}>{value}</option>}
  </select>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  return <div className="modal-bg" onClick={onClose}><div className={'modal' + (wide ? ' wide' : '')} onClick={e => e.stopPropagation()}>
    <div className="modal-h"><h3>{title}</h3><button className="ghost" onClick={onClose} aria-label="Cerrar">✕</button></div>
    <div className="modal-b">{children}</div></div></div>;
}

export function Progress({ pct }: { pct: number }) {
  const c = pct >= 80 ? '#16a34a' : pct >= 40 ? '#ca8a04' : '#dc2626';
  return <div className="progress" title={pct + '%'}><div style={{ width: pct + '%', background: c }} /><span>{pct}%</span></div>;
}

export function Thumb({ driveId, size = 320, className, onClick }: { driveId: string; size?: number; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState(''); const [err, setErr] = useState(false);
  useEffect(() => { let ok = true; if (driveId) thumbnail(driveId, size).then(s => ok && setSrc(s)).catch(() => ok && setErr(true)); return () => { ok = false; }; }, [driveId, size]);
  if (err) return <div className={'thumb ph ' + (className || '')}>sin vista</div>;
  return src ? <img src={src} className={'thumb ' + (className || '')} onClick={onClick} alt="" /> : <div className={'thumb ph ' + (className || '')}>…</div>;
}

export function QR({ text, size = 160 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' }).then(setSrc); }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="QR" /> : null;
}
export const assetUrl = (id: string) => `${location.origin}${location.pathname}#/activo/${encodeURIComponent(id)}`;

/** Selector de activo con búsqueda. */
export function AssetPicker({ value, onChange, exclude, placeholder = 'Buscar activo…', allowEmpty = true }: { value: string; onChange: (id: string) => void; exclude?: (a: Activo) => boolean; placeholder?: string; allowEmpty?: boolean }) {
  const { db, idx } = useApp(); const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const sel = value ? idx.byId.get(value) : null;
  const list = useMemo(() => {
    const n = norm(q);
    return db.ACTIVOS.filter(a => (!exclude || !exclude(a)) && (!n || norm(`${a.id} ${a.codigo} ${a.codigo_anterior} ${a.nombre} ${a.area}`).includes(n))).slice(0, 40);
  }, [db.ACTIVOS, q, exclude]);
  return <div className="picker">
    {sel && !open ? <div className="picker-sel"><span><b>{sel.codigo || sel.id}</b> {sel.nombre}</span>
      <button type="button" className="ghost sm" onClick={() => setOpen(true)}>Cambiar</button>
      {allowEmpty && <button type="button" className="ghost sm" onClick={() => onChange('')}>Quitar</button>}</div>
      : <><input autoFocus={open} value={q} placeholder={placeholder} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
        {open && <div className="picker-list">{list.map(a => <div key={a.id} className="picker-item" onClick={() => { onChange(a.id); setOpen(false); setQ(''); }}>
          <b>{a.codigo || a.id}</b> {a.nombre} <small>{a.area}</small></div>)}{!list.length && <div className="muted pad">Sin resultados</div>}</div>}</>}
  </div>;
}

/** Captura de fotografías (cámara del celular o archivo) con categoría, subida a Drive. */
export function PhotoUploader({ activoId, defaultCat = 'Vista general', kind = 'FOTO', refTipo, refId, onDone, compact }: { activoId: string; defaultCat?: string; kind?: 'FOTO' | 'DOCUMENTO'; refTipo?: string; refId?: string; onDone?: (r: any) => void; compact?: boolean }) {
  const { db, run, can, toast, upsertLocal } = useApp();
  const [cat, setCat] = useState(defaultCat); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(0);
  const camRef = useRef<HTMLInputElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const cats = kind === 'FOTO' ? catalog(db, 'categoria_foto') : catalog(db, 'tipo_documento');
  if (!can(kind === 'FOTO' ? 'FOTOGRAFIAS' : 'DOCUMENTOS')) return null;
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      setBusy(b => b + 1);
      try {
        const b = await fileToBase64(f);
        const cu = uuid();
        const r = await run<any>('uploadFile', { activo_id: activoId, kind: kind === 'FOTO' ? 'FOTO' : 'DOCUMENTO', categoria: cat, descripcion: desc, ref_tipo: refTipo || '', ref_id: refId || '', client_uuid: cu, ...b }, `${kind === 'FOTO' ? 'Foto' : 'Documento'} (${cat}) de ${activoId}`);
        if (r) { upsertLocal(kind === 'FOTO' ? 'FOTOGRAFIAS' : 'DOCUMENTOS', r); toast(`Archivo guardado en Drive: ${r.nombre_archivo}`); onDone?.(r); }
      } catch (e: any) { toast(e.message, 'error'); }
      finally { setBusy(b => b - 1); }
    }
    setDesc('');
  }
  return <div className={'uploader' + (compact ? ' compact' : '')}>
    <div className="row">
      <Select value={cat} onChange={setCat} options={cats} empty={false} />
      {!compact && <input placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} />}
    </div>
    <div className="row">
      {kind === 'FOTO' && <button type="button" className="primary" onClick={() => camRef.current?.click()} disabled={!!busy}>📷 Tomar foto</button>}
      <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}>📁 {kind === 'FOTO' ? 'Cargar imagen' : 'Adjuntar archivo'}</button>
      {!!busy && <span className="muted">Subiendo {busy}…</span>}
    </div>
    <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
    <input ref={fileRef} type="file" accept={kind === 'FOTO' ? 'image/*' : '*/*'} multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
  </div>;
}

export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }

export function useDebounced<T>(v: T, ms = 250) { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }
