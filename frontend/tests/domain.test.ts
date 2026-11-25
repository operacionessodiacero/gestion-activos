import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseWorkbook } from '../src/importer';
import { computeCriticality, buildIndex, wouldCycle, emptyDB } from '../src/domain';

const crit = [
  { id: 'S', nombre: 'Seguridad', grupo: 'CONSECUENCIA', peso: 3, regla_especial: 'SEGURIDAD_AMBIENTAL' },
  { id: 'P', nombre: 'Producción', grupo: 'CONSECUENCIA', peso: 3 },
  { id: 'F', nombre: 'Frecuencia', grupo: 'PROBABILIDAD', peso: 1 }
];
const cfg = (_k: string, d: string) => d;

describe('criticidad', () => {
  it('regla especial de seguridad no queda oculta por el promedio', () => {
    expect(computeCriticality(crit, { S: 5, P: 1, F: 1 }, cfg).resultado).toBe('Muy alta');
    expect(computeCriticality(crit, { S: 4, P: 1, F: 1 }, cfg).resultado).toBe('Alta');
  });
  it('desconocidos no se asumen bajos', () => {
    const r = computeCriticality(crit, { S: 'ND', P: 'ND', F: 2 }, cfg);
    expect(r.resultado).toBe('Pendiente de evaluación'); expect(r.provisional).toBe(true);
  });
  it('cálculo IC×IP', () => { expect(computeCriticality(crit, { S: 2, P: 4, F: 4 }, cfg)).toMatchObject({ ic: 3, ip: 4, total: 12, resultado: 'Alta' }); });
});

describe('jerarquía', () => {
  it('detecta ciclos', () => {
    const db = emptyDB(); db.ACTIVOS = [{ id: 'A', padre_id: '' }, { id: 'B', padre_id: 'A' }, { id: 'C', padre_id: 'B' }] as any;
    const idx = buildIndex(db);
    expect(wouldCycle(idx, 'A', 'C')).toBe(true); expect(wouldCycle(idx, 'C', 'A')).toBe(false); expect(wouldCycle(idx, 'A', 'A')).toBe(true);
  });
});

describe.skipIf(!existsSync(__dirname + '/fixture.xlsx'))('importación del Excel original', () => {
  it('detecta los registros esperados', async () => {
    const buf = readFileSync(__dirname + '/fixture.xlsx');
    const plan = await parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const by = Object.fromEntries(plan.resumen.map(r => [r.hoja, r]));
    expect(by['1MACP'].importables).toBe(74);
    expect(by['3MOB'].importables).toBe(51);
    expect(by['4LAB'].importables).toBe(14);
    expect(by['2EQP'].importables).toBe(0);
    expect(by['2EQP'].descartados).toBe(20);
    expect(plan.mantenimiento.length).toBe(357);
    expect(new Set(plan.activos.map(a => a.import_key)).size).toBe(plan.activos.length);
    expect(plan.activos.every(a => a.record.codigo === '' && a.record.codigo_anterior)).toBe(true);
    const sinAsociar = plan.mantenimiento.filter(m => !m.codigo_activo).length;
    console.log('resumen', plan.resumen, 'duplicados', plan.duplicados, 'mant sin asociar', sinAsociar, 'inconsistencias', plan.inconsistencias.length);
  }, 60000);
});
