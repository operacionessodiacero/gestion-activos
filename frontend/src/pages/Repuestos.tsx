import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { catalog, norm, Row } from '../domain';
import { Field, Modal, Select, Empty } from '../components/ui';
import { exportRepuestos } from '../exporter';

export function SparePartForm({ initial, onDone }: { initial?: Row; onDone: (r: Row) => void }) {
  const { db, save, toast } = useApp();
  const [r, setR] = useState<Row>(initial || { unidad: 'und', disponibilidad: 'Desconocida' });
  const s = (k: string, v: any) => setR({ ...r, [k]: v });
  return <div className="form grid-form">
    <Field label="Código"><input value={r.codigo || ''} onChange={e => s('codigo', e.target.value.toUpperCase())} placeholder="REP-ROD-6205" /></Field>
    <Field label="Descripción *" wide><input value={r.descripcion || ''} onChange={e => s('descripcion', e.target.value)} /></Field>
    <Field label="Fabricante"><input value={r.fabricante || ''} onChange={e => s('fabricante', e.target.value)} /></Field>
    <Field label="Referencia comercial"><input value={r.referencia_comercial || ''} onChange={e => s('referencia_comercial', e.target.value)} /></Field>
    <Field label="Número de parte"><input value={r.numero_parte || ''} onChange={e => s('numero_parte', e.target.value)} /></Field>
    <Field label="Unidad"><input value={r.unidad || ''} onChange={e => s('unidad', e.target.value)} /></Field>
    <Field label="Especificaciones" wide><textarea rows={2} value={r.especificaciones || ''} onChange={e => s('especificaciones', e.target.value)} /></Field>
    <Field label="Proveedores"><input value={r.proveedores || ''} onChange={e => s('proveedores', e.target.value)} /></Field>
    <Field label="Disponibilidad"><Select value={r.disponibilidad} onChange={v => s('disponibilidad', v)} options={catalog(db, 'disponibilidad_repuesto')} /></Field>
    <Field label="Tiempo de adquisición (días)"><input inputMode="numeric" value={r.tiempo_adquisicion_dias || ''} onChange={e => s('tiempo_adquisicion_dias', e.target.value)} /></Field>
    <Field label="Costo estimado"><input inputMode="decimal" value={r.costo_estimado || ''} onChange={e => s('costo_estimado', e.target.value)} /></Field>
    <Field label="Criticidad del repuesto"><Select value={r.criticidad} onChange={v => s('criticidad', v)} options={['Muy alta', 'Alta', 'Media', 'Baja']} /></Field>
    <div className="row end wide"><button className="primary" onClick={async () => {
      if (!r.descripcion) { toast('Descripción obligatoria', 'error'); return; }
      if (r.codigo && db.REPUESTOS.some(x => x.id !== r.id && String(x.codigo).toUpperCase() === r.codigo)) { toast('Código de repuesto duplicado', 'error'); return; }
      try { const out = await save('REPUESTOS', r, { version: r.id ? Number(r.version) : undefined }); toast('Repuesto guardado'); onDone(out); } catch (e: any) { toast(e.message, 'error'); }
    }}>Guardar repuesto</button></div></div>;
}

/** Vincula un repuesto (registro maestro único) a un activo: instalado o en almacén. */
export function SparePartLink({ activoId }: { activoId: string }) {
  const { db, save, toast } = useApp();
  const [rep, setRep] = useState(''); const [tipo, setTipo] = useState('Instalado en el equipo'); const [cant, setCant] = useState('1'); const [nuevo, setNuevo] = useState(false);
  return <div className="form row wrap">
    <Select value={rep} onChange={setRep} options={db.REPUESTOS.map(r => [r.id, `${r.codigo || r.id} · ${r.descripcion}`] as [string, string])} empty="Seleccione repuesto…" />
    <Select value={tipo} onChange={setTipo} options={['Instalado en el equipo', 'Repuesto recomendado (almacén)', 'Consumible']} empty={false} />
    <input style={{ width: 80 }} value={cant} onChange={e => setCant(e.target.value)} inputMode="numeric" />
    <button className="primary" disabled={!rep} onClick={async () => { try { await save('ACTIVOS_REPUESTOS', { activo_id: activoId, repuesto_id: rep, tipo, cantidad: cant }); toast('Repuesto vinculado'); setRep(''); } catch (e: any) { toast(e.message, 'error'); } }}>Vincular</button>
    <button onClick={() => setNuevo(true)}>➕ Nuevo repuesto</button>
    {nuevo && <Modal title="Nuevo repuesto (registro maestro)" onClose={() => setNuevo(false)}><SparePartForm onDone={r => { setRep(r.id); setNuevo(false); }} /></Modal>}
  </div>;
}

export default function Repuestos() {
  const { db, idx, can, toast } = useApp(); const [q, setQ] = useState(''); const [edit, setEdit] = useState<Row | null>(null);
  const rows = db.REPUESTOS.filter(r => !q || norm(`${r.codigo} ${r.descripcion} ${r.numero_parte} ${r.fabricante}`).includes(norm(q)));
  const comps = db.ACTIVOS.filter(a => ['Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible'].includes(a.nivel));
  return <div className="page"><div className="page-h"><h2>Componentes y repuestos</h2>
    <div className="row">{can('REPUESTOS') && <button className="primary" onClick={() => setEdit({ unidad: 'und', disponibilidad: 'Desconocida' })}>➕ Nuevo repuesto</button>}<button onClick={() => exportRepuestos(db, idx).catch(e => toast(e.message, 'error'))}>⬇️ Excel</button></div></div>
    <p className="muted small">Un <b>componente</b> es un elemento físicamente instalado (forma parte del árbol de activos). Un <b>repuesto</b> es un registro maestro de catálogo que puede asociarse a varios equipos sin duplicarse.</p>
    <div className="grid2">
      <section className="panel"><h3>Catálogo de repuestos ({db.REPUESTOS.length})</h3><input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        {rows.length ? <table className="tbl small"><thead><tr><th>Código</th><th>Descripción</th><th>N.º parte</th><th>Disp.</th><th>Equipos</th></tr></thead><tbody>{rows.map(r => { const us = db.ACTIVOS_REPUESTOS.filter(x => x.repuesto_id === r.id); return <tr key={r.id} className="click" onClick={() => can('REPUESTOS') && setEdit(r)}><td>{r.codigo}</td><td>{r.descripcion}</td><td>{r.numero_parte}</td><td>{r.disponibilidad}</td><td>{us.map(u => <div key={u.id}><Link to={`/activo/${u.activo_id}/repuestos`} onClick={e => e.stopPropagation()}>{idx.byId.get(u.activo_id)?.codigo || u.activo_id}</Link> <small>({u.tipo}, {u.cantidad})</small></div>)}</td></tr>; })}</tbody></table> : <Empty>Sin repuestos registrados.</Empty>}</section>
      <section className="panel"><h3>Componentes instalados identificados ({comps.length})</h3>
        <table className="tbl small"><tbody>{comps.slice(0, 300).map(c => <tr key={c.id}><td><Link to={'/activo/' + c.id}>{c.codigo || c.id}</Link></td><td>{c.nombre}</td><td>{c.nivel}</td><td className="muted">{idx.byId.get(c.padre_id)?.nombre}</td></tr>)}</tbody></table></section>
    </div>
    {edit && <Modal title={edit.id ? 'Editar repuesto' : 'Nuevo repuesto'} onClose={() => setEdit(null)}><SparePartForm initial={edit} onDone={() => setEdit(null)} /></Modal>}
  </div>;
}
