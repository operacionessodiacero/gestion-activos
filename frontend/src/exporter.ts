// Exportaciones a Excel (XLSX) generadas en el navegador con los datos reales cargados.
import { DB, Index, Row, completitud, ancestors, isTrue, buildIndex } from './domain';

async function book() { const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook(); wb.creator = 'Gestión de Activos'; wb.created = new Date(); return wb; }

function addSheet(wb: any, name: string, rows: Row[], cols?: string[]) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  const keys = cols || [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => !k.startsWith('_'));
  ws.columns = keys.map(k => ({ header: k, key: k, width: Math.min(45, Math.max(10, k.length + 2)) }));
  rows.forEach(r => ws.addRow(Object.fromEntries(keys.map(k => [k, typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k]]))));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }]; ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, keys.length) } };
  return ws;
}

async function download(wb: any, name: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const tipoNombre = (db: DB, id: string) => db.TIPOS_ACTIVOS.find(t => t.id === id)?.nombre || '';

export async function exportInventario(db: DB, rows = db.ACTIVOS) {
  const wb = await book(); const idx = buildIndex(db);
  addSheet(wb, 'INVENTARIO', rows.map(a => ({ ID: a.id, CODIGO: a.codigo, CODIGO_ANTERIOR: a.codigo_anterior, NOMBRE: a.nombre, TIPO: tipoNombre(db, a.tipo_id), NIVEL: a.nivel, PADRE: idx.byId.get(a.padre_id)?.codigo || a.padre_id, RUTA: ancestors(idx, a.id).map(p => p.codigo || p.nombre).join(' > '), AREA: a.area, PROCESO: a.proceso, UBICACION: a.ubicacion_fisica, MARCA: a.marca, MODELO: a.modelo, SERIE: a.serie, ESTADO_VERIFICACION: a.estado_verificacion, ESTADO_OPERACIONAL: a.estado_operacional, CONDICION: a.condicion, CRITICIDAD: a.criticidad, COMPLETITUD_PCT: completitud(db, a, idx).pct, ORIGEN: a.origen, PRUEBA: isTrue(a.es_prueba) ? 'SI' : '', GENERICO: isTrue(a.es_generico) ? 'SI' : '', OBSERVACIONES: a.observaciones })));
  return download(wb, 'INVENTARIO_ACTIVOS');
}

/** Exportación completa: todas las tablas tal como están en Google Sheets. */
export async function exportTodo(db: DB) {
  const wb = await book();
  Object.entries(db).forEach(([t, rows]) => { if (Array.isArray(rows)) addSheet(wb, t, rows as Row[]); });
  return download(wb, 'GESTION_ACTIVOS_COMPLETO');
}

export async function exportCriticidad(db: DB, idx: Index) {
  const wb = await book(); const crit = db.CRITERIOS_CRITICIDAD;
  addSheet(wb, 'MATRIZ_CRITICIDAD', db.CRITICIDAD.filter(c => isTrue(c.vigente)).map(c => { const a = idx.byId.get(c.activo_id); const p = JSON.parse(c.puntajes || '{}');
    return { ID: c.activo_id, CODIGO: a?.codigo, NOMBRE: a?.nombre, AREA: a?.area, NIVEL: a?.nivel, ...Object.fromEntries(crit.map(k => [k.nombre, p[k.id] ?? 'ND'])), IC: c.indice_consecuencia, IP: c.indice_probabilidad, PUNTAJE: c.puntaje_total, RESULTADO: c.resultado, PROVISIONAL: isTrue(c.provisional) ? 'SI' : '', REGLA: c.regla_aplicada, JUSTIFICACION: c.justificacion, EVALUADOR: c.evaluador, FECHA: c.fecha, METODOLOGIA: c.version_metodologia }; }));
  addSheet(wb, 'CRITERIOS', crit);
  addSheet(wb, 'HISTORIAL', db.CRITICIDAD);
  return download(wb, 'MATRIZ_CRITICIDAD');
}

export async function exportRepuestos(db: DB, idx: Index) {
  const wb = await book();
  addSheet(wb, 'REPUESTOS', db.REPUESTOS);
  addSheet(wb, 'ASIGNACIONES', db.ACTIVOS_REPUESTOS.map(r => ({ ...r, ACTIVO: idx.byId.get(r.activo_id)?.codigo, REPUESTO: db.REPUESTOS.find(x => x.id === r.repuesto_id)?.descripcion })));
  addSheet(wb, 'COMPONENTES', db.ACTIVOS.filter(a => ['Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible'].includes(a.nivel)).map(a => ({ ID: a.id, CODIGO: a.codigo, NOMBRE: a.nombre, NIVEL: a.nivel, PADRE: idx.byId.get(a.padre_id)?.nombre, AREA: a.area, CONDICION: a.condicion, CRITICIDAD: a.criticidad })));
  return download(wb, 'REPUESTOS_Y_COMPONENTES');
}

export async function exportArbol(db: DB, idx: Index) {
  const wb = await book(); const out: Row[] = [];
  const walk = (a: Row, d: number) => { out.push({ NIVEL_ARBOL: d, ESTRUCTURA: '    '.repeat(d) + (a.codigo ? a.codigo + ' · ' : '') + a.nombre, ID: a.id, NIVEL: a.nivel, ESTADO: a.estado_verificacion, CRITICIDAD: a.criticidad }); (idx.children.get(a.id) || []).sort((x, y) => String(x.codigo).localeCompare(String(y.codigo), 'es', { numeric: true })).forEach(c => walk(c, d + 1)); };
  db.ACTIVOS.filter(a => !a.padre_id || !idx.byId.has(a.padre_id)).sort((x, y) => String(x.area).localeCompare(String(y.area)) || String(x.codigo_anterior).localeCompare(String(y.codigo_anterior), 'es', { numeric: true })).forEach(r => walk(r, 0));
  addSheet(wb, 'ARBOL', out);
  return download(wb, 'ARBOL_ACTIVOS');
}

export async function exportGeneric(name: string, sheets: Record<string, Row[]>) {
  const wb = await book(); Object.entries(sheets).forEach(([n, r]) => addSheet(wb, n, r)); return download(wb, name);
}
