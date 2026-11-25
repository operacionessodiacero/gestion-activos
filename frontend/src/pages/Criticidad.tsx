import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { Activo, computeCriticality, critColor, isTrue, parseJson, uuid, fmtDate } from '../domain';
import { AssetPicker, Badge, CritBadge, Field, Select } from '../components/ui';
import { exportCriticidad } from '../exporter';

export function CriticalityForm({ activo }: { activo: Activo }) {
  const { db, run, toast, can, cfg, reload } = useApp();
  const crit = [...db.CRITERIOS_CRITICIDAD].sort((a, b) => Number(a.orden) - Number(b.orden));
  const vig = db.CRITICIDAD.find(c => c.activo_id === activo.id && isTrue(c.vigente));
  const [p, setP] = useState<Record<string, any>>(() => parseJson(vig?.puntajes, {}));
  const [just, setJust] = useState(''); const [ev, setEv] = useState(''); const [rev, setRev] = useState(''); const [saving, setSaving] = useState(false);
  const calc = useMemo(() => computeCriticality(crit, p, cfg), [crit, p, cfg]);
  const ro = !can('CRITICIDAD');
  async function submit() {
    if (!just) { toast('La justificación técnica es obligatoria', 'error'); return; }
    setSaving(true);
    try { const r = await run('saveCriticality', { activo_id: activo.id, puntajes: p, justificacion: just, evidencia: ev, fecha_revision: rev, client_uuid: uuid() }, `Criticidad de ${activo.codigo || activo.id}`); if (r) { await reload(); toast('Evaluación de criticidad guardada'); setJust(''); } }
    catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }
  return <div className="form">
    <div className="crit-result" style={{ borderColor: critColor(calc.resultado) }}>
      <div><small>Resultado {ro ? 'vigente' : 'calculado'}</small><div className="big" style={{ color: critColor(calc.resultado) }}>{calc.resultado}</div>{calc.provisional && <small>Provisional (información incompleta)</small>}</div>
      <div><small>Índice consecuencia</small><div className="big">{calc.ic ?? '—'}</div></div>
      <div><small>Índice probabilidad</small><div className="big">{calc.ip ?? '—'}</div></div>
      <div><small>Puntaje IC×IP</small><div className="big">{calc.total ?? '—'}</div></div>
      {calc.regla && <div className="wide small">Regla aplicada: {calc.regla}</div>}
    </div>
    <p className="small muted">Metodología {cfg('metodologia_criticidad', 'MC-1.0')}. Califique 1 a 5 según la escala. Use «Desconocido» cuando no haya información: no se asume como valor bajo. Seguridad o ambiente en 5 ⇒ Muy alta; en 4 ⇒ mínimo Alta, sin importar el promedio.</p>
    <div className="crit-grid">{crit.map(c => { const esc = String(c.escala || '').split('|'); return <div key={c.id} className="crit-c">
      <div><b>{c.nombre}</b> <small className="muted">({c.grupo === 'PROBABILIDAD' ? 'probabilidad' : 'consecuencia'} · peso {c.peso}{c.regla_especial ? ' · regla especial' : ''})</small></div>
      <div className="seg wrap">{[1, 2, 3, 4, 5].map(n => <button key={n} disabled={ro} className={Number(p[c.id]) === n ? 'sel' : ''} title={esc[n - 1]} onClick={() => setP({ ...p, [c.id]: n })}>{n}</button>)}
        <button disabled={ro} className={p[c.id] === undefined || p[c.id] === 'ND' || p[c.id] === '' ? 'sel' : ''} onClick={() => setP({ ...p, [c.id]: 'ND' })}>Desconocido</button></div>
      <small className="muted">{p[c.id] && p[c.id] !== 'ND' ? esc[Number(p[c.id]) - 1] : ''}</small></div>; })}</div>
    {!ro && <div className="grid-form">
      <Field label="Justificación técnica *" wide><textarea rows={3} value={just} onChange={e => setJust(e.target.value)} /></Field>
      <Field label="Evidencia / fuentes" wide><input value={ev} onChange={e => setEv(e.target.value)} placeholder="Ej.: entrevista a operadores, historial de paradas 2025…" /></Field>
      <Field label="Fecha de revisión"><input type="date" value={rev} onChange={e => setRev(e.target.value)} /></Field>
      <label className="chk"><input type="checkbox" checked={!!p._preliminar} onChange={e => setP({ ...p, _preliminar: e.target.checked })} /> Evaluación preliminar (sin historial de fallas)</label>
      <div className="row end wide"><button className="primary" disabled={saving} onClick={submit}>{saving ? 'Guardando…' : 'Guardar evaluación'}</button></div></div>}
    {vig && <p className="small muted">Vigente desde {fmtDate(vig.fecha)} por {vig.evaluador}. Las reevaluaciones conservan el historial.</p>}
  </div>;
}

export default function Criticidad() {
  const { db, idx, toast } = useApp(); const [sel, setSel] = useState(''); const [f, setF] = useState('');
  const a = sel ? idx.byId.get(sel) : null;
  const evals = db.CRITICIDAD.filter(c => isTrue(c.vigente));
  // Matriz 5×5 (consecuencia vs probabilidad)
  const cell = (ic: number, ip: number) => evals.filter(e => Math.round(Number(e.indice_consecuencia)) === ic && Math.round(Number(e.indice_probabilidad)) === ip);
  const lista = db.ACTIVOS.filter(x => !isTrue(x.es_prueba) && (!f || (x.criticidad || 'Pendiente de evaluación') === f)).sort((x, y) => ['Muy alta', 'Alta', 'Media', 'Baja'].indexOf(x.criticidad) - ['Muy alta', 'Alta', 'Media', 'Baja'].indexOf(y.criticidad));
  return <div className="page"><div className="page-h"><h2>Análisis de criticidad</h2><button onClick={() => exportCriticidad(db, idx).catch(e => toast(e.message, 'error'))}>⬇️ Matriz en Excel</button></div>
    <div className="grid2">
      <section className="panel"><h3>Evaluar activo</h3><AssetPicker value={sel} onChange={setSel} />{a && <CriticalityForm key={a.id} activo={a} />}</section>
      <section className="panel"><h3>Matriz de riesgo (evaluaciones vigentes: {evals.length})</h3>
        <div className="matrix"><div className="mx-y">Consecuencia →</div>
          {[5, 4, 3, 2, 1].map(ic => <div key={ic} className="mx-row"><span className="mx-l">{ic}</span>{[1, 2, 3, 4, 5].map(ip => { const s = ic * ip; const n = cell(ic, ip); return <div key={ip} className="mx-c" style={{ background: critColor(s >= 16 ? 'Muy alta' : s >= 10 ? 'Alta' : s >= 5 ? 'Media' : 'Baja') + (n.length ? 'cc' : '44') }} title={n.map(e => idx.byId.get(e.activo_id)?.nombre).join(', ')}>{n.length || ''}</div>; })}</div>)}
          <div className="mx-row"><span className="mx-l" />{[1, 2, 3, 4, 5].map(i => <span key={i} className="mx-l">{i}</span>)}</div><div className="mx-x">Probabilidad →</div></div>
        <h3>Activos por criticidad</h3>
        <Select value={f} onChange={setF} options={['Muy alta', 'Alta', 'Media', 'Baja', 'Pendiente de evaluación']} empty="Todas" />
        <table className="tbl small"><tbody>{lista.slice(0, 150).map(x => <tr key={x.id}><td><Link to={`/activo/${x.id}/criticidad`}>{x.codigo || x.id} {x.nombre}</Link></td><td>{x.nivel}</td><td><CritBadge v={x.criticidad || 'Pendiente de evaluación'} /></td></tr>)}</tbody></table>
      </section></div></div>;
}
