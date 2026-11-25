import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { catalog, fmtDate } from '../domain';
import { AssetPicker, Modal, PhotoUploader, Select, Thumb, Empty } from '../components/ui';

export default function Archivos() {
  const { db, idx } = useApp();
  const [tab, setTab] = useState<'fotos' | 'docs'>('fotos'); const [cat, setCat] = useState(''); const [act, setAct] = useState(''); const [lb, setLb] = useState(''); const [limit, setLimit] = useState(60);
  const fotos = db.FOTOGRAFIAS.filter(f => (!cat || f.categoria === cat) && (!act || f.activo_id === act)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const docs = db.DOCUMENTOS.filter(f => (!cat || f.tipo_documento === cat) && (!act || f.activo_id === act)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return <div className="page"><div className="page-h"><h2>Fotografías y documentos</h2></div>
    <p className="small muted">Los archivos se guardan en Google Drive (GESTION_DE_ACTIVOS/ACTIVOS/&lt;ID&gt;_&lt;NOMBRE&gt;/…) con nombre CÓDIGO_TIPO_FECHA_HORA_CONSECUTIVO y quedan vinculados al ID interno del activo, aunque cambie su código o ubicación. Las vistas previas se obtienen a través del backend: los archivos no se hacen públicos.</p>
    <div className="seg"><button className={tab === 'fotos' ? 'sel' : ''} onClick={() => { setTab('fotos'); setCat(''); }}>Fotografías ({db.FOTOGRAFIAS.length})</button><button className={tab === 'docs' ? 'sel' : ''} onClick={() => { setTab('docs'); setCat(''); }}>Documentos ({db.DOCUMENTOS.length})</button></div>
    <div className="filters"><AssetPicker value={act} onChange={setAct} placeholder="Filtrar / cargar para un activo…" />
      <Select value={cat} onChange={setCat} options={catalog(db, tab === 'fotos' ? 'categoria_foto' : 'tipo_documento')} empty="Todas las categorías" /></div>
    {act && <section className="panel"><PhotoUploader key={act + tab} activoId={act} kind={tab === 'fotos' ? 'FOTO' : 'DOCUMENTO'} defaultCat={tab === 'fotos' ? 'Vista general' : 'Manual'} /></section>}
    {tab === 'fotos' ? (fotos.length ? <><div className="gallery">{fotos.slice(0, limit).map(f => { const a = idx.byId.get(f.activo_id); return <figure key={f.id}><Thumb driveId={f.drive_id} onClick={() => setLb(f.drive_id)} />
      <figcaption><Link to={`/activo/${f.activo_id}/fotos`}><b>{a?.codigo || f.activo_id}</b> {a?.nombre}</Link><br />{f.categoria} · {fmtDate(f.fecha)}<br /><small>{f.nombre_archivo}</small><br /><a href={f.url} target="_blank" rel="noreferrer">Drive ↗</a></figcaption></figure>; })}</div>
      {fotos.length > limit && <button className="block" onClick={() => setLimit(limit + 60)}>Ver más</button>}</> : <Empty>Sin fotografías.</Empty>)
      : (docs.length ? <table className="tbl"><thead><tr><th>Activo</th><th>Tipo</th><th>Archivo</th><th>Descripción</th><th>Fecha / usuario</th></tr></thead><tbody>{docs.map(d => { const a = idx.byId.get(d.activo_id); return <tr key={d.id}><td><Link to={`/activo/${d.activo_id}/fotos`}>{a?.codigo || d.activo_id}</Link></td><td>{d.tipo_documento}</td><td><a href={d.url} target="_blank" rel="noreferrer">{d.nombre_archivo}</a></td><td>{d.descripcion}</td><td className="small">{fmtDate(d.fecha)} · {d.usuario}</td></tr>; })}</tbody></table> : <Empty>Sin documentos.</Empty>)}
    {lb && <Modal title="Fotografía" wide onClose={() => setLb('')}><Thumb driveId={lb} size={1600} className="full" /></Modal>}
  </div>;
}
