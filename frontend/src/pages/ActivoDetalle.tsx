import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { ancestors, completitud, ETAPAS, fmtDate, isTrue, parseJson, Row, wouldCycle, FUENTES_INFO, camposAplicables, uuid } from '../domain';
import { AssetPicker, Badge, CondBadge, CritBadge, Empty, Field, Modal, PhotoUploader, Progress, QR, Select, Thumb, VerifBadge, assetUrl } from '../components/ui';
import { AssetForm, nextLevel } from './NuevoActivo';
import { VerifyForm } from './Campo';
import { TechForm } from './Fichas';
import { InspectionForm } from './Inspecciones';
import { CriticalityForm } from './Criticidad';
import { RelationForm } from './Relaciones';
import { SparePartLink } from './Repuestos';
import { call } from '../api';

const TABS: [string, string][] = [['general', 'General'], ['tecnica', 'Ficha técnica'], ['jerarquia', 'Jerarquía'], ['relaciones', 'Relaciones'], ['fotos', 'Fotos y documentos'], ['inspecciones', 'Inspección y hallazgos'], ['criticidad', 'Criticidad'], ['repuestos', 'Repuestos'], ['mantenimiento', 'Mantenimiento'], ['historial', 'Historial']];

export default function ActivoDetalle() {
  const { id = '', tab = 'general' } = useParams();
  const nav = useNavigate();
  const { db, idx, can, run, upsertLocal, toast, reload, save } = useApp();
  const a = idx.byId.get(id);
  const [modal, setModal] = useState<string>('');
  const [lightbox, setLightbox] = useState('');
  if (!a) return <div className="page"><Empty>Activo {id} no encontrado. {db.ACTIVOS.length === 0 && 'Cargando…'}</Empty></div>;
  const comp = completitud(db, a, idx);
  const anc = ancestors(idx, a.id);
  const hijos = (idx.children.get(a.id) || []).sort((x, y) => String(x.codigo).localeCompare(String(y.codigo), 'es', { numeric: true }));
  const fotos = (idx.fotos.get(a.id) || []).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const docs = idx.docs.get(a.id) || [];
  const rels = db.RELACIONES.filter(r => r.origen_id === a.id || r.destino_id === a.id);
  const insps = db.INSPECCIONES.filter(i => i.activo_id === a.id).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const halls = db.HALLAZGOS.filter(h => h.activo_id === a.id);
  const crits = db.CRITICIDAD.filter(c => c.activo_id === a.id).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const verifs = db.VERIFICACIONES.filter(v => v.activo_id === a.id).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const mant = db.MANTENIMIENTO_BASE.filter(m => m.activo_id === a.id);
  const reps = db.ACTIVOS_REPUESTOS.filter(r => r.activo_id === a.id);
  const tipo = db.TIPOS_ACTIVOS.find(t => t.id === a.tipo_id);
  const go = (t: string) => nav(`/activo/${a.id}/${t}`, { replace: true });

  async function toggleEtapa(k: string, v: boolean) {
    const et = { ...parseJson<Record<string, boolean>>(a!.etapas, {}), [k]: v };
    try { await save('ACTIVOS', { id: a!.id, etapas: JSON.stringify(et) }, { label: 'Etapa de avance' }); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function remove() {
    if (!confirm(`¿Eliminar (lógicamente) ${a!.codigo || a!.id}? Podrá recuperarse desde Configuración → Papelera.`)) return;
    try { const r = await run<any>('remove', { table: 'ACTIVOS', id: a!.id }, 'Eliminar activo'); if (r) { upsertLocal('ACTIVOS', { ...r, eliminado: true }); toast('Activo eliminado (recuperable)'); nav('/inventario'); } } catch (e: any) { toast(e.message, 'error'); }
  }

  return <div className="page">
    <div className="crumbs">{anc.map(p => <span key={p.id}><Link to={'/activo/' + p.id}>{p.codigo || p.nombre}</Link> › </span>)}<b>{a.codigo || a.id}</b></div>
    <div className="asset-h">
      {a.foto_principal_id ? <Thumb driveId={a.foto_principal_id} size={320} className="main-photo" onClick={() => setLightbox(a.foto_principal_id)} /> : <div className="main-photo ph">Sin foto</div>}
      <div className="asset-h-info">
        <h2>{a.nombre} {isTrue(a.es_prueba) && <span className="tag test">PRUEBA</span>}{isTrue(a.borrador) && <span className="tag">BORRADOR</span>}{isTrue(a.es_generico) && <span className="tag">GENÉRICO</span>}{a._pendiente && <span className="tag pend">SIN ENVIAR</span>}</h2>
        <div className="muted">{a.codigo || 'Sin código'} · ID {a.id}{a.codigo_anterior ? ` · Cód. anterior ${a.codigo_anterior}` : ''}</div>
        <div className="muted">{a.nivel} · {tipo?.nombre || 'Tipo sin definir'} · {a.area}</div>
        <div className="badges"><VerifBadge v={a.estado_verificacion} /><CondBadge v={a.condicion} /><CritBadge v={a.criticidad} />{a.estado_operacional && <Badge text={a.estado_operacional} />}<Badge text={a.origen === 'IMPORTADO' ? 'Importado del Excel' : 'Incorporado en levantamiento'} color="#2563eb" /></div>
        <Progress pct={comp.pct} />
        <div className="row wrap">
          {can('VERIFICACIONES') && <button className="primary" onClick={() => setModal('verify')}>✅ Verificar</button>}
          {can('ACTIVOS') && <button onClick={() => setModal('edit')}>✏️ Editar</button>}
          {can('ACTIVOS') && <Link className="btn" to={`/nuevo?padre=${a.id}`}>➕ Componente / hijo</Link>}
          {can('INSPECCIONES') && <button onClick={() => setModal('insp')}>🔍 Inspección</button>}
          <Link className="btn" to={'/hoja-vida/' + a.id}>📄 Hoja de vida</Link>
          <button onClick={() => setModal('qr')}>▦ QR / etiqueta</button>
        </div>
      </div>
    </div>
    <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'sel' : ''} onClick={() => go(k)}>{l}</button>)}</div>

    {tab === 'general' && <div className="grid2">
      <section className="panel"><h3>Información general</h3>
        <dl className="dl">{([['Código', a.codigo], ['Código anterior', a.codigo_anterior], ['Nombre', a.nombre], ['Tipo', tipo?.nombre], ['Nivel', a.nivel], ['Clasificación', a.clasificacion], ['Descripción', a.descripcion], ['Activo padre', anc.length ? anc[anc.length - 1].nombre : ''], ['Área', a.area], ['Proceso', a.proceso], ['Ubicación física', a.ubicacion_fisica], ['Función principal', a.funcion], ['Fabricante', a.fabricante], ['Marca', a.marca], ['Modelo', a.modelo], ['Serie', a.serie], ['País de fabricación', a.pais_fabricacion], ['Año de fabricación', a.anio_fabricacion], ['Fecha de adquisición', a.fecha_adquisicion], ['Fecha de instalación', a.fecha_instalacion], ['Puesta en servicio', a.fecha_puesta_servicio], ['Proveedor', a.proveedor], ['Vida útil', a.vida_util], ['Tecnología', a.tecnologia], ['Fuente de alimentación', a.fuente_alimentacion], ['Especificación (Excel original)', a.especificacion_original], ['Riesgo de daño (Excel original)', a.riesgo_original], ['Responsable', a.responsable], ['Origen de la información', a.fuente_info], ['Observaciones', a.observaciones]] as [string, any][]).map(([k, v]) =>
          <React.Fragment key={k}><dt>{k}</dt><dd className={!v || /^(pendiente|n\/?a|no hay registro)/i.test(String(v)) ? 'pendiente' : ''}>{v ? String(v) : 'Pendiente de identificación'}</dd></React.Fragment>)}</dl></section>
      <section className="panel"><h3>Avance del levantamiento</h3>
        <ul className="checks">{ETAPAS.map(e => <li key={e.key}><label className="chk"><input type="checkbox" checked={!!comp.etapas[e.key]} disabled={!can('ACTIVOS') || (e.key === 'validado' && !can('CRITICIDAD'))} onChange={ev => toggleEtapa(e.key, ev.target.checked)} /> {e.label}</label></li>)}</ul>
        {comp.faltantes.length > 0 && <><h4>Información faltante ({comp.faltantes.length})</h4><div className="chips">{comp.faltantes.slice(0, 40).map(f => <span key={f} className="chip warn">{f}</span>)}</div></>}
        {can('ACTIVOS') && <div className="row"><button className="ghost sm danger" onClick={remove}>Eliminar (lógico)</button></div>}
      </section>
    </div>}

    {tab === 'tecnica' && <section className="panel"><TechForm activo={a} /></section>}

    {tab === 'jerarquia' && <section className="panel">
      <h3>Componentes y elementos hijos ({hijos.length})</h3>
      {hijos.length ? <table className="tbl"><thead><tr><th>Código</th><th>Nombre</th><th>Nivel</th><th>Estado</th><th>Criticidad</th></tr></thead><tbody>{hijos.map(h => <tr key={h.id} onClick={() => nav('/activo/' + h.id)} className="click"><td>{h.codigo || h.id}</td><td>{h.nombre}</td><td>{h.nivel}</td><td><VerifBadge v={h.estado_verificacion} /></td><td><CritBadge v={h.criticidad} /></td></tr>)}</tbody></table> : <Empty>Sin componentes registrados.</Empty>}
      <div className="row wrap">{can('ACTIVOS') && <><Link className="btn primary" to={`/nuevo?padre=${a.id}`}>➕ Agregar {nextLevel(a.nivel).toLowerCase()}</Link><button onClick={() => setModal('multi')}>➕ Agregar varios</button><button onClick={() => setModal('move')}>↔ Cambiar padre</button><button onClick={() => setModal('adopt')}>⤵ Vincular activo existente como hijo</button></>}
        <Link className="btn" to={'/arbol/' + a.id}>🌳 Ver en árbol</Link></div>
    </section>}

    {tab === 'relaciones' && <section className="panel">
      <h3>Relaciones funcionales</h3>
      {rels.length ? <table className="tbl"><tbody>{rels.map(r => { const out = r.origen_id === a.id; const o = idx.byId.get(out ? r.destino_id : r.origen_id); return <tr key={r.id}>
        <td>{out ? <b>{a.nombre}</b> : <Link to={'/activo/' + o?.id}>{o?.codigo || ''} {o?.nombre}</Link>}</td><td><Badge text={r.tipo} color="#7c3aed" /></td>
        <td>{out ? <Link to={'/activo/' + o?.id}>{o?.codigo || ''} {o?.nombre}</Link> : <b>{a.nombre}</b>}</td><td className="small muted">{r.descripcion}</td>
        <td>{can('RELACIONES') && <button className="ghost sm" onClick={async () => { const x = await run<any>('remove', { table: 'RELACIONES', id: r.id }, 'Eliminar relación'); if (x) upsertLocal('RELACIONES', { ...x, eliminado: true }); }}>✕</button>}</td></tr>; })}</tbody></table> : <Empty>Sin relaciones funcionales.</Empty>}
      {can('RELACIONES') && <RelationForm origen={a.id} />}
      <Link to={'/relaciones?activo=' + a.id}>Ver diagrama de relaciones →</Link>
    </section>}

    {tab === 'fotos' && <section className="panel">
      <h3>Fotografías ({fotos.length})</h3>
      <PhotoUploader activoId={a.id} />
      <div className="gallery">{fotos.map(f => <figure key={f.id}><Thumb driveId={f.drive_id} onClick={() => setLightbox(f.drive_id)} /><figcaption><b>{f.categoria}</b><br />{fmtDate(f.fecha)}<br /><small>{f.nombre_archivo}</small><br />
        <a href={f.url} target="_blank" rel="noreferrer">Abrir en Drive</a>{can('ACTIVOS') && a.foto_principal_id !== f.drive_id && <> · <button className="link" onClick={() => save('ACTIVOS', { id: a.id, foto_principal_id: f.drive_id })}>Principal</button></>}</figcaption></figure>)}</div>
      <h3>Documentos técnicos ({docs.length})</h3>
      <PhotoUploader activoId={a.id} kind="DOCUMENTO" defaultCat="Manual" />
      <table className="tbl"><tbody>{docs.map(d => <tr key={d.id}><td>{d.tipo_documento}</td><td><a href={d.url} target="_blank" rel="noreferrer">{d.nombre_archivo}</a></td><td>{d.descripcion}</td><td className="small">{fmtDate(d.fecha)} · {d.usuario}</td></tr>)}</tbody></table>
    </section>}

    {tab === 'inspecciones' && <section className="panel">
      <div className="row"><h3>Inspecciones ({insps.length})</h3>{can('INSPECCIONES') && <button className="primary" onClick={() => setModal('insp')}>Nueva inspección</button>}</div>
      {insps.map(i => { const cr = parseJson<Record<string, any>>(i.criterios, {}); return <div key={i.id} className="insp">
        <div><b>{fmtDate(i.fecha)}</b> · {i.usuario} · Condición general: <CondBadge v={i.condicion_general} /></div>
        <div className="chips">{Object.entries(cr).filter(([, v]) => v && v !== 'No evaluada' && v !== 'No aplica').map(([k, v]) => <span key={k} className="chip">{k}: {String(v)}</span>)}</div>
        {i.observaciones && <p>{i.observaciones}</p>}{i.recomendaciones && <p><b>Recomendaciones:</b> {i.recomendaciones}</p>}</div>; })}
      <h3>Hallazgos ({halls.length})</h3>
      <table className="tbl"><tbody>{halls.map(h => <tr key={h.id} className={isTrue(h.riesgo_seguridad) && h.estado !== 'Cerrado' ? 'danger-row' : ''}><td>{isTrue(h.riesgo_seguridad) && '⚠️ '}{h.descripcion}</td><td><Badge text={h.severidad} /></td><td>{h.estado}</td><td className="small">{fmtDate(h.fecha)}</td></tr>)}</tbody></table>
    </section>}

    {tab === 'criticidad' && <section className="panel"><CriticalityForm activo={a} />
      <h3>Historial de evaluaciones</h3>
      <table className="tbl"><thead><tr><th>Fecha</th><th>Resultado</th><th>IC×IP</th><th>Evaluador</th><th>Metodología</th><th>Vigente</th></tr></thead><tbody>{crits.map(c => <tr key={c.id}><td>{fmtDate(c.fecha)}</td><td><CritBadge v={c.resultado} />{isTrue(c.provisional) && <small> (provisional)</small>}</td><td>{c.puntaje_total}</td><td>{c.evaluador}</td><td>{c.version_metodologia}</td><td>{isTrue(c.vigente) ? 'Sí' : ''}</td></tr>)}</tbody></table></section>}

    {tab === 'repuestos' && <section className="panel"><h3>Repuestos y componentes de recambio</h3>
      <table className="tbl"><thead><tr><th>Repuesto</th><th>Tipo</th><th>Cant.</th><th>Disponibilidad</th><th></th></tr></thead><tbody>{reps.map(r => { const rp = db.REPUESTOS.find(x => x.id === r.repuesto_id); return <tr key={r.id}><td><b>{rp?.codigo}</b> {rp?.descripcion}<br /><small>{rp?.numero_parte}</small></td><td>{r.tipo}</td><td>{r.cantidad}</td><td>{rp?.disponibilidad}</td>
        <td>{can('ACTIVOS_REPUESTOS') && <button className="ghost sm" onClick={async () => { const x = await run<any>('remove', { table: 'ACTIVOS_REPUESTOS', id: r.id }, 'Quitar repuesto'); if (x) upsertLocal('ACTIVOS_REPUESTOS', { ...x, eliminado: true }); }}>✕</button>}</td></tr>; })}</tbody></table>
      {can('ACTIVOS_REPUESTOS') && <SparePartLink activoId={a.id} />}</section>}

    {tab === 'mantenimiento' && <section className="panel"><h3>Actividades de mantenimiento (históricas/preliminares)</h3>
      <div className="alert info">Actividades importadas del archivo original (MANT2025). Son información histórica pendiente de validación técnica; no constituyen un plan de mantenimiento definitivo.</div>
      <table className="tbl"><thead><tr><th>Actividad</th><th>Descripción</th><th>Consumible</th><th>Frecuencia (días)</th><th>Estado</th></tr></thead><tbody>{mant.map(m => <tr key={m.id}><td>{m.actividad}</td><td>{m.descripcion}</td><td>{m.consumible}</td><td className="num">{m.frecuencia_dias}{m.observacion_import && <span title={m.observacion_import}> ⚠️</span>}</td><td className="small">{m.estado_validacion}</td></tr>)}</tbody></table>
      {!mant.length && <Empty>Sin actividades registradas.</Empty>}</section>}

    {tab === 'historial' && <HistoryTab activoId={a.id} verifs={verifs} />}

    {modal === 'edit' && <Modal title="Editar activo" wide onClose={() => setModal('')}><AssetForm initial={a} onSaved={() => setModal('')} /></Modal>}
    {modal === 'verify' && <Modal title={`Verificar ${a.codigo || a.id}`} onClose={() => setModal('')}><VerifyForm a={a} onClose={() => setModal('')} /></Modal>}
    {modal === 'insp' && <Modal title={`Inspección de ${a.codigo || a.nombre}`} wide onClose={() => setModal('')}><InspectionForm activo={a} onDone={() => { setModal(''); go('inspecciones'); }} /></Modal>}
    {modal === 'qr' && <Modal title="Código QR e identificación" onClose={() => setModal('')}><div className="label-preview">
      <QR text={assetUrl(a.id)} size={180} /><div><b className="big">{a.codigo || a.id}</b><div>{a.nombre}</div><div className="small">{a.area}</div><div className="small muted">ID {a.id}</div></div></div>
      <div className="row"><Link className="btn primary" to={`/reportes?etiquetas=${a.id}`}>🖨️ Imprimir etiqueta</Link></div></Modal>}
    {modal === 'move' && <Modal title="Cambiar activo padre" onClose={() => setModal('')}><MoveForm id={a.id} version={a.version} onDone={() => setModal('')} /></Modal>}
    {modal === 'adopt' && <Modal title="Vincular activo existente como hijo" onClose={() => setModal('')}><AdoptForm parentId={a.id} onDone={() => setModal('')} /></Modal>}
    {modal === 'multi' && <Modal title="Agregar varios componentes" onClose={() => setModal('')}><MultiChildForm parent={a} onDone={() => setModal('')} /></Modal>}
    {lightbox && <Modal title="Fotografía" wide onClose={() => setLightbox('')}><Thumb driveId={lightbox} size={1600} className="full" /></Modal>}
  </div>;
}

function MoveForm({ id, version, onDone }: { id: string; version: number; onDone: () => void }) {
  const { idx, run, upsertLocal, toast } = useApp();
  const [p, setP] = useState(idx.byId.get(id)?.padre_id || ''); const [motivo, setMotivo] = useState('');
  return <div className="form"><Field label="Nuevo padre (vacío = raíz)"><AssetPicker value={p} onChange={setP} exclude={a => a.id === id || wouldCycle(idx, id, a.id)} /></Field>
    <Field label="Motivo"><input value={motivo} onChange={e => setMotivo(e.target.value)} /></Field>
    <div className="row end"><button className="primary" onClick={async () => {
      if (wouldCycle(idx, id, p)) { toast('Relación circular no permitida', 'error'); return; }
      try { const r = await run<any>('setParent', { id, padre_id: p, motivo, version }, 'Cambiar padre'); if (r) upsertLocal('ACTIVOS', r); toast('Jerarquía actualizada'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
    }}>Guardar</button></div></div>;
}

function AdoptForm({ parentId, onDone }: { parentId: string; onDone: () => void }) {
  const { idx, run, upsertLocal, toast } = useApp(); const [c, setC] = useState('');
  return <div className="form"><Field label="Activo a vincular"><AssetPicker value={c} onChange={setC} exclude={a => a.id === parentId || wouldCycle(idx, a.id, parentId)} /></Field>
    <div className="row end"><button className="primary" disabled={!c} onClick={async () => {
      try { const r = await run<any>('setParent', { id: c, padre_id: parentId, motivo: 'Vinculado como hijo' }, 'Vincular hijo'); if (r) upsertLocal('ACTIVOS', r); toast('Vinculado'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
    }}>Vincular</button></div></div>;
}

function MultiChildForm({ parent, onDone }: { parent: Row; onDone: () => void }) {
  const { db, save, toast } = useApp();
  const [text, setText] = useState(''); const [nivel, setNivel] = useState(nextLevel(parent.nivel)); const [busy, setBusy] = useState(false);
  return <div className="form"><p className="small muted">Un componente por línea. Se crearán como hijos de {parent.nombre}, con estado «Incorporado en levantamiento». Los datos técnicos se completan después.</p>
    <Field label="Nivel"><Select value={nivel} onChange={setNivel} options={['Sistema', 'Subsistema', 'Máquina', 'Equipo', 'Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible']} empty={false} /></Field>
    <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder={'Rodamiento lado acople\nRodamiento lado ventilador\nVentilador'} />
    <div className="row end"><button className="primary" disabled={busy} onClick={async () => {
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean); if (!lines.length) return; setBusy(true);
      let n = 0; for (const l of lines) { try { await save('ACTIVOS', { nombre: l, nivel, padre_id: parent.id, area: parent.area, proceso: parent.proceso, es_prueba: parent.es_prueba, estado_verificacion: 'Incorporado en levantamiento', condicion: 'No evaluada' }, { label: 'Componente ' + l }); n++; } catch (e: any) { toast(e.message, 'error'); } }
      setBusy(false); toast(`${n} componente(s) creados`); onDone();
    }}>{busy ? 'Creando…' : 'Crear componentes'}</button></div></div>;
}

function HistoryTab({ activoId, verifs }: { activoId: string; verifs: Row[] }) {
  const { db } = useApp(); const [aud, setAud] = useState<Row[] | null>(null);
  useEffect(() => { call<Row[]>('audit', { registro_id: activoId, limit: 300 }).then(setAud).catch(() => setAud([])); }, [activoId]);
  const jer = db.JERARQUIA.filter(j => j.activo_id === activoId);
  return <section className="panel">
    <h3>Verificaciones físicas ({verifs.length})</h3>
    <table className="tbl"><thead><tr><th>Fecha</th><th>Resultado</th><th>Usuario</th><th>Ubicación</th><th>Estado físico / operacional</th><th>Observaciones</th></tr></thead><tbody>{verifs.map(v => <tr key={v.id}><td>{fmtDate(v.fecha)}</td><td><VerifBadge v={v.resultado} /></td><td>{v.usuario}</td><td>{v.ubicacion_encontrada}</td><td>{v.estado_fisico} / {v.estado_operacional}</td><td>{v.observaciones}{v.pendiente && <div className="small">Pendiente: {v.pendiente}</div>}</td></tr>)}</tbody></table>
    <h3>Cambios de jerarquía</h3>
    <table className="tbl"><tbody>{jer.map(j => <tr key={j.id}><td>{fmtDate(j.creado_en)}</td><td>{j.padre_anterior_id || '(raíz)'} → {j.padre_nuevo_id || '(raíz)'}</td><td>{j.motivo}</td><td>{j.creado_por}</td></tr>)}</tbody></table>
    <h3>Auditoría de modificaciones</h3>
    {aud === null ? <div className="muted">Cargando…</div> : <table className="tbl small"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Campo</th><th>Anterior</th><th>Nuevo</th></tr></thead><tbody>{aud.slice().reverse().map(r => <tr key={r.id}><td>{fmtDate(r.fecha)}</td><td>{r.usuario}</td><td>{r.accion}</td><td>{r.campo}</td><td className="clip">{String(r.valor_anterior)}</td><td className="clip">{String(r.valor_nuevo)}</td></tr>)}</tbody></table>}
  </section>;
}
