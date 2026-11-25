// Metodología de codificación de activos (ver docs/METODOLOGIA_CODIFICACION.md).
//  - ID interno inmutable: ACT-000001 (lo asigna el servidor; nunca cambia).
//  - Código visible: <ÁREA>-<FAMILIA>-<NNN>       ej.: T380-MOT-003
//  - Hijos (conjuntos/componentes/piezas): <CÓDIGO PADRE>-<NN>   ej.: T380-MOT-003-01, T380-MOT-003-01-02
//  - Códigos históricos (JAB-MACP-16, LAB-01-JAB…) se conservan en "codigo_anterior".
import { DB, Row } from './domain';

export const AREA_PREFIX: Record<string, string> = {
  'PLANTA - TREN DE LAMINACIÓN 230': 'T230', 'PLANTA - TREN DE LAMINACIÓN 380': 'T380', 'PATIO Y ALISTAMIENTO': 'PAT',
  'TALLER': 'TAL', 'PLANTA- TREFI/DOBL/ELECTR': 'TDE', 'AREA LABORATORIO': 'LAB', 'AREA ADMINISTRATIVA': 'ADM',
  'AREA DE BIENESTAR ADMINISTRATIVO': 'BAD', 'AREA DE BIENESTAR PLANTA': 'BPL'
};
export const FAMILY_PREFIX: Record<string, string> = {
  UBICACION: 'ARE', SISTEMA: 'SIS', MOTOR_ELECTRICO: 'MOT', REDUCTOR: 'RED', ACOPLAMIENTO: 'ACO', RODAMIENTO: 'ROD', BOMBA: 'BOM',
  HIDRAULICO: 'HID', VALVULA: 'VAL', COMPRESOR: 'CMP', HORNO: 'HOR', TABLERO: 'TAB', IZAJE: 'GRU', MAQUINA_HERRAMIENTA: 'MAQ',
  LAMINACION: 'LAM', SOLDADURA: 'SOL', VEHICULO: 'VEH', INSTRUMENTO: 'INS', MOBILIARIO: 'MOB', COMPUTO: 'COM', GENERICO: 'EQP'
};

export function areaPrefix(area: string) {
  return AREA_PREFIX[area] || String(area || 'GEN').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'GEN';
}

export function suggestCode(db: DB, opts: { area?: string; tipo_id?: string; padre_id?: string; prueba?: boolean }): string {
  const codes = new Set(db.ACTIVOS.map(a => String(a.codigo || '').toUpperCase()));
  const parent = opts.padre_id ? db.ACTIVOS.find(a => a.id === opts.padre_id) : null;
  if (parent?.codigo && !['Empresa', 'Planta', 'Área', 'Proceso'].includes(parent.nivel)) {
    for (let i = 1; i < 1000; i++) { const c = `${String(parent.codigo).toUpperCase()}-${String(i).padStart(2, '0')}`; if (!codes.has(c)) return c; }
  }
  const tipo: Row | undefined = db.TIPOS_ACTIVOS.find(t => t.id === opts.tipo_id);
  const base = `${opts.prueba ? 'PRB-' : ''}${areaPrefix(opts.area || parent?.area || '')}-${FAMILY_PREFIX[tipo?.familia] || 'EQP'}`;
  for (let i = 1; i < 10000; i++) { const c = `${base}-${String(i).padStart(3, '0')}`; if (!codes.has(c)) return c; }
  return base + '-' + Date.now();
}

export function isCodeTaken(db: DB, code: string, exceptId?: string) {
  const c = code.trim().toUpperCase();
  return !!c && db.ACTIVOS.some(a => a.id !== exceptId && String(a.codigo || '').trim().toUpperCase() === c);
}
