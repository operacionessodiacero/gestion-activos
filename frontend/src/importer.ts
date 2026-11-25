// Importación del archivo original "HOJA DE VIDA EQUIPOS Y MAQUINARIA" (formato JAB-PA-GEA-F-46).
// Repetible: cada registro lleva import_key = "<HOJA>|<CÓDIGO>". Nunca sobrescribe datos levantados en campo.
import { Row } from './domain';

const SHEETS_ACTIVOS: Record<string, { tipoDefault: string; nivel: string }> = {
  '1MACP': { tipoDefault: 'TIP-GENER', nivel: 'Equipo' },
  '2EQP': { tipoDefault: 'TIP-GENER', nivel: 'Equipo' },
  '3MOB': { tipoDefault: 'TIP-MOBIL', nivel: 'Equipo' },
  '4LAB': { tipoDefault: 'TIP-INSTR', nivel: 'Equipo' }
};

const PEND = /^(n\/?a|na|no hay registro|no indica|fecha de compra no registrada|#ref!|#name\?|-|)$/i;
const clean = (v: any) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'result' in v) v = v.result;
  if (typeof v === 'object' && 'richText' in v) v = v.richText.map((r: any) => r.text).join('');
  if (typeof v === 'object' && 'error' in v) return '';
  return String(v).replace(/\s+/g, ' ').trim();
};
const pend = (v: string) => PEND.test(v.trim()) ? '' : v;
const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Clasificación preliminar por nombre (no inventa datos técnicos; sólo propone familia). */
function guessTipo(nombre: string, hoja: string, tecnologia: string): string {
  const n = normName(nombre);
  if (hoja === '3MOB') return /computador|impresora|pantalla|nevera|cafetera/.test(n) ? 'TIP-COMPU' : 'TIP-MOBIL';
  if (hoja === '4LAB') return 'TIP-INSTR';
  const rules: [RegExp, string][] = [[/motor/, 'TIP-MOTOR'], [/reductor/, 'TIP-REDUC'], [/bomba.*aceite|bomba.*piston|piston/, 'TIP-HIDR'], [/bomba/, 'TIP-BOMBA'], [/horno|quemador/, 'TIP-HORNO'],
    [/tablero/, 'TIP-TABLE'], [/puente gr|grua/, 'TIP-GRUA'], [/torno|taladro|alesadora|centro de mecanizado|electroerosion|prensa/, 'TIP-MAQH'],
    [/castillo|caja trio|volante|desbaste/, 'TIP-LAMIN'], [/soldadura|oxicorte|tortuga/, 'TIP-SOLD'], [/montacarga/, 'TIP-VEHIC'], [/compresor/, 'TIP-COMPR'],
    [/valvula/, 'TIP-VALV'], [/bascula/, 'TIP-INSTR']];
  for (const [re, t] of rules) if (re.test(n)) return t;
  if (/hidraul/i.test(tecnologia)) return 'TIP-HIDR';
  return 'TIP-GENER';
}
const GENERIC_RE = /^(basculas|tortugas|equipos de oxicorte|tableros electricos|castillos de laminacion|bombas |bombas agua|camino +de rodillos)/;

export interface ImportPlan {
  activos: { import_key: string; hoja: string; fila: number; codigo: string; record: Row; datos_originales: Row; observaciones: string[]; hash: string }[];
  mantenimiento: Row[];
  descartados: { hoja: string; fila: number; codigo: string; motivo: string; datos_originales: Row }[];
  resumen: { hoja: string; detectados: number; importables: number; descartados: number }[];
  inconsistencias: string[];
  duplicados: string[][];
}

export async function parseWorkbook(buf: ArrayBuffer): Promise<ImportPlan> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const plan: ImportPlan = { activos: [], mantenimiento: [], descartados: [], resumen: [], inconsistencias: [], duplicados: [] };

  for (const [hoja, meta] of Object.entries(SHEETS_ACTIVOS)) {
    const ws = wb.getWorksheet(hoja);
    if (!ws) { plan.inconsistencias.push(`No se encontró la hoja ${hoja}.`); continue; }
    let hdrRow = 0; let head: string[] = [];
    ws.eachRow((row, i) => {
      if (hdrRow) return;
      const vals = (row.values as any[]).map(v => clean(v).toUpperCase());
      if (vals.includes('NOMBRE') && (vals.includes('CÓDIGO') || vals.includes('CODIGO')) && vals.filter(Boolean).length > 6) { hdrRow = i; head = vals; }
    });
    if (!hdrRow) { plan.inconsistencias.push(`Hoja ${hoja}: no se encontró la tabla de activos.`); continue; }
    const col = (name: string) => head.findIndex(h => h === name);
    let det = 0, imp = 0, desc = 0;
    for (let i = hdrRow + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i); const get = (name: string) => { const c = col(name); return c >= 0 ? clean(row.getCell(c).value) : ''; };
      const codigo = get('CÓDIGO') || get('CODIGO'); const nombre = get('NOMBRE');
      if (!codigo && !nombre) continue;
      det++;
      const orig: Row = {}; head.forEach((h, c) => { if (h && c > 0) { const v = clean(row.getCell(c).value); if (v) orig[h] = v; } });
      const obs: string[] = [];
      // Plantillas y filas de ejemplo
      if (!nombre || /^[A-Z]$/.test(nombre) || (hoja === '2EQP' && /POTENCIA\s*VOLTAJE/i.test(get('ESPECIFICACIÓN TECNICA/CAPACIDAD')))) {
        plan.descartados.push({ hoja, fila: i, codigo, motivo: !nombre ? 'Código sin datos (fila vacía de plantilla)' : 'Registro de ejemplo / plantilla (datos ficticios)', datos_originales: orig }); desc++; continue;
      }
      Object.entries(orig).forEach(([k, v]) => { if (/#REF!|#NAME\?/i.test(String(v))) obs.push(`Fórmula rota en ${k}`); });
      const espec = get('ESPECIFICACIÓN TECNICA/CAPACIDAD');
      if (/hp\s*kw/i.test(espec)) obs.push('Unidad ambigua en especificación (HP y kW)');
      const fecha = get('FECHA DE COMPRA/AQUISICIÓN');
      const tec = pend(get('TECNOLOGIA'));
      const rec: Row = {
        codigo: '', codigo_anterior: codigo, nombre, nivel: meta.nivel, area: pend(get('UBICACIÓN')), tipo_id: guessTipo(nombre, hoja, tec) || meta.tipoDefault,
        marca: pend(get('MARCA')), modelo: pend(get('MODELO')), serie: pend(get('SERIE')), fecha_adquisicion: pend(fecha), anio_fabricacion: '', vida_util: pend(get('VIDA UTIL')), tecnologia: tec, fuente_alimentacion: pend(get('FUENTE DE ALIMENTACIÓN')),
        especificacion_original: pend(espec), riesgo_original: pend(get('RIESGO DE DAÑO')), condicion: 'No evaluada', criticidad: 'Pendiente de evaluación',
        es_generico: GENERIC_RE.test(normName(nombre)), es_prueba: false,
        observaciones: `Importado de ${hoja} fila ${i}.` + (obs.length ? ' ' + obs.join('; ') + '.' : '')
      };
      if (/^\d{4}$/.test(fecha)) obs.push('Fecha de compra registrada solo como año: pendiente de validar fecha exacta');
      if (rec.es_generico) obs.push('Registro genérico/agrupado: requiere desglose en campo');
      plan.activos.push({ import_key: `${hoja}|${codigo || 'FILA' + i}`, hoja, fila: i, codigo, record: rec, datos_originales: orig, observaciones: obs, hash: '' });
      imp++;
    }
    plan.resumen.push({ hoja, detectados: det, importables: imp, descartados: desc });
  }

  // Posibles duplicados: mismo nombre normalizado y misma área
  const byName = new Map<string, string[]>();
  plan.activos.forEach(a => { const k = normName(a.record.nombre) + '|' + normName(a.record.area); byName.set(k, [...(byName.get(k) || []), a.codigo]); });
  byName.forEach(v => { if (v.length > 1) plan.duplicados.push(v); });
  const codes = new Map<string, number>(); plan.activos.forEach(a => codes.set(a.codigo, (codes.get(a.codigo) || 0) + 1));
  codes.forEach((n, c) => { if (n > 1) plan.inconsistencias.push(`Código repetido en el archivo: ${c}`); });

  // MANT2025: actividades históricas
  const mws = wb.worksheets.find(w => /^MANT/i.test(w.name));
  if (mws) {
    const macp = plan.activos.filter(a => a.hoja === '1MACP');
    const findCode = (maq: string, proceso: string) => {
      const n = normName(maq);
      const exact = macp.filter(a => normName(a.record.nombre) === n);
      const pick = exact.length > 1 ? exact.find(a => normName(a.record.area) === normName(proceso)) : exact[0];
      if (pick) return { code: pick.codigo, nota: '' };
      const pref = macp.filter(a => normName(a.record.nombre).startsWith(n) && normName(a.record.area) === normName(proceso));
      if (pref.length === 1) return { code: pref[0].codigo, nota: `Asociado por coincidencia parcial de nombre («${maq}» → «${pref[0].record.nombre}»)` };
      return { code: '', nota: `Máquina «${maq}» sin correspondencia exacta en 1MACP` };
    };
    let n = 0; const sinMatch = new Set<string>();
    mws.eachRow((row, i) => {
      if (i === 1) return;
      const v = (row.values as any[]).map(clean);
      const maq = v[1], proceso = v[2], actividad = v[3]; if (!maq) return;
      // columnas: 1 máquina, 2 proceso, 3 actividad, 4 nombre/consumible, 5 descripción, 6 frecuencia
      let consumible = v[4], descr = v[5], frec = v[6];
      if (!descr && consumible && !/^\d+$/.test(v[6])) { descr = consumible; consumible = ''; }
      const m = findCode(maq, proceso); if (!m.code) sinMatch.add(maq);
      const notas = [m.nota];
      const f = Number(frec);
      if (f && f <= 7 && /cambio|reparaci|fabricaci/i.test(actividad)) notas.push(`Frecuencia de ${f} día(s) para «${actividad}» parece inconsistente: validar`);
      plan.mantenimiento.push({ import_key: `${mws.name}|${i}`, codigo_activo: m.code, maquina_original: maq, proceso, actividad, consumible, descripcion: descr, frecuencia_dias: frec, observacion_import: notas.filter(Boolean).join('; ') });
      n++;
    });
    plan.resumen.push({ hoja: mws.name, detectados: n, importables: n, descartados: 0 });
    sinMatch.forEach(s => plan.inconsistencias.push(`MANT: «${s}» no coincide exactamente con un activo de 1MACP`));
  }
  return plan;
}
