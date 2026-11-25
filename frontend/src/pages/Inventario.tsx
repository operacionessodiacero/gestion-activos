import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { completitud, ESTADOS_VERIFICACION, VERIFICADOS, isTrue, norm, NIVELES, CONDICIONES } from '../domain';
import { Select, VerifBadge, CritBadge, CondBadge, Progress, useDebounced } from '../components/ui';
import { exportInventario } from '../exporter';

export default function Inventario() {
  const { db, idx, toast } = useApp();
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState('');
  const [nivel, setNivel] = useState('');
  const [estado, setEstado] = useState(sp.get('estado') || '');
  const [cond, setCond] = useState('');
  const [origen, setOrigen] = useState(sp.get('origen') || '');
  const [sistema, setSistema] = useState('');
  const [prueba, setPrueba] = useState(false);
  const [limit, setLimit] = useState(100);
  const dq = useDebounced(q);

  const sistemas = useMemo(() => db.ACTIVOS.filter(a => ['Sistema', 'Subsistema', 'Línea de producción', 'Máquina', 'Proceso', 'Área'].includes(a.nivel)), [db.ACTIVOS]);
  const rows = useMemo(() => {
    const n = norm(dq);
    let sysSet: Set<string> | null = null;
    if (sistema) { sysSet = new Set([sistema]); const st = [sistema]; while (st.length) { const id = st.pop()!; (idx.children.get(id) || []).forEach(c => { sysSet!.add(c.id); st.push(c.id); }); } }
    return db.ACTIVOS.filter(a =>
      (prueba || !isTrue(a.es_prueba)) && (!area || a.area === area) && (!tipo || a.tipo_id === tipo) && (!nivel || a.nivel === nivel) &&
      (!estado || (estado === 'ok' ? VERIFICADOS.includes(a.estado_verificacion) : (a.estado_verificacion || 'Pendiente de verificación') === estado)) &&
      (sp.get('verif') !== 'ok' || VERIFICADOS.includes(a.estado_verificacion)) &&
      (!cond || a.condicion === cond) && (!origen || a.origen === origen) && (!sysSet || sysSet.has(a.id)) &&
      (!n || norm(`${a.id} ${a.codigo} ${a.codigo_anterior} ${a.nombre} ${a.marca} ${a.modelo} ${a.serie} ${a.ubicacion_fisica} ${a.observaciones}`).includes(n))
    ).sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), 'es', { numeric: true }));
  }, [db.ACTIVOS, idx, dq, area, tipo, nivel, estado, cond, origen, sistema, prueba, sp]);

  const areas = [...new Set(db.ACTIVOS.map(a => a.area).filter(Boolean))].sort();
  return <div className="page">
    <div className="page-h"><h2>Inventario maestro <small className="muted">({rows.length})</small></h2>
      <div className="row"><Link to="/nuevo" className="btn primary">➕ Nuevo activo</Link>
        <button onClick={() => exportInventario(db, rows).catch(e => toast(e.message, 'error'))}>⬇️ Excel (filtrado)</button></div></div>
    <div className="filters">
      <input placeholder="Buscar por código, nombre, marca, serie…" value={q} onChange={e => setQ(e.target.value)} />
      <Select value={area} onChange={setArea} options={areas} empty="Área: todas" />
      <Select value={sistema} onChange={setSistema} options={sistemas.map(s => [s.id, `${s.codigo || s.id} ${s.nombre}`] as [string, string])} empty="Sistema/máquina: todos" />
      <Select value={tipo} onChange={setTipo} options={db.TIPOS_ACTIVOS.map(t => [t.id, t.nombre] as [string, string])} empty="Tipo: todos" />
      <Select value={nivel} onChange={setNivel} options={NIVELES} empty="Nivel: todos" />
      <Select value={estado} onChange={setEstado} options={[['ok', '✔ Verificados (todos)'] as [string, string], ...ESTADOS_VERIFICACION.map(e => [e, e] as [string, string])]} empty="Verificación: todos" />
      <Select value={cond} onChange={setCond} options={CONDICIONES} empty="Condición: todas" />
      <Select value={origen} onChange={setOrigen} options={[['IMPORTADO', 'Importado del Excel'], ['LEVANTAMIENTO', 'Incorporado en levantamiento']]} empty="Origen: todos" />
      <label className="chk"><input type="checkbox" checked={prueba} onChange={e => setPrueba(e.target.checked)} /> Ver pruebas</label>
    </div>
    <div className="cards">
      {rows.slice(0, limit).map(a => {
        const c = completitud(db, a, idx); const parent = a.padre_id ? idx.byId.get(a.padre_id) : null;
        return <Link to={'/activo/' + a.id} key={a.id} className={'acard' + (a._pendiente ? ' pend' : '')}>
          <div className="acard-h"><b>{a.codigo || <i className="muted">sin código</i>}</b><small className="muted">{a.id}</small></div>
          <div className="acard-n">{a.nombre}{isTrue(a.es_prueba) && <span className="tag test">PRUEBA</span>}{isTrue(a.es_generico) && <span className="tag">GENÉRICO</span>}{isTrue(a.borrador) && <span className="tag">BORRADOR</span>}</div>
          <div className="small muted">{a.nivel ? a.nivel + ' · ' : ''}{a.area}{parent ? ' · en ' + (parent.codigo || parent.nombre) : ''}</div>
          <div className="badges"><VerifBadge v={a.estado_verificacion} /><CondBadge v={a.condicion} /><CritBadge v={a.criticidad} /></div>
          <Progress pct={c.pct} />
        </Link>;
      })}
    </div>
    {rows.length > limit && <button className="block" onClick={() => setLimit(limit + 200)}>Mostrar más ({rows.length - limit} restantes)</button>}
  </div>;
}
