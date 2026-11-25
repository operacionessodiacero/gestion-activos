import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { Activo, ancestors, completitud, isTrue, norm, verifColor, critColor } from '../domain';
import { useDebounced } from '../components/ui';
import { exportArbol } from '../exporter';

function Node({ a, depth, open, toggle, sel, match }: { a: Activo; depth: number; open: Set<string>; toggle: (id: string) => void; sel: string; match: Set<string> | null }) {
  const { idx, db } = useApp();
  const kids = (idx.children.get(a.id) || []).filter(k => !match || match.has(k.id)).sort((x, y) => String(x.codigo || x.nombre).localeCompare(String(y.codigo || y.nombre), 'es', { numeric: true }));
  const isOpen = open.has(a.id) || !!match;
  const pct = completitud(db, a, idx).pct;
  return <div>
    <div className={'tnode' + (sel === a.id ? ' sel' : '')} style={{ paddingLeft: 8 + depth * 18 }}>
      <button className="tw" onClick={() => toggle(a.id)} disabled={!kids.length}>{kids.length ? (isOpen ? '▾' : '▸') : '·'}</button>
      <span className="dot" style={{ background: verifColor(a.estado_verificacion) }} title={a.estado_verificacion} />
      <Link to={'/activo/' + a.id} className="tlabel"><b>{a.codigo || ''}</b> {a.nombre} <small className="muted">{a.nivel}</small></Link>
      {a.criticidad && a.criticidad !== 'Pendiente de evaluación' && <span className="dot sq" style={{ background: critColor(a.criticidad) }} title={'Criticidad ' + a.criticidad} />}
      <small className="tpct">{pct}%</small>
      {kids.length > 0 && <small className="muted">({kids.length})</small>}
    </div>
    {isOpen && kids.map(k => <Node key={k.id} a={k} depth={depth + 1} open={open} toggle={toggle} sel={sel} match={match} />)}
  </div>;
}

export default function Arbol() {
  const { id = '' } = useParams();
  const { db, idx, toast } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('tree_open') || '[]')));
  const [q, setQ] = useState(''); const dq = useDebounced(q, 300);
  const [prueba, setPrueba] = useState(false);
  const [groupArea, setGroupArea] = useState(true);
  useEffect(() => { if (id) { const anc = ancestors(idx, id); setOpen(o => new Set([...o, ...anc.map(a => a.id), id])); } }, [id, idx]);
  useEffect(() => { localStorage.setItem('tree_open', JSON.stringify([...open])); }, [open]);
  const toggle = (x: string) => setOpen(o => { const n = new Set(o); n.has(x) ? n.delete(x) : n.add(x); return n; });

  const match = useMemo(() => {
    const n = norm(dq); if (n.length < 2) return null;
    const m = new Set<string>();
    db.ACTIVOS.forEach(a => { if (norm(`${a.codigo} ${a.nombre} ${a.codigo_anterior}`).includes(n)) { m.add(a.id); ancestors(idx, a.id).forEach(p => m.add(p.id)); } });
    return m;
  }, [dq, db.ACTIVOS, idx]);

  const roots = db.ACTIVOS.filter(a => (!a.padre_id || !idx.byId.has(a.padre_id)) && (prueba || !isTrue(a.es_prueba)) && (!match || match.has(a.id)))
    .sort((x, y) => String(x.codigo || x.nombre).localeCompare(String(y.codigo || y.nombre), 'es', { numeric: true }));
  const byArea = useMemo(() => { const m = new Map<string, Activo[]>(); roots.forEach(r => { const k = r.area || '(Sin área)'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }); return [...m.entries()].sort(); }, [roots]);

  return <div className="page">
    <div className="page-h"><h2>Árbol jerárquico de activos</h2>
      <div className="row"><Link className="btn primary" to="/nuevo">➕ Nuevo nodo</Link><button onClick={() => exportArbol(db, idx).catch(e => toast(e.message, 'error'))}>⬇️ Exportar árbol</button></div></div>
    <div className="filters">
      <input placeholder="Buscar en el árbol…" value={q} onChange={e => setQ(e.target.value)} />
      <label className="chk"><input type="checkbox" checked={groupArea} onChange={e => setGroupArea(e.target.checked)} /> Agrupar raíces por área</label>
      <label className="chk"><input type="checkbox" checked={prueba} onChange={e => setPrueba(e.target.checked)} /> Ver pruebas</label>
      <button className="sm" onClick={() => setOpen(new Set(db.ACTIVOS.map(a => a.id)))}>Expandir todo</button><button className="sm" onClick={() => setOpen(new Set())}>Contraer</button>
    </div>
    <p className="small muted">Estructura flexible: Empresa › Planta › Área › Proceso › Línea › Sistema › Subsistema › Máquina › Equipo › Conjunto › Subconjunto › Componente › Pieza. No es obligatorio usar todos los niveles. Para mover un nodo use «Cambiar padre» en su ficha (se impiden ciclos).</p>
    <div className="tree panel">
      {groupArea ? byArea.map(([area, list]) => <div key={area}>
        <div className="tgroup" onClick={() => toggle('area:' + area)}>{open.has('area:' + area) || match ? '▾' : '▸'} {area} <small className="muted">({list.length})</small></div>
        {(open.has('area:' + area) || match) && list.map(r => <Node key={r.id} a={r} depth={1} open={open} toggle={toggle} sel={id} match={match} />)}
      </div>) : roots.map(r => <Node key={r.id} a={r} depth={0} open={open} toggle={toggle} sel={id} match={match} />)}
      {!roots.length && <div className="empty">Sin activos.</div>}
    </div>
  </div>;
}
