import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { catalog, fmtDate, isTrue } from '../domain';
import { Badge, Select, Empty } from '../components/ui';

export default function Hallazgos() {
  const { db, idx, can, save, toast } = useApp();
  const [estado, setEstado] = useState('abiertos'); const [seg, setSeg] = useState(false);
  const rows = db.HALLAZGOS.filter(h => (estado === 'todos' || (estado === 'abiertos' ? h.estado !== 'Cerrado' : h.estado === estado)) && (!seg || isTrue(h.riesgo_seguridad)))
    .sort((a, b) => (isTrue(b.riesgo_seguridad) ? 1 : 0) - (isTrue(a.riesgo_seguridad) ? 1 : 0) || String(b.fecha).localeCompare(String(a.fecha)));
  const urg = db.HALLAZGOS.filter(h => h.estado !== 'Cerrado' && isTrue(h.riesgo_seguridad));
  return <div className="page"><div className="page-h"><h2>Hallazgos</h2></div>
    {urg.length > 0 && <div className="alert error">⚠️ {urg.length} hallazgo(s) con riesgo grave de seguridad pendientes de atención por personal competente.</div>}
    <div className="filters"><Select value={estado} onChange={setEstado} options={[['abiertos', 'No cerrados'], ['todos', 'Todos'], ...catalog(db, 'estado_hallazgo').map(e => [e, e] as [string, string])]} empty={false} />
      <label className="chk"><input type="checkbox" checked={seg} onChange={e => setSeg(e.target.checked)} /> Solo riesgos de seguridad</label></div>
    {rows.length ? <table className="tbl"><thead><tr><th></th><th>Activo</th><th>Hallazgo</th><th>Criterio</th><th>Severidad</th><th>Recomendación</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{rows.map(h => { const a = idx.byId.get(h.activo_id); return <tr key={h.id} className={isTrue(h.riesgo_seguridad) && h.estado !== 'Cerrado' ? 'danger-row' : ''}>
      <td>{isTrue(h.riesgo_seguridad) ? '⚠️' : ''}</td><td><Link to={`/activo/${h.activo_id}/inspecciones`}>{a?.codigo || h.activo_id} {a?.nombre}</Link></td><td>{h.descripcion}</td><td>{h.criterio}</td><td><Badge text={h.severidad} color={h.severidad === 'Crítica' ? '#dc2626' : h.severidad === 'Alta' ? '#ea580c' : '#ca8a04'} /></td><td className="small">{h.recomendacion}{h.necesidad_intervencion && <div>Intervención: {h.necesidad_intervencion}</div>}</td><td className="small">{fmtDate(h.fecha)}<br />{h.usuario}</td>
      <td>{can('HALLAZGOS') ? <Select value={h.estado} onChange={v => save('HALLAZGOS', { id: h.id, estado: v }, { version: Number(h.version) }).then(() => toast('Estado actualizado')).catch(e => toast(e.message, 'error'))} options={catalog(db, 'estado_hallazgo')} empty={false} /> : h.estado}</td></tr>; })}</tbody></table> : <Empty>Sin hallazgos en este filtro.</Empty>}
  </div>;
}
