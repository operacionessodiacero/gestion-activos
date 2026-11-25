import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { completitud, VERIFICADOS, isTrue, critColor, Activo } from '../domain';
import { Progress, Select } from '../components/ui';

function Card({ label, value, sub, color, to }: { label: string; value: React.ReactNode; sub?: string; color?: string; to?: string }) {
  const body = <div className="kpi" style={{ borderTopColor: color || '#334155' }}><div className="kpi-v">{value}</div><div className="kpi-l">{label}</div>{sub && <div className="kpi-s">{sub}</div>}</div>;
  return to ? <Link to={to} className="kpi-link">{body}</Link> : body;
}

function Bars({ rows }: { rows: { k: string; total: number; done: number; pct: number }[] }) {
  return <div className="bars">{rows.map(r => <div key={r.k} className="bar-row">
    <div className="bar-l" title={r.k}>{r.k || '(sin dato)'}</div>
    <div className="bar"><div style={{ width: r.pct + '%' }} /></div>
    <div className="bar-v">{r.pct}% <small>({r.done}/{r.total})</small></div></div>)}</div>;
}

export default function Dashboard() {
  const { db, idx, loading, lastSync } = useApp();
  const [area, setArea] = useState('');
  const [incluirPrueba, setIncluirPrueba] = useState(false);

  const s = useMemo(() => {
    let acts: Activo[] = db.ACTIVOS.filter(a => incluirPrueba || !isTrue(a.es_prueba));
    if (area) acts = acts.filter(a => a.area === area);
    const comp = new Map(acts.map(a => [a.id, completitud(db, a, idx)]));
    const ver = acts.filter(a => VERIFICADOS.includes(a.estado_verificacion));
    const by = (key: (a: Activo) => string, done: (a: Activo) => boolean) => {
      const m = new Map<string, Activo[]>(); acts.forEach(a => { const k = key(a); if (!m.has(k)) m.set(k, []); m.get(k)!.push(a); });
      return [...m.entries()].map(([k, l]) => ({ k, total: l.length, done: l.filter(done).length, pct: Math.round(l.reduce((s, a) => s + comp.get(a.id)!.pct, 0) / l.length) })).sort((a, b) => b.total - a.total);
    };
    const ids = new Set(acts.map(a => a.id));
    const hall = db.HALLAZGOS.filter(h => ids.has(h.activo_id));
    const resp = new Map<string, number>(); db.VERIFICACIONES.filter(v => ids.has(v.activo_id)).forEach(v => resp.set(v.usuario, (resp.get(v.usuario) || 0) + 1));
    return {
      total: acts.length,
      importados: acts.filter(a => a.origen === 'IMPORTADO').length,
      nuevos: acts.filter(a => a.origen === 'LEVANTAMIENTO').length,
      verificados: ver.length,
      pendientes: acts.filter(a => !a.estado_verificacion || a.estado_verificacion === 'Pendiente de verificación').length,
      noLoc: acts.filter(a => a.estado_verificacion === 'No localizado').length,
      fuera: acts.filter(a => a.estado_verificacion === 'Fuera de servicio' || a.estado_operacional === 'Fuera de servicio').length,
      incompletos: acts.filter(a => comp.get(a.id)!.pct < 100).length,
      fichaCompleta: acts.filter(a => comp.get(a.id)!.pct >= 90).length,
      critEval: acts.filter(a => a.criticidad && a.criticidad !== 'Pendiente de evaluación').length,
      critAlta: acts.filter(a => a.criticidad === 'Alta' || a.criticidad === 'Muy alta').length,
      condCrit: acts.filter(a => a.condicion === 'Crítica').length,
      hallPend: hall.filter(h => h.estado !== 'Cerrado').length,
      hallSeg: hall.filter(h => h.estado !== 'Cerrado' && isTrue(h.riesgo_seguridad)).length,
      sistemas: acts.filter(a => ['Sistema', 'Subsistema', 'Línea de producción'].includes(a.nivel)).length,
      sistemasCar: acts.filter(a => ['Sistema', 'Subsistema', 'Línea de producción'].includes(a.nivel) && (idx.children.get(a.id) || []).length > 0).length,
      componentes: acts.filter(a => ['Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible'].includes(a.nivel)).length,
      fotos: db.FOTOGRAFIAS.filter(f => ids.has(f.activo_id)).length,
      docs: db.DOCUMENTOS.filter(f => ids.has(f.activo_id)).length,
      avance: acts.length ? Math.round(acts.reduce((s, a) => s + comp.get(a.id)!.pct, 0) / acts.length) : 0,
      porArea: by(a => a.area, a => VERIFICADOS.includes(a.estado_verificacion)),
      porProceso: by(a => a.proceso || a.area, a => VERIFICADOS.includes(a.estado_verificacion)),
      porEstado: Object.entries(acts.reduce((m: any, a) => { const k = a.estado_verificacion || 'Pendiente de verificación'; m[k] = (m[k] || 0) + 1; return m; }, {})) as [string, number][],
      porCrit: ['Muy alta', 'Alta', 'Media', 'Baja', 'Pendiente de evaluación'].map(c => [c, acts.filter(a => (a.criticidad || 'Pendiente de evaluación') === c).length] as [string, number]),
      resp: [...resp.entries()].sort((a, b) => b[1] - a[1])
    };
  }, [db, idx, area, incluirPrueba]);

  const areas = [...new Set(db.ACTIVOS.map(a => a.area).filter(Boolean))].sort();
  const pctVer = s.total ? Math.round(s.verificados / s.total * 100) : 0;
  return <div className="page">
    <div className="page-h"><h2>Dashboard del levantamiento</h2>
      <div className="row"><Select value={area} onChange={setArea} options={areas} empty="Todas las áreas" />
        <label className="chk"><input type="checkbox" checked={incluirPrueba} onChange={e => setIncluirPrueba(e.target.checked)} /> Incluir registros de prueba</label></div></div>
    {loading && !db.ACTIVOS.length && <div className="muted">Cargando datos desde Google Sheets…</div>}
    {!loading && !db.ACTIVOS.length && <div className="alert info">No hay activos todavía. Un administrador puede importar el inventario original desde <Link to="/configuracion">Configuración → Importación</Link>.</div>}
    <div className="hero">
      <div><div className="hero-v">{s.avance}%</div><div className="muted">Avance general del levantamiento</div><Progress pct={s.avance} /></div>
      <div><div className="hero-v">{pctVer}%</div><div className="muted">Activos con existencia verificada ({s.verificados}/{s.total})</div><Progress pct={pctVer} /></div>
    </div>
    <div className="kpis">
      <Card label="Activos registrados" value={s.total} to="/inventario" />
      <Card label="Importados (Excel)" value={s.importados} />
      <Card label="Nuevos en levantamiento" value={s.nuevos} color="#2563eb" to="/inventario?origen=LEVANTAMIENTO" />
      <Card label="Verificados" value={s.verificados} color="#16a34a" to="/inventario?verif=ok" />
      <Card label="Pendientes de verificar" value={s.pendientes} color="#64748b" to="/campo" />
      <Card label="No localizados" value={s.noLoc} color="#dc2626" to="/inventario?estado=No localizado" />
      <Card label="Fuera de servicio" value={s.fuera} color="#ea580c" />
      <Card label="Información incompleta" value={s.incompletos} color="#ca8a04" />
      <Card label="Ficha técnica ≥ 90%" value={s.fichaCompleta} color="#16a34a" />
      <Card label="Criticidad evaluada" value={s.critEval} to="/criticidad" />
      <Card label="Criticidad alta / muy alta" value={s.critAlta} color="#dc2626" to="/criticidad" />
      <Card label="Condición crítica" value={s.condCrit} color="#dc2626" />
      <Card label="Hallazgos pendientes" value={s.hallPend} sub={s.hallSeg ? `${s.hallSeg} con riesgo de seguridad` : ''} color={s.hallSeg ? '#dc2626' : '#ca8a04'} to="/hallazgos" />
      <Card label="Sistemas caracterizados" value={`${s.sistemasCar}/${s.sistemas}`} />
      <Card label="Componentes identificados" value={s.componentes} />
      <Card label="Fotografías / documentos" value={`${s.fotos} / ${s.docs}`} to="/archivos" />
    </div>
    <div className="grid2">
      <section className="panel"><h3>Avance por área</h3><Bars rows={s.porArea} /></section>
      <section className="panel"><h3>Avance por proceso</h3><Bars rows={s.porProceso} /></section>
      <section className="panel"><h3>Estado de verificación</h3>
        <table className="tbl"><tbody>{s.porEstado.sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}</tbody></table></section>
      <section className="panel"><h3>Distribución de criticidad</h3>
        <div className="stack">{s.porCrit.filter(([, v]) => v).map(([k, v]) => <div key={k} style={{ flex: v, background: critColor(k) }} title={`${k}: ${v}`}>{v}</div>)}</div>
        <table className="tbl"><tbody>{s.porCrit.map(([k, v]) => <tr key={k}><td><span className="dot" style={{ background: critColor(k) }} />{k}</td><td className="num">{v}</td></tr>)}</tbody></table></section>
      <section className="panel"><h3>Verificaciones por responsable</h3>
        {s.resp.length ? <table className="tbl"><tbody>{s.resp.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}</tbody></table> : <div className="muted">Aún no hay verificaciones.</div>}</section>
    </div>
    <p className="small muted">Indicadores calculados con los datos reales almacenados en Google Sheets{lastSync ? ` · actualizado ${new Date(lastSync).toLocaleTimeString('es-CO')}` : ''}.</p>
  </div>;
}
