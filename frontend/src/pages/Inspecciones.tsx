import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { Activo, catalog, CONDICIONES, fmtDate, parseJson, uuid } from '../domain';
import { AssetPicker, CondBadge, Field, PhotoUploader, Select, Empty } from '../components/ui';

interface H { criterio: string; descripcion: string; severidad: string; riesgo_seguridad: boolean; recomendacion: string; necesidad_intervencion: string }

export function InspectionForm({ activo, onDone }: { activo: Activo; onDone: () => void }) {
  const { db, run, toast, upsertLocal } = useApp();
  const criterios = catalog(db, 'criterio_inspeccion');
  const [cr, setCr] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState(''); const [obs, setObs] = useState(''); const [rec, setRec] = useState('');
  const [hs, setHs] = useState<H[]>([]); const [saving, setSaving] = useState(false); const [done, setDone] = useState<any>(null);
  const addH = (criterio = '') => setHs([...hs, { criterio, descripcion: '', severidad: 'Media', riesgo_seguridad: criterio === 'Riesgos de seguridad' || criterio === 'Ausencia de protecciones', recomendacion: '', necesidad_intervencion: '' }]);
  const setH = (i: number, k: keyof H, v: any) => setHs(hs.map((h, j) => j === i ? { ...h, [k]: v } : h));
  async function submit() {
    if (!general) { toast('Indique la condición general', 'error'); return; }
    if (hs.some(h => !h.descripcion)) { toast('Describa cada hallazgo', 'error'); return; }
    setSaving(true);
    try {
      const r = await run<any>('saveInspection', { inspeccion: { activo_id: activo.id, criterios: JSON.stringify(cr), condicion_general: general, observaciones: obs, recomendaciones: rec, client_uuid: uuid() }, hallazgos: hs.map(h => ({ ...h, client_uuid: uuid() })) }, `Inspección de ${activo.codigo || activo.id}`);
      if (r) { upsertLocal('INSPECCIONES', r.inspeccion); r.hallazgos.forEach((h: any) => upsertLocal('HALLAZGOS', h)); upsertLocal('ACTIVOS', { ...activo, condicion: general }); }
      if (hs.some(h => h.riesgo_seguridad)) toast('⚠️ Hallazgo con RIESGO DE SEGURIDAD registrado: requiere revisión inmediata por personal competente.', 'error');
      else toast('Inspección guardada');
      setDone(r || true);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }
  if (done) return <div><div className="alert ok">Inspección registrada.</div>
    {done !== true && <><h4>Fotografías de hallazgos</h4><PhotoUploader activoId={activo.id} defaultCat="Hallazgos" refTipo="INSPECCION" refId={done.inspeccion.id} /></>}
    <div className="row end"><button className="primary" onClick={onDone}>Terminar</button></div></div>;
  return <div className="form">
    <p className="small muted">La condición física es independiente de la criticidad. Califique solo lo observado; deje «No evaluada» lo que no pudo revisar.</p>
    <div className="insp-grid">{criterios.map(c => <div key={c} className="insp-c"><span>{c}</span>
      <Select value={cr[c] || ''} onChange={v => setCr({ ...cr, [c]: v })} options={CONDICIONES} empty="No evaluada" />
      {['Mala', 'Crítica', 'Regular'].includes(cr[c]) && !hs.some(h => h.criterio === c) && <button className="sm" onClick={() => addH(c)}>+ hallazgo</button>}</div>)}</div>
    <div className="grid-form">
      <Field label="Condición general *"><Select value={general} onChange={setGeneral} options={CONDICIONES} /></Field>
      <Field label="Observaciones" wide><textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} /></Field>
      <Field label="Recomendaciones" wide><textarea rows={2} value={rec} onChange={e => setRec(e.target.value)} /></Field>
    </div>
    <h4>Hallazgos ({hs.length}) <button className="sm" onClick={() => addH()}>+ Agregar</button></h4>
    {hs.map((h, i) => <div key={i} className={'hall' + (h.riesgo_seguridad ? ' danger' : '')}>
      <div className="grid-form">
        <Field label="Criterio"><Select value={h.criterio} onChange={v => setH(i, 'criterio', v)} options={criterios} /></Field>
        <Field label="Severidad"><Select value={h.severidad} onChange={v => setH(i, 'severidad', v)} options={catalog(db, 'severidad_hallazgo')} empty={false} /></Field>
        <Field label="Descripción *" wide><input value={h.descripcion} onChange={e => setH(i, 'descripcion', e.target.value)} /></Field>
        <Field label="Recomendación" wide><input value={h.recomendacion} onChange={e => setH(i, 'recomendacion', e.target.value)} /></Field>
        <Field label="Necesidad de intervención"><input value={h.necesidad_intervencion} onChange={e => setH(i, 'necesidad_intervencion', e.target.value)} /></Field>
        <label className="chk"><input type="checkbox" checked={h.riesgo_seguridad} onChange={e => setH(i, 'riesgo_seguridad', e.target.checked)} /> ⚠️ Representa riesgo grave de seguridad</label>
      </div><button className="ghost sm" onClick={() => setHs(hs.filter((_, j) => j !== i))}>Quitar</button></div>)}
    <div className="row end"><button className="primary" disabled={saving} onClick={submit}>{saving ? 'Guardando…' : 'Guardar inspección'}</button></div>
  </div>;
}

export default function Inspecciones() {
  const { db, idx, can } = useApp(); const [sel, setSel] = useState('');
  const a = sel ? idx.byId.get(sel) : null;
  const list = [...db.INSPECCIONES].sort((x, y) => String(y.fecha).localeCompare(String(x.fecha))).slice(0, 200);
  return <div className="page"><div className="page-h"><h2>Inspección y diagnóstico de condición</h2></div>
    {can('INSPECCIONES') && <section className="panel"><h3>Nueva inspección</h3><AssetPicker value={sel} onChange={setSel} placeholder="Seleccione el activo o componente a inspeccionar…" />
      {a && <InspectionForm key={a.id} activo={a} onDone={() => setSel('')} />}</section>}
    <section className="panel"><h3>Inspecciones recientes ({db.INSPECCIONES.length})</h3>
      {list.length ? <table className="tbl"><thead><tr><th>Fecha</th><th>Activo</th><th>Condición</th><th>Inspector</th><th>Hallazgos</th></tr></thead><tbody>{list.map(i => { const x = idx.byId.get(i.activo_id); return <tr key={i.id}>
        <td>{fmtDate(i.fecha)}</td><td><Link to={`/activo/${i.activo_id}/inspecciones`}>{x?.codigo || i.activo_id} {x?.nombre}</Link></td><td><CondBadge v={i.condicion_general} /></td><td>{i.usuario}</td><td className="num">{db.HALLAZGOS.filter(h => h.inspeccion_id === i.id).length}</td></tr>; })}</tbody></table> : <Empty>Sin inspecciones.</Empty>}
    </section></div>;
}
