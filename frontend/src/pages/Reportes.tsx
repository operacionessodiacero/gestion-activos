import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { completitud, isTrue, VERIFICADOS } from '../domain';
import { exportArbol, exportCriticidad, exportGeneric, exportInventario, exportRepuestos, exportTodo } from '../exporter';
import { AssetPicker, QR, assetUrl, Select } from '../components/ui';

function Labels({ ids }: { ids: string[] }) {
  const { idx } = useApp();
  return <div className="labels">{ids.map(id => { const a = idx.byId.get(id); if (!a) return null; return <div key={id} className="label">
    <QR text={assetUrl(a.id)} size={110} /><div><b>{a.codigo || a.id}</b><div className="ln">{a.nombre}</div><div className="small">{a.area}</div><div className="tiny">ID {a.id}</div></div></div>; })}</div>;
}

export default function Reportes() {
  const { db, idx, toast } = useApp();
  const [sp] = useSearchParams();
  const [labelIds, setLabelIds] = useState<string[]>(sp.get('etiquetas')?.split(',').filter(Boolean) || []);
  const [pick, setPick] = useState(''); const [areaLbl, setAreaLbl] = useState('');
  const run = (p: Promise<any>) => p.then(() => toast('Archivo generado')).catch(e => toast(e.message, 'error'));
  const real = db.ACTIVOS.filter(a => !isTrue(a.es_prueba));
  const areas = [...new Set(db.ACTIVOS.map(a => a.area).filter(Boolean))].sort();
  const progress = useMemo(() => { const m = new Map<string, any>(); real.forEach(a => { const k = a.area || '(sin área)'; const r = m.get(k) || { AREA: k, TOTAL: 0, VERIFICADOS: 0, PENDIENTES: 0, NO_LOCALIZADOS: 0, COMPLETITUD_SUMA: 0 }; r.TOTAL++; if (VERIFICADOS.includes(a.estado_verificacion)) r.VERIFICADOS++; if (!a.estado_verificacion || a.estado_verificacion === 'Pendiente de verificación') r.PENDIENTES++; if (a.estado_verificacion === 'No localizado') r.NO_LOCALIZADOS++; r.COMPLETITUD_SUMA += completitud(db, a, idx).pct; m.set(k, r); });
    return [...m.values()].map(r => ({ ...r, AVANCE_PCT: Math.round(r.COMPLETITUD_SUMA / r.TOTAL), COMPLETITUD_SUMA: undefined })); }, [db, idx]);
  if (labelIds.length && sp.get('etiquetas')) return <div className="page"><div className="row no-print"><Link className="btn" to="/reportes">← Reportes</Link><button className="primary" onClick={() => window.print()}>🖨️ Imprimir etiquetas</button></div><Labels ids={labelIds} /></div>;
  return <div className="page"><div className="page-h"><h2>Reportes y exportaciones</h2></div>
    <div className="report-grid">
      <button onClick={() => run(exportTodo(db))}>📦 <b>Base de datos completa (XLSX)</b><small>Todas las hojas: activos, verificaciones, criticidad, fotos, etc.</small></button>
      <button onClick={() => run(exportInventario(db, real))}>📋 <b>Inventario completo</b><small>Con ruta jerárquica, estado y completitud.</small></button>
      <button onClick={() => run(exportCriticidad(db, idx))}>🎯 <b>Matriz de criticidad</b><small>Puntajes por criterio, resultado e historial.</small></button>
      <button onClick={() => run(exportGeneric('ACTIVOS_PENDIENTES', { PENDIENTES: real.filter(a => !VERIFICADOS.includes(a.estado_verificacion)).map(a => ({ ID: a.id, CODIGO: a.codigo || a.codigo_anterior, NOMBRE: a.nombre, AREA: a.area, ESTADO: a.estado_verificacion, FALTANTES: completitud(db, a, idx).faltantes.join(', ') })) }))}>⏳ <b>Activos pendientes</b><small>Sin verificar o con hallazgos de verificación.</small></button>
      <button onClick={() => run(exportGeneric('HALLAZGOS', { HALLAZGOS: db.HALLAZGOS.map(h => ({ ...h, ACTIVO: idx.byId.get(h.activo_id)?.codigo, NOMBRE: idx.byId.get(h.activo_id)?.nombre })) }))}>⚠️ <b>Hallazgos</b><small>Con severidad y riesgo de seguridad.</small></button>
      <button onClick={() => run(exportGeneric('AVANCE_LEVANTAMIENTO', { AVANCE_AREA: progress, VERIFICACIONES: db.VERIFICACIONES }))}>📈 <b>Avance del levantamiento</b><small>Por área y verificaciones realizadas.</small></button>
      <button onClick={() => run(exportRepuestos(db, idx))}>⚙️ <b>Componentes y repuestos</b><small>Catálogo, asignaciones y componentes instalados.</small></button>
      <button onClick={() => run(exportArbol(db, idx))}>🌳 <b>Árbol de activos</b><small>Estructura jerárquica indentada.</small></button>
      <button onClick={() => run(exportGeneric('MANTENIMIENTO_HISTORICO', { MANTENIMIENTO_BASE: db.MANTENIMIENTO_BASE.map(m => ({ ...m, ACTIVO: idx.byId.get(m.activo_id)?.codigo_anterior })) }))}>🛠️ <b>Mantenimiento histórico</b><small>Actividades importadas pendientes de validación.</small></button>
    </div>
    <section className="panel"><h3>Hoja de vida individual (PDF)</h3><p className="small muted">Seleccione un activo y use «Imprimir / Guardar PDF» o «Guardar PDF en Drive».</p>
      <AssetPicker value={pick} onChange={setPick} />{pick && <Link className="btn primary" to={'/hoja-vida/' + pick}>Abrir hoja de vida</Link>}</section>
    <section className="panel"><h3>Etiquetas de identificación con QR</h3>
      <div className="row wrap"><Select value={areaLbl} onChange={setAreaLbl} options={areas} empty="Por área…" /><button onClick={() => setLabelIds(real.filter(a => !areaLbl || a.area === areaLbl).map(a => a.id))}>Seleccionar área</button>
        <AssetPicker value="" onChange={id => id && setLabelIds([...new Set([...labelIds, id])])} placeholder="Agregar activo…" />
        {labelIds.length > 0 && <Link className="btn primary" to={`/reportes?etiquetas=${labelIds.join(',')}`}>🖨️ Vista de impresión ({labelIds.length})</Link>}<button className="ghost" onClick={() => setLabelIds([])}>Limpiar</button></div>
      {labelIds.length > 0 && <Labels ids={labelIds.slice(0, 12)} />}</section>
  </div>;
}
