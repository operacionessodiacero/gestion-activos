import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { catalog, uuid } from '../domain';
import { AssetPicker, Badge, Field, Select } from '../components/ui';

export function RelationForm({ origen: o0 }: { origen?: string }) {
  const { db, save, toast } = useApp();
  const [o, setO] = useState(o0 || ''); const [t, setT] = useState(''); const [d, setD] = useState(''); const [desc, setDesc] = useState('');
  async function add() {
    if (!o || !t || !d) { toast('Complete origen, tipo y destino', 'error'); return; }
    if (o === d) { toast('Un activo no puede relacionarse consigo mismo', 'error'); return; }
    if (db.RELACIONES.some(r => r.origen_id === o && r.destino_id === d && r.tipo === t)) { toast('Esa relación ya existe', 'error'); return; }
    try { await save('RELACIONES', { origen_id: o, tipo: t, destino_id: d, descripcion: desc }, { label: 'Relación ' + t }); toast('Relación guardada'); setD(''); setDesc(''); } catch (e: any) { toast(e.message, 'error'); }
  }
  return <div className="form rel-form">
    {!o0 && <Field label="Activo origen"><AssetPicker value={o} onChange={setO} /></Field>}
    <Field label="Tipo de relación"><Select value={t} onChange={setT} options={catalog(db, 'tipo_relacion')} /></Field>
    <Field label="Activo destino"><AssetPicker value={d} onChange={setD} exclude={a => a.id === o} /></Field>
    <Field label="Descripción"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej.: acoplamiento flexible entre motor y reductor" /></Field>
    <div className="row end"><button className="primary" onClick={add}>➕ Agregar relación</button></div>
  </div>;
}

/** Diagrama radial de relaciones (SVG) centrado en un activo, con 2 niveles. */
function Diagram({ center }: { center: string }) {
  const { db, idx } = useApp(); const nav = useNavigate();
  const { nodes, edges } = useMemo(() => {
    const ids = new Set([center]); const edges: any[] = [];
    const add = (id: string) => db.RELACIONES.filter(r => r.origen_id === id || r.destino_id === id).forEach(r => { if (!edges.includes(r)) edges.push(r); ids.add(r.origen_id); ids.add(r.destino_id); });
    add(center); [...ids].forEach(i => i !== center && add(i));
    const p = idx.byId.get(center); if (p?.padre_id) { ids.add(p.padre_id); edges.push({ id: 'h', origen_id: center, destino_id: p.padre_id, tipo: 'Pertenece a', h: true }); }
    (idx.children.get(center) || []).forEach(c => { ids.add(c.id); edges.push({ id: 'h' + c.id, origen_id: c.id, destino_id: center, tipo: 'Pertenece a', h: true }); });
    const others = [...ids].filter(i => i !== center);
    const W = 760, H = 520, cx = W / 2, cy = H / 2, R = Math.min(220, 90 + others.length * 12);
    const nodes = new Map<string, { x: number; y: number }>([[center, { x: cx, y: cy }]]);
    others.forEach((id, i) => { const ang = (i / others.length) * Math.PI * 2 - Math.PI / 2; nodes.set(id, { x: cx + Math.cos(ang) * R * 1.4, y: cy + Math.sin(ang) * R }); });
    return { nodes, edges };
  }, [center, db.RELACIONES, idx]);
  return <svg viewBox="0 0 760 520" className="diagram">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#94a3b8" /></marker></defs>
    {edges.map((e, i) => { const a = nodes.get(e.origen_id), b = nodes.get(e.destino_id); if (!a || !b) return null; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.h ? '#475569' : '#a78bfa'} strokeDasharray={e.h ? '4 4' : ''} strokeWidth="2" markerEnd="url(#arr)" />
        <text x={mx} y={my - 4} className="elabel">{e.tipo}</text></g>; })}
    {[...nodes.entries()].map(([id, p]) => { const a = idx.byId.get(id); return <g key={id} className="gnode" onClick={() => nav('/relaciones?activo=' + id)} transform={`translate(${p.x},${p.y})`}>
      <rect x={-75} y={-20} width={150} height={40} rx={8} className={id === center ? 'center' : ''} />
      <text y={-4} className="n1">{(a?.codigo || id).slice(0, 22)}</text><text y={12} className="n2">{(a?.nombre || '').slice(0, 24)}</text></g>; })}
  </svg>;
}

export default function Relaciones() {
  const { db, idx, can } = useApp(); const [sp, setSp] = useSearchParams();
  const center = sp.get('activo') || '';
  const conRel = useMemo(() => [...new Set(db.RELACIONES.flatMap(r => [r.origen_id, r.destino_id]))].map(id => idx.byId.get(id)).filter(Boolean), [db.RELACIONES, idx]);
  return <div className="page">
    <div className="page-h"><h2>Relaciones funcionales</h2></div>
    <p className="muted small">Además de la jerarquía padre-hijo, registre cómo interactúan los activos (conectado a, acciona, transmite movimiento a, alimenta, controla, protege, lubrica, refrigera, soporta, depende de, respaldo de…). Cada activo conserva una única identidad aunque se relacione con varios equipos.</p>
    <div className="grid2">
      <section className="panel"><h3>Diagrama</h3>
        <AssetPicker value={center} onChange={v => setSp(v ? { activo: v } : {})} placeholder="Seleccione un activo para ver su diagrama…" />
        {center ? <><Diagram center={center} /><Link to={'/activo/' + center + '/relaciones'}>Abrir ficha →</Link></> : <div className="empty">Activos con relaciones: {conRel.map(a => <button key={a!.id} className="link" onClick={() => setSp({ activo: a!.id })}>{a!.codigo || a!.nombre}</button>)}</div>}
      </section>
      <section className="panel"><h3>Nueva relación</h3>{can('RELACIONES') ? <RelationForm origen={center || undefined} key={center} /> : <div className="muted">Solo lectura.</div>}
        <h3>Todas las relaciones ({db.RELACIONES.length})</h3>
        <table className="tbl small"><tbody>{db.RELACIONES.map(r => <tr key={r.id}><td><Link to={'/relaciones?activo=' + r.origen_id}>{idx.byId.get(r.origen_id)?.nombre}</Link></td><td><Badge text={r.tipo} color="#7c3aed" /></td><td><Link to={'/relaciones?activo=' + r.destino_id}>{idx.byId.get(r.destino_id)?.nombre}</Link></td></tr>)}</tbody></table>
      </section>
    </div>
  </div>;
}
