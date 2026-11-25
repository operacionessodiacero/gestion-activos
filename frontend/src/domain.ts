// Tipos y reglas de dominio (independientes del almacenamiento).

export type Row = Record<string, any>;

export interface Activo extends Row {
  id: string; codigo: string; codigo_anterior: string; nombre: string; tipo_id: string; nivel: string;
  padre_id: string; area: string; proceso: string; ubicacion_fisica: string; estado_verificacion: string;
  estado_operacional: string; condicion: string; criticidad: string; origen: string; es_prueba: any;
  es_generico: any; borrador: any; etapas: string; version: number; foto_principal_id: string;
}

export interface DB {
  ACTIVOS: Activo[]; JERARQUIA: Row[]; RELACIONES: Row[]; TIPOS_ACTIVOS: Row[]; CAMPOS_TECNICOS: Row[];
  DATOS_TECNICOS: Row[]; VERIFICACIONES: Row[]; INSPECCIONES: Row[]; HALLAZGOS: Row[]; CRITICIDAD: Row[];
  CRITERIOS_CRITICIDAD: Row[]; FOTOGRAFIAS: Row[]; DOCUMENTOS: Row[]; REPUESTOS: Row[]; ACTIVOS_REPUESTOS: Row[];
  MANTENIMIENTO_BASE: Row[]; UBICACIONES: Row[]; CATALOGOS: Row[]; USUARIOS?: Row[]; CONFIGURACION: Row[];
  _serverTime?: string;
}

export const TABLES_PK: Record<string, string> = { USUARIOS: 'email', CONFIGURACION: 'clave' };
export const pkOf = (t: string) => TABLES_PK[t] || 'id';

export const emptyDB = (): DB => ({
  ACTIVOS: [], JERARQUIA: [], RELACIONES: [], TIPOS_ACTIVOS: [], CAMPOS_TECNICOS: [], DATOS_TECNICOS: [],
  VERIFICACIONES: [], INSPECCIONES: [], HALLAZGOS: [], CRITICIDAD: [], CRITERIOS_CRITICIDAD: [], FOTOGRAFIAS: [],
  DOCUMENTOS: [], REPUESTOS: [], ACTIVOS_REPUESTOS: [], MANTENIMIENTO_BASE: [], UBICACIONES: [], CATALOGOS: [],
  CONFIGURACION: []
});

export const isTrue = (v: any) => v === true || v === 'TRUE' || v === 'true' || v === 'SI' || v === 1;
export const parseJson = <T,>(s: any, d: T): T => { try { return s ? (typeof s === 'string' ? JSON.parse(s) : s) : d; } catch { return d; } };

export const ESTADOS_VERIFICACION = [
  'Pendiente de verificación', 'Existencia confirmada', 'Existe, pero presenta información incorrecta', 'No localizado',
  'Trasladado', 'Desmontado', 'Fuera de servicio', 'Dado de baja (previa aprobación)', 'Posible duplicado', 'Incorporado en levantamiento'
];
export const VERIFICADOS = ['Existencia confirmada', 'Existe, pero presenta información incorrecta', 'Trasladado', 'Desmontado', 'Fuera de servicio', 'Incorporado en levantamiento'];
export const NIVELES = ['Empresa', 'Planta', 'Área', 'Proceso', 'Línea de producción', 'Sistema', 'Subsistema', 'Máquina', 'Equipo', 'Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible'];
export const CONDICIONES = ['Excelente', 'Buena', 'Regular', 'Mala', 'Crítica', 'No evaluada', 'No aplica'];
export const FUENTES_INFO = ['Verificada', 'Suministrada por operadores', 'Documental', 'Histórica', 'Estimada', 'Pendiente'];
export const ROLES = ['ADMINISTRADOR', 'INGENIERO', 'INSPECTOR', 'CONSULTA'];

/** Etapas de avance del levantamiento progresivo. */
export const ETAPAS: { key: string; label: string }[] = [
  { key: 'identificado', label: 'Activo identificado' },
  { key: 'existencia', label: 'Existencia verificada' },
  { key: 'ubicacion', label: 'Ubicación confirmada' },
  { key: 'fotos', label: 'Registro fotográfico realizado' },
  { key: 'placa', label: 'Identificación de placa realizada' },
  { key: 'caracterizacion', label: 'Caracterización técnica iniciada' },
  { key: 'jerarquia', label: 'Jerarquía de componentes levantada' },
  { key: 'criticidad', label: 'Criticidad evaluada' },
  { key: 'documentacion', label: 'Documentación técnica recopilada' },
  { key: 'validado', label: 'Información revisada y validada' }
];

export function catalog(db: DB, lista: string): string[] {
  return db.CATALOGOS.filter(c => c.lista === lista && isTrue(c.activo) !== false)
    .sort((a, b) => Number(a.orden) - Number(b.orden)).map(c => String(c.valor));
}

export function config(db: DB, clave: string, def = ''): string {
  const r = db.CONFIGURACION.find(c => c.clave === clave); return r ? String(r.valor) : def;
}

/** Campos técnicos aplicables según la familia del tipo de activo. */
export function camposAplicables(db: DB, tipoId: string): Row[] {
  const tipo = db.TIPOS_ACTIVOS.find(t => t.id === tipoId);
  if (!tipo) return [];
  const grupos = String(tipo.grupos_campos || '').split(',').map(s => s.trim()).filter(Boolean);
  return db.CAMPOS_TECNICOS.filter(c => grupos.includes(c.grupo) && (c.familias === '*' || String(c.familias).split(',').map(s => s.trim()).includes(tipo.familia)))
    .sort((a, b) => Number(a.orden) - Number(b.orden));
}

const GENERAL_FIELDS: [string, string][] = [
  ['codigo', 'Código'], ['nombre', 'Nombre'], ['tipo_id', 'Tipo'], ['nivel', 'Nivel'], ['area', 'Área'],
  ['ubicacion_fisica', 'Ubicación física'], ['funcion', 'Función principal'], ['marca', 'Marca'], ['modelo', 'Modelo'],
  ['serie', 'Serie'], ['fabricante', 'Fabricante'], ['estado_operacional', 'Estado operacional'], ['condicion', 'Condición']
];
export const GENERAL_FIELD_LABELS = GENERAL_FIELDS;

const PENDIENTE_RE = /^(pendiente.*|n\/?a|no hay registro|no indica|-|sin dato|)$/i;
export const isPendiente = (v: any) => v === null || v === undefined || PENDIENTE_RE.test(String(v).trim());

/**
 * Completitud (%) = (etapas cumplidas/10)*50 + (campos aplicables con dato o N/A justificado / aplicables)*50.
 * Los campos marcados "No aplica" con justificación se excluyen del denominador.
 */
export function completitud(db: DB, a: Activo, idx?: Index): { pct: number; faltantes: string[]; etapas: Record<string, boolean> } {
  const et = etapasDe(db, a, idx);
  const etDone = ETAPAS.filter(e => et[e.key]).length;
  const faltantes: string[] = [];
  let total = 0, ok = 0;
  GENERAL_FIELDS.forEach(([k, l]) => { total++; if (!isPendiente(a[k])) ok++; else faltantes.push(l); });
  const datos = (idx?.datos.get(a.id)) || db.DATOS_TECNICOS.filter(d => d.activo_id === a.id);
  camposAplicables(db, a.tipo_id).forEach(c => {
    const d = datos.find(x => x.campo_id === c.id);
    if (d && isTrue(d.no_aplica) && d.justificacion) return; // excluido
    total++;
    if (d && !isPendiente(d.valor)) ok++; else faltantes.push(c.etiqueta);
  });
  const pct = Math.round((etDone / ETAPAS.length) * 50 + (total ? (ok / total) * 50 : 0));
  return { pct, faltantes, etapas: et };
}

/** Etapas: combina las marcadas en el activo con evidencias reales en las tablas. */
export function etapasDe(db: DB, a: Activo, idx?: Index): Record<string, boolean> {
  const et = { ...parseJson<Record<string, boolean>>(a.etapas, {}) };
  et.identificado = true;
  if (VERIFICADOS.includes(a.estado_verificacion)) et.existencia = true;
  const fotos = idx ? idx.fotos.get(a.id) || [] : db.FOTOGRAFIAS.filter(f => f.activo_id === a.id);
  if (fotos.length) et.fotos = true;
  if (fotos.some(f => f.categoria === 'Placa de identificación')) et.placa = true;
  const datos = idx ? idx.datos.get(a.id) || [] : db.DATOS_TECNICOS.filter(d => d.activo_id === a.id);
  if (datos.length) et.caracterizacion = true;
  const hijos = idx ? idx.children.get(a.id) || [] : db.ACTIVOS.filter(x => x.padre_id === a.id);
  if (hijos.length) et.jerarquia = true;
  if (a.criticidad && a.criticidad !== 'Pendiente de evaluación') et.criticidad = true;
  const docs = idx ? idx.docs.get(a.id) || [] : db.DOCUMENTOS.filter(d => d.activo_id === a.id);
  if (docs.length) et.documentacion = true;
  return et;
}

/** Índices en memoria para acelerar el árbol y los cálculos. */
export interface Index {
  byId: Map<string, Activo>; children: Map<string, Activo[]>; datos: Map<string, Row[]>; fotos: Map<string, Row[]>; docs: Map<string, Row[]>;
}
export function buildIndex(db: DB): Index {
  const group = (rows: Row[], k: string) => { const m = new Map<string, any[]>(); rows.forEach(r => { const v = r[k]; if (!m.has(v)) m.set(v, []); m.get(v)!.push(r); }); return m; };
  return {
    byId: new Map(db.ACTIVOS.map(a => [a.id, a])),
    children: group(db.ACTIVOS, 'padre_id') as Map<string, Activo[]>,
    datos: group(db.DATOS_TECNICOS, 'activo_id'),
    fotos: group(db.FOTOGRAFIAS, 'activo_id'),
    docs: group(db.DOCUMENTOS, 'activo_id')
  };
}

export function ancestors(idx: Index, id: string): Activo[] {
  const out: Activo[] = []; let cur = idx.byId.get(id); let guard = 0;
  while (cur && cur.padre_id && guard++ < 100) { const p = idx.byId.get(cur.padre_id); if (!p) break; out.unshift(p); cur = p; }
  return out;
}
export function descendants(idx: Index, id: string): Activo[] {
  const out: Activo[] = []; const stack = [...(idx.children.get(id) || [])];
  while (stack.length) { const a = stack.pop()!; out.push(a); stack.push(...(idx.children.get(a.id) || [])); }
  return out;
}
/** true si poner `parentId` como padre de `id` crea un ciclo. */
export function wouldCycle(idx: Index, id: string, parentId: string): boolean {
  if (!parentId) return false; if (parentId === id) return true;
  return descendants(idx, id).some(d => d.id === parentId);
}

/** Cálculo de criticidad (espejo del servidor; el servidor es la fuente de verdad). */
export function computeCriticality(criterios: Row[], puntajes: Record<string, any>, cfg: (k: string, d: string) => string) {
  const sum: Record<string, [number, number]> = { CONSECUENCIA: [0, 0], PROBABILIDAD: [0, 0] };
  let unknown = 0, minRank = 0; const regla: string[] = [];
  criterios.forEach(c => {
    const v = puntajes[c.id];
    if (v === null || v === undefined || v === '' || v === 'ND') { unknown++; return; }
    const n = Number(v), w = Number(c.peso || 1); const g = sum[c.grupo] || sum.CONSECUENCIA; g[0] += n * w; g[1] += w;
    if (c.regla_especial === 'SEGURIDAD_AMBIENTAL') {
      if (n >= 5) { minRank = Math.max(minRank, 3); regla.push(`${c.nombre}=5 ⇒ Muy alta`); }
      else if (n >= 4) { minRank = Math.max(minRank, 2); regla.push(`${c.nombre}=4 ⇒ mínimo Alta`); }
    }
  });
  const total = criterios.length;
  if (!total || unknown / total > Number(cfg('umbral_desconocidos', '0.4')) || !sum.CONSECUENCIA[1] || !sum.PROBABILIDAD[1]) {
    return { ic: null, ip: null, total: null, resultado: minRank >= 2 ? (minRank === 3 ? 'Muy alta' : 'Alta') : 'Pendiente de evaluación', regla: regla.join('; ') || 'Información insuficiente', provisional: true };
  }
  const ic = sum.CONSECUENCIA[0] / sum.CONSECUENCIA[1], ip = sum.PROBABILIDAD[0] / sum.PROBABILIDAD[1];
  const score = Math.round(ic * ip * 100) / 100;
  let rank = score >= Number(cfg('umbral_muy_alta', '16')) ? 3 : score >= Number(cfg('umbral_alta', '10')) ? 2 : score >= Number(cfg('umbral_media', '5')) ? 1 : 0;
  rank = Math.max(rank, minRank);
  return { ic: Math.round(ic * 100) / 100, ip: Math.round(ip * 100) / 100, total: score, resultado: ['Baja', 'Media', 'Alta', 'Muy alta'][rank], regla: regla.join('; '), provisional: unknown > 0 };
}

export const critColor = (c: string) => ({ 'Muy alta': '#dc2626', 'Alta': '#ea580c', 'Media': '#ca8a04', 'Baja': '#16a34a' } as Record<string, string>)[c] || '#64748b';
export const condColor = (c: string) => ({ 'Excelente': '#16a34a', 'Buena': '#65a30d', 'Regular': '#ca8a04', 'Mala': '#ea580c', 'Crítica': '#dc2626' } as Record<string, string>)[c] || '#64748b';
export const verifColor = (c: string) => c === 'Pendiente de verificación' ? '#64748b' : c === 'No localizado' || c === 'Posible duplicado' ? '#dc2626' : c === 'Existe, pero presenta información incorrecta' ? '#ca8a04' : c === 'Incorporado en levantamiento' ? '#2563eb' : '#16a34a';

export const fmtDate = (s: string) => { if (!s) return ''; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }); };
export const uuid = () => (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
export const norm = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
