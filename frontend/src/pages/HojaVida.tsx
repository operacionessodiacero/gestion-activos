import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { ancestors, camposAplicables, completitud, fmtDate, isTrue, parseJson } from '../domain';
import { QR, assetUrl } from '../components/ui';
import { thumbnail, call } from '../api';

const HV_CSS = `body{font-family:Arial,sans-serif;font-size:11px;color:#000}.hv table{width:100%;border-collapse:collapse}.hv th,.hv td{border:1px solid #333;padding:3px 5px;text-align:left;vertical-align:top}.hv th{background:#e5e7eb;font-weight:bold}.hv h4{background:#1f2937;color:#fff;margin:10px 0 0;padding:4px 6px;font-size:11px}.hv-head td{text-align:center;font-weight:bold}.hv-top{margin-top:6px}.hv-photo img{width:180px;height:135px}.pend{color:#a16207;font-style:italic}.hv-foot{font-size:9px;color:#555}`;

/** Google Sheets convierte '08/07/2025' en fecha; se muestra de nuevo como dd/mm/aaaa. */
const diaDoc = (v: any) => /^\d{4}-\d\d-\d\dT/.test(String(v)) ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : String(v);

/** Hoja de vida basada en el formato corporativo JAB-PA-GEA-F-46 (se conserva su identificación documental). */
export default function HojaVida() {
  const { id = '' } = useParams();
  const { db, idx, cfg, toast } = useApp();
  const a = idx.byId.get(id);
  const [foto, setFoto] = useState(''); const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (a?.foto_principal_id) thumbnail(a.foto_principal_id, 640).then(setFoto).catch(() => {}); }, [a?.foto_principal_id]);
  if (!a) return <div className="page">No encontrado</div>;
  const tipo = db.TIPOS_ACTIVOS.find(t => t.id === a.tipo_id);
  const datos = db.DATOS_TECNICOS.filter(d => d.activo_id === a.id);
  const campos = camposAplicables(db, a.tipo_id);
  const hijos = idx.children.get(a.id) || [];
  const rels = db.RELACIONES.filter(r => r.origen_id === a.id || r.destino_id === a.id);
  const crit = db.CRITICIDAD.find(c => c.activo_id === a.id && isTrue(c.vigente));
  const insps = db.INSPECCIONES.filter(i => i.activo_id === a.id).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const halls = db.HALLAZGOS.filter(h => h.activo_id === a.id);
  const reps = db.ACTIVOS_REPUESTOS.filter(r => r.activo_id === a.id);
  const docs = db.DOCUMENTOS.filter(d => d.activo_id === a.id);
  const mant = db.MANTENIMIENTO_BASE.filter(m => m.activo_id === a.id);
  const verif = db.VERIFICACIONES.filter(v => v.activo_id === a.id).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)))[0];
  const val = (v: any) => (v === '' || v === null || v === undefined) ? <span className="pend">Pendiente</span> : String(v);
  const P = (l: string, v: any) => <tr><th>{l}</th><td>{val(v)}</td></tr>;

  async function savePdf() {
    setSaving(true);
    try {
      const css = HV_CSS;
      const html = `<html><head><meta charset="utf-8"><style>${css}</style></head><body class="print-body">${ref.current!.outerHTML}</body></html>`;
      const r = await call<any>('savePdf', { activo_id: a!.id, html });
      toast(`PDF guardado en Drive: ${r.nombre}`); window.open(r.url, '_blank');
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }

  return <div className="page">
    <div className="row no-print"><Link className="btn" to={'/activo/' + a.id}>← Volver</Link><button className="primary" onClick={() => window.print()}>🖨️ Imprimir / Guardar PDF</button><button disabled={saving} onClick={savePdf}>{saving ? 'Generando…' : '☁️ Guardar PDF en Drive'}</button></div>
    <div className="hv" ref={ref}>
      <table className="hv-head"><tbody><tr>
        <td className="hv-logo">{cfg('empresa', 'LAMINADOS JAB')}</td>
        <td className="hv-title">HOJA DE VIDA EQUIPOS Y MAQUINARIA</td>
        <td className="hv-doc">CÓDIGO: {cfg('formato_hv_codigo', 'JAB-PA-GEA-F-46')}<br />{cfg('formato_hv_version', 'Versión 3')}<br />VIGENCIA: {diaDoc(cfg('formato_hv_vigencia', '08/07/2025'))}</td></tr></tbody></table>
      <div className="hv-top">
        <div className="hv-photo">{foto ? <img src={foto} alt="" /> : <div className="ph">Sin fotografía</div>}</div>
        <table className="hv-t"><tbody>
          {P('NOMBRE', a.nombre)}{P('CÓDIGO', a.codigo)}{P('CÓDIGO ANTERIOR', a.codigo_anterior)}{P('ID INTERNO', a.id)}{P('TIPO', tipo?.nombre)}{P('NIVEL', a.nivel)}
          {P('UBICACIÓN / ÁREA', a.area)}{P('UBICACIÓN FÍSICA', a.ubicacion_fisica)}{P('PERTENECE A', ancestors(idx, a.id).map(p => p.codigo || p.nombre).join(' › '))}
        </tbody></table>
        <div className="hv-qr"><QR text={assetUrl(a.id)} size={110} /><small>{a.id}</small></div>
      </div>
      <h4>1. INFORMACIÓN GENERAL</h4>
      <table className="hv-t two"><tbody>
        <tr><th>MARCA</th><td>{val(a.marca)}</td><th>MODELO</th><td>{val(a.modelo)}</td></tr>
        <tr><th>SERIE</th><td>{val(a.serie)}</td><th>FABRICANTE</th><td>{val(a.fabricante)}</td></tr>
        <tr><th>FECHA DE COMPRA/ADQUISICIÓN</th><td>{val(a.fecha_adquisicion)}</td><th>AÑO DE FABRICACIÓN</th><td>{val(a.anio_fabricacion)}</td></tr>
        <tr><th>ESPECIFICACIÓN TÉCNICA/CAPACIDAD</th><td>{val(a.especificacion_original)}</td><th>VIDA ÚTIL</th><td>{val(a.vida_util)}</td></tr>
        <tr><th>TECNOLOGÍA</th><td>{val(a.tecnologia)}</td><th>FUENTE DE ALIMENTACIÓN</th><td>{val(a.fuente_alimentacion)}</td></tr>
        <tr><th>FUNCIÓN PRINCIPAL</th><td>{val(a.funcion)}</td><th>RESPONSABLE</th><td>{val(a.responsable)}</td></tr>
        <tr><th>ESTADO DE VERIFICACIÓN</th><td>{a.estado_verificacion}{verif ? ` (${fmtDate(verif.fecha)})` : ''}</td><th>ESTADO OPERACIONAL</th><td>{val(a.estado_operacional)}</td></tr>
        <tr><th>CONDICIÓN ACTUAL</th><td>{val(a.condicion)}</td><th>CRITICIDAD</th><td>{a.criticidad || 'Pendiente de evaluación'}{crit && isTrue(crit.provisional) ? ' (provisional)' : ''}</td></tr>
        <tr><th>COMPLETITUD DE INFORMACIÓN</th><td>{completitud(db, a, idx).pct}%</td><th>ORIGEN</th><td>{a.origen === 'IMPORTADO' ? 'Inventario histórico (pendiente de validación)' : 'Levantamiento en campo'}</td></tr>
      </tbody></table>
      {campos.length > 0 && <><h4>2. DATOS TÉCNICOS</h4><table className="hv-t"><thead><tr><th>Parámetro</th><th>Valor</th><th>Fuente</th></tr></thead><tbody>
        {campos.map(c => { const d = datos.find(x => x.campo_id === c.id); if (d && isTrue(d.no_aplica)) return null; return <tr key={c.id}><td>{c.etiqueta}</td><td>{d && d.valor !== '' ? `${d.valor} ${d.unidad || c.unidad || ''}` : <span className="pend">Pendiente</span>}</td><td>{d?.fuente || ''}</td></tr>; })}</tbody></table></>}
      <h4>3. COMPONENTES Y RELACIONES</h4>
      <table className="hv-t"><tbody>{hijos.map(h => <tr key={h.id}><td>{h.codigo || h.id}</td><td>{h.nombre}</td><td>{h.nivel}</td><td>{h.condicion}</td></tr>)}
        {rels.map(r => <tr key={r.id}><td colSpan={4}>{idx.byId.get(r.origen_id)?.nombre} — <i>{r.tipo}</i> — {idx.byId.get(r.destino_id)?.nombre}</td></tr>)}
        {!hijos.length && !rels.length && <tr><td className="pend">Sin componentes ni relaciones registrados</td></tr>}</tbody></table>
      {crit && <><h4>4. CRITICIDAD</h4><table className="hv-t two"><tbody><tr><th>Resultado</th><td>{crit.resultado}</td><th>Puntaje IC×IP</th><td>{crit.puntaje_total}</td></tr><tr><th>Evaluador / fecha</th><td>{crit.evaluador} · {fmtDate(crit.fecha)}</td><th>Metodología</th><td>{crit.version_metodologia}</td></tr><tr><th>Justificación</th><td colSpan={3}>{crit.justificacion}</td></tr></tbody></table></>}
      <h4>5. INSPECCIONES Y HALLAZGOS</h4>
      <table className="hv-t"><tbody>{insps.slice(0, 10).map(i => <tr key={i.id}><td>{fmtDate(i.fecha)}</td><td>{i.condicion_general}</td><td>{i.observaciones}</td><td>{i.usuario}</td></tr>)}
        {halls.map(h => <tr key={h.id}><td>{fmtDate(h.fecha)}</td><td>{isTrue(h.riesgo_seguridad) ? '⚠️ ' : ''}{h.severidad}</td><td>{h.descripcion}</td><td>{h.estado}</td></tr>)}
        {!insps.length && !halls.length && <tr><td className="pend">Sin registros</td></tr>}</tbody></table>
      <h4>6. MANTENIMIENTO PREVENTIVO (histórico / preliminar — pendiente de validación)</h4>
      <table className="hv-t"><thead><tr><th>Actividad</th><th>Consumible</th><th>Descripción</th><th>Frecuencia (días)</th></tr></thead><tbody>{mant.map(m => <tr key={m.id}><td>{m.actividad}</td><td>{m.consumible}</td><td>{m.descripcion}</td><td>{m.frecuencia_dias}</td></tr>)}{!mant.length && <tr><td colSpan={4} className="pend">Sin actividades registradas</td></tr>}</tbody></table>
      <h4>7. REPUESTOS Y DOCUMENTACIÓN</h4>
      <table className="hv-t"><tbody>{reps.map(r => { const rp = db.REPUESTOS.find(x => x.id === r.repuesto_id); return <tr key={r.id}><td>{rp?.codigo}</td><td>{rp?.descripcion}</td><td>{r.tipo}</td><td>{r.cantidad}</td></tr>; })}
        {docs.map(d => <tr key={d.id}><td>{d.tipo_documento}</td><td colSpan={3}>{d.nombre_archivo}</td></tr>)}{!reps.length && !docs.length && <tr><td className="pend">Sin registros</td></tr>}</tbody></table>
      <p className="hv-foot">Generado el {new Date().toLocaleString('es-CO')} desde el sistema de gestión de activos. Los campos «Pendiente» aún no han sido identificados en campo.</p>
    </div>
  </div>;
}
