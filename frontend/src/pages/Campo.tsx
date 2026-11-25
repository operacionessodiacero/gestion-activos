import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { Activo, catalog, ESTADOS_VERIFICACION, isTrue, norm, uuid, VERIFICADOS, CONDICIONES } from '../domain';
import { Field, Modal, PhotoUploader, Select, VerifBadge, useDebounced } from '../components/ui';

const QUICK: [string, string, string][] = [
  ['Existencia confirmada', '✅', '#16a34a'],
  ['Existe, pero presenta información incorrecta', '✏️', '#ca8a04'],
  ['No localizado', '❓', '#dc2626'],
  ['Fuera de servicio', '⛔', '#ea580c'],
  ['Trasladado', '🚚', '#2563eb'],
  ['Desmontado', '🔧', '#7c3aed'],
  ['Posible duplicado', '⧉', '#dc2626'],
  ['Dado de baja (previa aprobación)', '🗑️', '#475569']
];

export function VerifyForm({ a, onClose }: { a: Activo; onClose: () => void }) {
  const { db, run, upsertLocal, toast, can, user } = useApp();
  const [v, setV] = useState({ resultado: '', ubicacion_encontrada: a.ubicacion_fisica || '', estado_fisico: '', estado_operacional: '', codigo_existente: a.codigo || a.codigo_anterior || '', codigo_asignado: '', observaciones: '', pendiente: '' });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState<any>(null);
  const set = (k: string, val: string) => setV(x => ({ ...x, [k]: val }));
  if (!can('VERIFICACIONES')) return <div className="alert warn">Su rol ({user?.rol}) no permite registrar verificaciones.</div>;
  async function save() {
    if (!v.resultado) { toast('Seleccione el resultado de la verificación', 'error'); return; }
    if (v.codigo_asignado && db.ACTIVOS.some(x => x.id !== a.id && String(x.codigo).toUpperCase() === v.codigo_asignado.toUpperCase())) { toast('Ese código ya está asignado a otro activo', 'error'); return; }
    setSaving(true);
    try {
      const payload = { verificacion: { ...v, activo_id: a.id, fecha: new Date().toISOString(), client_uuid: uuid() } };
      const r = await run<any>('verify', payload, `Verificación de ${a.codigo || a.id}: ${v.resultado}`);
      if (r?.activo) { upsertLocal('ACTIVOS', r.activo); upsertLocal('VERIFICACIONES', r.verificacion); toast('Verificación guardada en Google Sheets'); }
      else upsertLocal('ACTIVOS', { ...a, estado_verificacion: v.resultado, _pendiente: true });
      setSaved(r || true);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }
  if (saved) return <div>
    <div className="alert ok">Verificación registrada: <b>{v.resultado}</b>{saved === true ? ' (en cola, se enviará al recuperar la señal)' : ''}.</div>
    <h4>Fotografías de evidencia (opcional)</h4>
    {saved !== true ? <PhotoUploader activoId={a.id} defaultCat="Vista general" refTipo="VERIFICACION" refId={saved.verificacion?.id} compact /> : <p className="muted">Las fotos se pueden cargar cuando haya conexión.</p>}
    <div className="row end"><Link className="btn" to={'/activo/' + a.id}>Abrir ficha</Link><button className="primary" onClick={onClose}>Siguiente activo →</button></div>
  </div>;
  return <div className="form">
    <div className="quick-grid">{QUICK.map(([r, ic, col]) => <button key={r} type="button" className={'qbtn' + (v.resultado === r ? ' sel' : '')} style={{ borderColor: col }} onClick={() => set('resultado', r)}><span>{ic}</span>{r}</button>)}</div>
    <div className="grid-form">
      <Field label="Ubicación encontrada"><input value={v.ubicacion_encontrada} onChange={e => set('ubicacion_encontrada', e.target.value)} /></Field>
      <Field label="Estado físico"><Select value={v.estado_fisico} onChange={x => set('estado_fisico', x)} options={CONDICIONES} /></Field>
      <Field label="Estado operacional"><Select value={v.estado_operacional} onChange={x => set('estado_operacional', x)} options={catalog(db, 'estado_operacional')} /></Field>
      <Field label="Código existente (en placa/marcado)"><input value={v.codigo_existente} onChange={e => set('codigo_existente', e.target.value)} /></Field>
      <Field label="Código asignado (nuevo)" hint="Opcional. Se valida que no esté repetido."><input value={v.codigo_asignado} onChange={e => set('codigo_asignado', e.target.value.toUpperCase())} /></Field>
      <Field label="Observaciones" wide><textarea rows={2} value={v.observaciones} onChange={e => set('observaciones', e.target.value)} /></Field>
      <Field label="Información pendiente" wide><input value={v.pendiente} placeholder="Ej.: falta foto de placa, confirmar potencia…" onChange={e => set('pendiente', e.target.value)} /></Field>
    </div>
    <div className="row end"><button onClick={onClose}>Cancelar</button><button className="primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar verificación'}</button></div>
  </div>;
}

export default function Campo() {
  const { db, idx } = useApp();
  const nav = useNavigate();
  const [area, setArea] = useState(localStorage.getItem('campo_area') || '');
  const [solo, setSolo] = useState<'pend' | 'todos' | 'hechos'>('pend');
  const [q, setQ] = useState(''); const dq = useDebounced(q);
  const [sel, setSel] = useState<Activo | null>(null);
  const areas = [...new Set(db.ACTIVOS.map(a => a.area).filter(Boolean))].sort();
  const list = useMemo(() => {
    const n = norm(dq);
    return db.ACTIVOS.filter(a => !isTrue(a.es_prueba) || area === '__prueba')
      .filter(a => !area || area === '__prueba' || a.area === area)
      .filter(a => solo === 'todos' || (solo === 'pend' ? (!a.estado_verificacion || a.estado_verificacion === 'Pendiente de verificación') : a.estado_verificacion && a.estado_verificacion !== 'Pendiente de verificación'))
      .filter(a => !n || norm(`${a.codigo} ${a.codigo_anterior} ${a.nombre} ${a.ubicacion_fisica}`).includes(n))
      .sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), 'es', { numeric: true }));
  }, [db.ACTIVOS, area, solo, dq]);
  const inArea = db.ACTIVOS.filter(a => !area || a.area === area);
  const done = inArea.filter(a => VERIFICADOS.includes(a.estado_verificacion) || ['No localizado', 'Posible duplicado', 'Dado de baja (previa aprobación)'].includes(a.estado_verificacion)).length;
  return <div className="page">
    <div className="page-h"><h2>Verificación en campo</h2><div className="row"><Link className="btn" to="/escanear">▦ Escanear QR</Link><Link className="btn primary" to="/nuevo?rapido=1">➕ Activo no registrado</Link></div></div>
    <div className="filters">
      <Select value={area} onChange={x => { setArea(x); localStorage.setItem('campo_area', x); }} options={[...areas, ['__prueba', '(Registros de prueba)'] as any]} empty="Recorrido: todas las áreas" />
      <div className="seg">{([['pend', 'Pendientes'], ['hechos', 'Revisados'], ['todos', 'Todos']] as const).map(([k, l]) => <button key={k} className={solo === k ? 'sel' : ''} onClick={() => setSolo(k)}>{l}</button>)}</div>
      <input placeholder="Filtrar…" value={q} onChange={e => setQ(e.target.value)} />
    </div>
    <div className="muted small">Recorrido: {done} de {inArea.length} revisados. Toque un activo para registrar el resultado. No es necesario completar la ficha técnica ahora.</div>
    <div className="vlist">
      {list.map(a => { const p = a.padre_id ? idx.byId.get(a.padre_id) : null; return <div key={a.id} className={'vitem' + (a._pendiente ? ' pend' : '')} onClick={() => setSel(a)}>
        <div><b>{a.codigo || a.id}</b> {a.nombre}<div className="small muted">{a.ubicacion_fisica || a.area}{p ? ' · ' + p.nombre : ''}</div></div>
        <VerifBadge v={a.estado_verificacion} />
      </div>; })}
      {!list.length && <div className="empty">No hay activos en este filtro. 🎉</div>}
    </div>
    {sel && <Modal title={`${sel.codigo || sel.id} · ${sel.nombre}`} onClose={() => setSel(null)}>
      <div className="small muted">{sel.area} · Código anterior: {sel.codigo_anterior || '—'} · Estado actual: {sel.estado_verificacion}</div>
      <VerifyForm a={sel} onClose={() => setSel(null)} />
      <div className="row"><button className="ghost sm" onClick={() => nav('/activo/' + sel.id)}>Ver ficha completa</button></div>
    </Modal>}
  </div>;
}
