import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { Activo, camposAplicables, completitud, FUENTES_INFO, isTrue, norm, Row, parseJson } from '../domain';
import { Field, Modal, Progress, Select, Empty } from '../components/ui';

const GRUPO_LABEL: Record<string, string> = { GENERAL: 'General', MECANICA: 'Características mecánicas', ELECTRICA: 'Características eléctricas', HIDRAULICA: 'Hidráulicas', NEUMATICA: 'Neumáticas', TERMICA: 'Térmicas / combustión', METROLOGIA: 'Metrología', OPERACIONAL: 'Características operacionales' };

interface V { valor: string; unidad: string; fuente: string; no_aplica: boolean; justificacion: string }

export function TechForm({ activo }: { activo: Activo }) {
  const { db, run, toast, can, reload, save } = useApp();
  const campos = camposAplicables(db, activo.tipo_id);
  const existentes = db.DATOS_TECNICOS.filter(d => d.activo_id === activo.id);
  const [vals, setVals] = useState<Record<string, V>>(() => Object.fromEntries(existentes.map(d => [d.campo_id, { valor: String(d.valor ?? ''), unidad: d.unidad, fuente: d.fuente || 'Verificada', no_aplica: isTrue(d.no_aplica), justificacion: d.justificacion || '' }])));
  const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState(false);
  const [fuenteDef, setFuenteDef] = useState('Verificada');
  const ro = !can('DATOS_TECNICOS');
  const set = (id: string, k: keyof V, v: any) => { setDirty(true); setVals(x => ({ ...x, [id]: { ...{ valor: '', unidad: '', fuente: fuenteDef, no_aplica: false, justificacion: '' }, ...x[id], [k]: v } })); };
  const grupos = useMemo(() => { const m = new Map<string, Row[]>(); campos.forEach(c => { if (!m.has(c.grupo)) m.set(c.grupo, []); m.get(c.grupo)!.push(c); }); return [...m.entries()]; }, [campos]);
  const extra = existentes.filter(d => !campos.some(c => c.id === d.campo_id));

  if (!activo.tipo_id) return <div className="alert warn">Asigne primero el <b>tipo de activo</b> (Editar) para mostrar la ficha técnica correspondiente a su familia tecnológica.</div>;

  async function submit() {
    for (const [id, v] of Object.entries(vals)) if (v.no_aplica && !v.justificacion) { toast('Indique la justificación de los campos marcados como «No aplica»', 'error'); return; }
    setSaving(true);
    try {
      const valores = Object.entries(vals).map(([campo_id, v]) => ({ campo_id, ...v }));
      const et = { ...parseJson<Record<string, boolean>>(activo.etapas, {}), caracterizacion: true };
      const r = await run<any[]>('saveTechData', { activo_id: activo.id, valores, etapas: et }, `Ficha técnica de ${activo.codigo || activo.id}`);
      if (r) { await reload(); toast(`Ficha técnica guardada (${r.length} valores)`); }
      setDirty(false);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }
  const tipo = db.TIPOS_ACTIVOS.find(t => t.id === activo.tipo_id);
  return <div className="techform">
    <div className="row wrap"><span className="muted">Familia: <b>{tipo?.nombre}</b> · {campos.length} campos aplicables</span>
      {!ro && <Field label="Origen por defecto de la información"><Select value={fuenteDef} onChange={setFuenteDef} options={FUENTES_INFO} empty={false} /></Field>}</div>
    {grupos.map(([g, cs]) => <fieldset key={g}><legend>{GRUPO_LABEL[g] || g}</legend>
      {cs.map(c => { const v = vals[c.id] || { valor: '', unidad: c.unidad, fuente: fuenteDef, no_aplica: false, justificacion: '' }; return <div key={c.id} className={'tf-row' + (v.no_aplica ? ' na' : '') + (!v.valor && !v.no_aplica ? ' empty' : '')}>
        <label className="tf-l">{c.etiqueta}{c.unidad && <small> ({c.unidad})</small>}</label>
        {v.no_aplica ? <input placeholder="Justificación de No aplica *" value={v.justificacion} onChange={e => set(c.id, 'justificacion', e.target.value)} disabled={ro} />
          : c.tipo_dato === 'lista' ? <Select value={v.valor} onChange={x => set(c.id, 'valor', x)} options={String(c.opciones).split(',').map(s => s.trim())} empty="Pendiente" disabled={ro} />
          : c.tipo_dato === 'textarea' ? <textarea rows={2} value={v.valor} onChange={e => set(c.id, 'valor', e.target.value)} disabled={ro} placeholder="Pendiente de identificación" />
          : <input type={c.tipo_dato === 'numero' ? 'text' : c.tipo_dato === 'fecha' ? 'date' : 'text'} inputMode={c.tipo_dato === 'numero' ? 'decimal' : undefined} value={v.valor} onChange={e => set(c.id, 'valor', e.target.value)} disabled={ro} placeholder="Pendiente" />}
        <Select value={v.fuente} onChange={x => set(c.id, 'fuente', x)} options={FUENTES_INFO} empty={false} disabled={ro} />
        <label className="chk sm" title="Marcar como no aplicable (se excluye del % de completitud)"><input type="checkbox" checked={v.no_aplica} onChange={e => set(c.id, 'no_aplica', e.target.checked)} disabled={ro} />N/A</label>
      </div>; })}
    </fieldset>)}
    {extra.length > 0 && <fieldset><legend>Otros datos registrados</legend>{extra.map(d => <div key={d.id} className="tf-row"><label className="tf-l">{db.CAMPOS_TECNICOS.find(c => c.id === d.campo_id)?.etiqueta || d.campo_id}</label><span>{d.valor} {d.unidad}</span><span className="small">{d.fuente}</span></div>)}</fieldset>}
    {!ro && <div className="row end sticky-actions">
      {can('CAMPOS_TECNICOS') && <button onClick={() => setNewField(true)}>➕ Campo personalizado</button>}
      <button className="primary" disabled={!dirty || saving} onClick={submit}>{saving ? 'Guardando…' : '💾 Guardar ficha técnica'}</button></div>}
    {newField && <Modal title="Nuevo campo técnico personalizado" onClose={() => setNewField(false)}><CustomField familia={tipo?.familia} grupos={String(tipo?.grupos_campos || '').split(',')} onDone={() => setNewField(false)} /></Modal>}
  </div>;
}

export function CustomField({ familia, grupos, onDone }: { familia?: string; grupos: string[]; onDone: () => void }) {
  const { save, toast } = useApp();
  const [f, setF] = useState<Row>({ grupo: grupos[0] || 'GENERAL', etiqueta: '', tipo_dato: 'texto', unidad: '', opciones: '', familias: familia || '*', orden: 999 });
  return <div className="form grid-form">
    <Field label="Etiqueta *"><input value={f.etiqueta} onChange={e => setF({ ...f, etiqueta: e.target.value })} /></Field>
    <Field label="Grupo"><Select value={f.grupo} onChange={v => setF({ ...f, grupo: v })} options={['GENERAL', 'MECANICA', 'ELECTRICA', 'HIDRAULICA', 'NEUMATICA', 'TERMICA', 'METROLOGIA', 'OPERACIONAL']} empty={false} /></Field>
    <Field label="Tipo de dato"><Select value={f.tipo_dato} onChange={v => setF({ ...f, tipo_dato: v })} options={['texto', 'numero', 'lista', 'fecha', 'textarea']} empty={false} /></Field>
    <Field label="Unidad de medida"><input value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} /></Field>
    <Field label="Opciones (si es lista, separadas por coma)" wide><input value={f.opciones} onChange={e => setF({ ...f, opciones: e.target.value })} /></Field>
    <Field label="Familias (* = todas las del grupo)" wide><input value={f.familias} onChange={e => setF({ ...f, familias: e.target.value })} /></Field>
    <div className="row end wide"><button className="primary" onClick={async () => { if (!f.etiqueta) return; try { await save('CAMPOS_TECNICOS', f); toast('Campo creado'); onDone(); } catch (e: any) { toast(e.message, 'error'); } }}>Crear campo</button></div>
  </div>;
}

export default function Fichas() {
  const { db, idx } = useApp(); const [q, setQ] = useState(''); const [tipo, setTipo] = useState('');
  const rows = db.ACTIVOS.filter(a => !isTrue(a.es_prueba) && (!tipo || a.tipo_id === tipo) && (!q || norm(`${a.codigo} ${a.nombre}`).includes(norm(q))))
    .map(a => ({ a, c: completitud(db, a, idx) })).sort((x, y) => x.c.pct - y.c.pct).slice(0, 200);
  const sinTipo = db.ACTIVOS.filter(a => !a.tipo_id).length;
  return <div className="page"><div className="page-h"><h2>Fichas técnicas</h2></div>
    <p className="muted small">Formularios dinámicos según la familia tecnológica del activo. Los campos y familias se configuran en Configuración, sin modificar el código.</p>
    {sinTipo > 0 && <div className="alert warn">{sinTipo} activo(s) no tienen tipo asignado; su ficha técnica no puede mostrarse hasta clasificarlos.</div>}
    <div className="filters"><input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} /><Select value={tipo} onChange={setTipo} options={db.TIPOS_ACTIVOS.map(t => [t.id, t.nombre] as [string, string])} empty="Todos los tipos" /></div>
    <table className="tbl"><thead><tr><th>Activo</th><th>Tipo</th><th>Completitud</th><th>Faltan</th></tr></thead><tbody>{rows.map(({ a, c }) =>
      <tr key={a.id}><td><Link to={`/activo/${a.id}/tecnica`}><b>{a.codigo || a.id}</b> {a.nombre}</Link></td><td>{db.TIPOS_ACTIVOS.find(t => t.id === a.tipo_id)?.nombre || <i className="muted">sin tipo</i>}</td><td style={{ minWidth: 120 }}><Progress pct={c.pct} /></td><td className="small muted">{c.faltantes.slice(0, 4).join(', ')}{c.faltantes.length > 4 ? '…' : ''}</td></tr>)}</tbody></table>
    {!rows.length && <Empty>Sin activos.</Empty>}
  </div>;
}
