import React, { useEffect, useState } from 'react';
import { useApp } from '../store';
import { call, fileToBase64 } from '../api';
import { fmtDate, ROLES, Row, isTrue } from '../domain';
import { Field, Modal, Select, Empty } from '../components/ui';
import { parseWorkbook, ImportPlan } from '../importer';
import { CustomField } from './Fichas';

function Usuarios() {
  const { db, run, reload, toast } = useApp(); const [u, setU] = useState<Row>({ email: '', nombre: '', rol: 'INSPECTOR', activo: true });
  return <section className="panel"><h3>Usuarios y roles</h3>
    <p className="small muted">Solo los correos de esta lista pueden ingresar. ADMINISTRADOR: usuarios, catálogos y configuración. INGENIERO: caracteriza, evalúa criticidad y valida. INSPECTOR: verifica, registra hallazgos y fotos. CONSULTA: solo lectura.</p>
    <table className="tbl"><thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Activo</th></tr></thead><tbody>{(db.USUARIOS || []).map(x => <tr key={x.email}><td>{x.email}</td><td>{x.nombre}</td>
      <td><Select value={x.rol} onChange={rol => run('saveUser', { user: { ...x, rol } }, 'Usuario').then(reload)} options={ROLES} empty={false} /></td>
      <td><input type="checkbox" checked={isTrue(x.activo)} onChange={e => run('saveUser', { user: { ...x, activo: e.target.checked } }, 'Usuario').then(reload)} /></td></tr>)}</tbody></table>
    <div className="row wrap"><input placeholder="correo@gmail.com" value={u.email} onChange={e => setU({ ...u, email: e.target.value })} /><input placeholder="Nombre" value={u.nombre} onChange={e => setU({ ...u, nombre: e.target.value })} />
      <Select value={u.rol} onChange={rol => setU({ ...u, rol })} options={ROLES} empty={false} />
      <button className="primary" onClick={async () => { try { await run('saveUser', { user: u }, 'Usuario'); toast('Usuario autorizado'); setU({ email: '', nombre: '', rol: 'INSPECTOR', activo: true }); reload(); } catch (e: any) { toast(e.message, 'error'); } }}>Autorizar</button></div>
  </section>;
}

function Importacion() {
  const { reload, toast, db } = useApp();
  const [plan, setPlan] = useState<ImportPlan | null>(null); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(''); const [res, setRes] = useState<any>(null);
  async function analizar(f: File) { setFile(f); setBusy('Analizando…'); try { setPlan(await parseWorkbook(await f.arrayBuffer())); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(''); } }
  async function importar() {
    if (!plan || !file) return; setBusy('Creando respaldo…');
    try {
      const bk = await call<any>('createBackup', { motivo: 'Antes de importar ' + file.name });
      setBusy('Guardando archivo original en Drive…');
      const b = await fileToBase64(file); await call('uploadImportFile', { ...b, filename: file.name });
      const lote = 'IMP-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      const tot = { creados: 0, actualizados: 0, sin_cambios: 0, mantenimiento: 0, descartados: 0, errores: [] as string[], respaldo: bk.url };
      const chunk = 40;
      for (let i = 0; i < plan.activos.length; i += chunk) {
        setBusy(`Importando activos ${i + 1}–${Math.min(i + chunk, plan.activos.length)} de ${plan.activos.length}…`);
        const r = await call<any>('importBatch', { lote, archivo: file.name, activos: plan.activos.slice(i, i + chunk) });
        tot.creados += r.creados; tot.actualizados += r.actualizados; tot.sin_cambios += r.sin_cambios; tot.errores.push(...r.errores);
      }
      for (let i = 0; i < plan.mantenimiento.length; i += 100) {
        setBusy(`Importando actividades de mantenimiento ${i + 1}–${Math.min(i + 100, plan.mantenimiento.length)}…`);
        const r = await call<any>('importBatch', { lote, archivo: file.name, mantenimiento: plan.mantenimiento.slice(i, i + 100) });
        tot.mantenimiento += r.mantenimiento;
      }
      const r = await call<any>('importBatch', { lote, archivo: file.name, descartados: plan.descartados }); tot.descartados += r.descartados;
      setRes(tot); await reload(); toast('Importación terminada');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(''); }
  }
  return <section className="panel"><h3>Importación del inventario original</h3>
    <p className="small muted">Cargue el archivo «HOJA DE VIDA EQUIPOS Y MAQUINARIA.xlsx». Primero se muestra un resumen; al confirmar se crea un respaldo de la hoja de cálculo, se guarda el archivo original en Drive (IMPORTACIONES_ORIGINALES) y se importan los activos como «Pendiente de verificación». La importación es repetible: no duplica registros y nunca sobrescribe información levantada en campo. Actualmente hay {db.ACTIVOS.filter(a => a.origen === 'IMPORTADO').length} activos importados.</p>
    <input type="file" accept=".xlsx" onChange={e => e.target.files?.[0] && analizar(e.target.files[0])} />
    {busy && <div className="alert info">{busy}</div>}
    {plan && !res && <div>
      <table className="tbl"><thead><tr><th>Hoja</th><th>Registros detectados</th><th>A importar</th><th>Descartados</th></tr></thead><tbody>{plan.resumen.map(r => <tr key={r.hoja}><td>{r.hoja}</td><td className="num">{r.detectados}</td><td className="num">{r.importables}</td><td className="num">{r.descartados}</td></tr>)}</tbody></table>
      <details open><summary>Posibles duplicados ({plan.duplicados.length})</summary><ul>{plan.duplicados.map((d, i) => <li key={i}>{d.join(' / ')}</li>)}</ul></details>
      <details><summary>Inconsistencias ({plan.inconsistencias.length})</summary><ul>{plan.inconsistencias.map((d, i) => <li key={i}>{d}</li>)}</ul></details>
      <details><summary>Registros descartados ({plan.descartados.length})</summary><ul>{plan.descartados.map((d, i) => <li key={i}>{d.hoja} fila {d.fila} {d.codigo}: {d.motivo}</li>)}</ul></details>
      <details><summary>Observaciones por activo ({plan.activos.filter(a => a.observaciones.length).length})</summary><ul>{plan.activos.filter(a => a.observaciones.length).map(a => <li key={a.import_key}>{a.codigo} {a.record.nombre}: {a.observaciones.join('; ')}</li>)}</ul></details>
      <div className="row end"><button className="primary" disabled={!!busy} onClick={importar}>Respaldar e importar</button></div></div>}
    {res && <div className="alert ok">Activos creados: {res.creados} · completados: {res.actualizados} · sin cambios: {res.sin_cambios} · actividades de mantenimiento: {res.mantenimiento} · descartados registrados: {res.descartados}{res.errores.length ? ` · errores: ${res.errores.join('; ')}` : ''}. <a href={res.respaldo} target="_blank" rel="noreferrer">Ver respaldo</a></div>}
  </section>;
}

function Catalogos() {
  const { db, save, toast } = useApp(); const listas = [...new Set(db.CATALOGOS.map(c => c.lista))].sort();
  const [l, setL] = useState(listas[0] || ''); const [v, setV] = useState('');
  return <section className="panel"><h3>Catálogos (listas desplegables)</h3>
    <Select value={l} onChange={setL} options={listas} empty={false} />
    <ul className="chips">{db.CATALOGOS.filter(c => c.lista === l).sort((a, b) => a.orden - b.orden).map(c => <li key={c.id} className={'chip' + (isTrue(c.activo) ? '' : ' off')} onClick={() => save('CATALOGOS', { id: c.id, activo: !isTrue(c.activo) }, { version: c.version })} title="Clic para activar/desactivar">{c.valor}</li>)}</ul>
    <div className="row"><input value={v} onChange={e => setV(e.target.value)} placeholder="Nuevo valor" /><button onClick={async () => { if (!v) return; try { await save('CATALOGOS', { lista: l, valor: v, orden: 999, activo: true }); setV(''); toast('Agregado'); } catch (e: any) { toast(e.message, 'error'); } }}>Agregar</button></div>
  </section>;
}

function Tipos() {
  const { db, save, toast } = useApp(); const [t, setT] = useState<Row | null>(null); const [cf, setCf] = useState(false);
  return <section className="panel"><h3>Familias / tipos de activos y campos técnicos</h3>
    <table className="tbl small"><thead><tr><th>Tipo</th><th>Familia</th><th>Grupos de campos</th><th>Campos</th></tr></thead><tbody>{db.TIPOS_ACTIVOS.map(x => <tr key={x.id} className="click" onClick={() => setT(x)}><td>{x.nombre}</td><td>{x.familia}</td><td>{x.grupos_campos}</td><td className="num">{db.CAMPOS_TECNICOS.filter(c => String(x.grupos_campos).split(',').includes(c.grupo) && (c.familias === '*' || String(c.familias).split(',').includes(x.familia))).length}</td></tr>)}</tbody></table>
    <div className="row"><button onClick={() => setT({ nombre: '', familia: '', nivel_sugerido: 'Equipo', grupos_campos: 'GENERAL' })}>➕ Nuevo tipo</button><button onClick={() => setCf(true)}>➕ Nuevo campo técnico</button></div>
    {t && <Modal title="Tipo de activo" onClose={() => setT(null)}><div className="form grid-form">
      <Field label="Nombre"><input value={t.nombre} onChange={e => setT({ ...t, nombre: e.target.value })} /></Field>
      <Field label="Familia (clave)"><input value={t.familia} onChange={e => setT({ ...t, familia: e.target.value.toUpperCase().replace(/\s/g, '_') })} /></Field>
      <Field label="Nivel sugerido"><input value={t.nivel_sugerido} onChange={e => setT({ ...t, nivel_sugerido: e.target.value })} /></Field>
      <Field label="Grupos de campos (coma)" wide hint="GENERAL, MECANICA, ELECTRICA, HIDRAULICA, NEUMATICA, TERMICA, METROLOGIA, OPERACIONAL"><input value={t.grupos_campos} onChange={e => setT({ ...t, grupos_campos: e.target.value.toUpperCase().replace(/\s/g, '') })} /></Field>
      <div className="row end wide"><button className="primary" onClick={async () => { try { await save('TIPOS_ACTIVOS', t, { version: t.version }); toast('Guardado'); setT(null); } catch (e: any) { toast(e.message, 'error'); } }}>Guardar</button></div></div></Modal>}
    {cf && <Modal title="Nuevo campo técnico" onClose={() => setCf(false)}><CustomField grupos={['MECANICA']} onDone={() => setCf(false)} /></Modal>}
  </section>;
}

function Parametros() {
  const { db, run, reload, toast } = useApp();
  return <section className="panel"><h3>Parámetros generales y metodología de criticidad</h3>
    <table className="tbl small"><tbody>{db.CONFIGURACION.map(c => <tr key={c.clave}><td><b>{c.clave}</b><div className="muted">{c.descripcion}</div></td><td><input defaultValue={c.valor} onBlur={e => e.target.value !== String(c.valor) && run('saveConfig', { clave: c.clave, valor: e.target.value }, 'Configuración').then(() => { toast('Guardado'); reload(); }).catch(er => toast(er.message, 'error'))} /></td></tr>)}</tbody></table>
    <h4>Criterios de criticidad (pesos editables)</h4>
    <table className="tbl small"><tbody>{db.CRITERIOS_CRITICIDAD.map(c => <tr key={c.id}><td>{c.nombre}</td><td>{c.grupo}</td><td><input style={{ width: 70 }} defaultValue={c.peso} onBlur={e => e.target.value !== String(c.peso) && run('save', { table: 'CRITERIOS_CRITICIDAD', record: { id: c.id, peso: Number(e.target.value) } }, 'Peso').then(() => { toast('Peso actualizado'); reload(); })} /></td><td className="muted">{c.escala}</td></tr>)}</tbody></table>
  </section>;
}

function Papelera() {
  const { run, reload, toast } = useApp(); const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => call<Row[]>('list', { table: 'ACTIVOS', includeDeleted: true }).then(r => setRows(r.filter(x => isTrue(x.eliminado))));
  return <section className="panel"><h3>Papelera y auditoría</h3>
    <div className="row"><button onClick={load}>Ver activos eliminados</button><button onClick={async () => { try { const b = await call<any>('createBackup', { motivo: 'Manual' }); toast('Respaldo creado'); window.open(b.url, '_blank'); } catch (e: any) { toast(e.message, 'error'); } }}>💾 Crear respaldo ahora</button><AuditBtn /></div>
    {rows && (rows.length ? <table className="tbl small"><tbody>{rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.codigo}</td><td>{r.nombre}</td><td>{fmtDate(r.actualizado_en)} · {r.actualizado_por}</td><td><button className="sm" onClick={async () => { await run('restore', { table: 'ACTIVOS', id: r.id }, 'Restaurar'); toast('Restaurado'); reload(); load(); }}>Restaurar</button></td></tr>)}</tbody></table> : <Empty>Papelera vacía.</Empty>)}
  </section>;
}
function AuditBtn() {
  const [rows, setRows] = useState<Row[] | null>(null);
  return <><button onClick={() => call<Row[]>('audit', { limit: 300 }).then(setRows)}>📜 Auditoría reciente</button>
    {rows && <Modal title="Auditoría (últimos 300 cambios)" wide onClose={() => setRows(null)}><table className="tbl small"><thead><tr><th>Fecha</th><th>Usuario</th><th>Tabla</th><th>Registro</th><th>Acción</th><th>Campo</th><th>Anterior</th><th>Nuevo</th></tr></thead><tbody>{rows.slice().reverse().map(r => <tr key={r.id}><td>{fmtDate(r.fecha)}</td><td>{r.usuario}</td><td>{r.tabla}</td><td>{r.registro_id}</td><td>{r.accion}</td><td>{r.campo}</td><td className="clip">{String(r.valor_anterior)}</td><td className="clip">{String(r.valor_nuevo)}</td></tr>)}</tbody></table></Modal>}</>;
}

export default function Configuracion() {
  const { isAdmin, user } = useApp();
  if (!isAdmin) return <div className="page"><h2>Configuración</h2><div className="alert info">Sesión: {user?.email} · Rol: {user?.rol}. Las opciones de configuración están disponibles para el rol ADMINISTRADOR.</div></div>;
  return <div className="page"><div className="page-h"><h2>Configuración</h2></div>
    <Importacion /><Usuarios /><Tipos /><Catalogos /><Parametros /><Papelera /></div>;
}
