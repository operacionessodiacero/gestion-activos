import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { catalog, NIVELES, CONDICIONES, FUENTES_INFO, Row, wouldCycle } from '../domain';
import { AssetPicker, Field, Select } from '../components/ui';
import { suggestCode, isCodeTaken } from '../coding';

export function AssetForm({ initial, onSaved, quick: quickInit }: { initial?: Row; onSaved?: (r: Row) => void; quick?: boolean }) {
  const { db, idx, save, toast, can } = useApp();
  const isEdit = !!initial?.id && !String(initial.id).startsWith('tmp:');
  const [quick, setQuick] = useState(!!quickInit && !isEdit);
  const [r, setR] = useState<Row>(() => ({ nivel: 'Equipo', estado_operacional: '', condicion: 'No evaluada', fuente_info: 'Verificada', ...(initial || {}) }));
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setR(x => ({ ...x, [k]: v }));
  const parent = r.padre_id ? idx.byId.get(r.padre_id) : null;
  const sugerido = useMemo(() => suggestCode(db, { area: r.area || parent?.area, tipo_id: r.tipo_id, padre_id: r.padre_id, prueba: r.es_prueba === true }), [db, r.area, r.tipo_id, r.padre_id, r.es_prueba, parent]);
  const tipo = db.TIPOS_ACTIVOS.find(t => t.id === r.tipo_id);
  if (!can('ACTIVOS')) return <div className="alert warn">Su rol no permite crear ni editar activos.</div>;

  async function submit(borrador: boolean) {
    if (!String(r.nombre || '').trim()) { toast('El nombre es obligatorio', 'error'); return; }
    if (r.codigo && isCodeTaken(db, r.codigo, r.id)) { toast(`El código ${r.codigo} ya existe`, 'error'); return; }
    if (isEdit && r.padre_id && wouldCycle(idx, r.id, r.padre_id)) { toast('Relación circular: el padre seleccionado es descendiente de este activo', 'error'); return; }
    setSaving(true);
    try {
      const rec: Row = { ...r, borrador, area: r.area || parent?.area || '', proceso: r.proceso || parent?.proceso || '' };
      delete rec._pendiente; delete rec._row;
      if (!isEdit) rec.estado_verificacion = 'Incorporado en levantamiento';
      const out = await save('ACTIVOS', rec, { version: isEdit ? Number(initial!.version) : undefined, label: `${isEdit ? 'Editar' : 'Nuevo'} activo ${rec.nombre}` });
      toast(borrador ? 'Borrador guardado' : 'Activo guardado');
      onSaved?.(out);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  }

  const areas = catalog(db, 'area');
  return <div className="form">
    {!isEdit && <div className="seg"><button className={quick ? 'sel' : ''} onClick={() => setQuick(true)}>Formulario rápido</button><button className={!quick ? 'sel' : ''} onClick={() => setQuick(false)}>Formulario completo</button></div>}
    <div className="grid-form">
      <Field label="Nombre *" wide><input value={r.nombre || ''} onChange={e => set('nombre', e.target.value)} placeholder="Ej.: Motor eléctrico principal desbaste" /></Field>
      <Field label="Tipo / familia"><Select value={r.tipo_id} onChange={v => { set('tipo_id', v); const t = db.TIPOS_ACTIVOS.find(x => x.id === v); if (t && !isEdit) set('nivel', t.nivel_sugerido); }} options={db.TIPOS_ACTIVOS.map(t => [t.id, t.nombre] as [string, string])} /></Field>
      <Field label="Nivel jerárquico"><Select value={r.nivel} onChange={v => set('nivel', v)} options={NIVELES} /></Field>
      <Field label="Pertenece a (activo padre)" wide><AssetPicker value={r.padre_id || ''} onChange={v => set('padre_id', v)} exclude={a => isEdit && (a.id === r.id || wouldCycle(idx, r.id, a.id))} /></Field>
      <Field label="Área"><Select value={r.area || parent?.area || ''} onChange={v => set('area', v)} options={areas} /></Field>
      <Field label="Código visible" hint={`Sugerido: ${sugerido}`}>
        <div className="row"><input value={r.codigo || ''} onChange={e => set('codigo', e.target.value.toUpperCase())} className={r.codigo && isCodeTaken(db, r.codigo, r.id) ? 'invalid' : ''} /><button type="button" className="sm" onClick={() => set('codigo', sugerido)}>Usar</button></div></Field>
      <Field label="Ubicación física"><input value={r.ubicacion_fisica || ''} onChange={e => set('ubicacion_fisica', e.target.value)} /></Field>
      <Field label="Estado operacional"><Select value={r.estado_operacional} onChange={v => set('estado_operacional', v)} options={catalog(db, 'estado_operacional')} /></Field>
      <Field label="Condición física"><Select value={r.condicion} onChange={v => set('condicion', v)} options={CONDICIONES} /></Field>
      {!quick && <>
        <Field label="Código anterior / histórico"><input value={r.codigo_anterior || ''} onChange={e => set('codigo_anterior', e.target.value)} /></Field>
        <Field label="Proceso"><input value={r.proceso || ''} onChange={e => set('proceso', e.target.value)} /></Field>
        <Field label="Clasificación"><input value={r.clasificacion || ''} onChange={e => set('clasificacion', e.target.value)} /></Field>
        <Field label="Función principal" wide><input value={r.funcion || ''} onChange={e => set('funcion', e.target.value)} /></Field>
        <Field label="Descripción" wide><textarea rows={2} value={r.descripcion || ''} onChange={e => set('descripcion', e.target.value)} /></Field>
        <Field label="Fabricante"><input value={r.fabricante || ''} onChange={e => set('fabricante', e.target.value)} /></Field>
        <Field label="Marca"><input value={r.marca || ''} onChange={e => set('marca', e.target.value)} /></Field>
        <Field label="Modelo"><input value={r.modelo || ''} onChange={e => set('modelo', e.target.value)} /></Field>
        <Field label="Número de serie"><input value={r.serie || ''} onChange={e => set('serie', e.target.value)} /></Field>
        <Field label="País de fabricación"><input value={r.pais_fabricacion || ''} onChange={e => set('pais_fabricacion', e.target.value)} /></Field>
        <Field label="Año de fabricación"><input value={r.anio_fabricacion || ''} onChange={e => set('anio_fabricacion', e.target.value)} /></Field>
        <Field label="Fecha de adquisición"><input type="date" value={String(r.fecha_adquisicion || '').slice(0, 10)} onChange={e => set('fecha_adquisicion', e.target.value)} /></Field>
        <Field label="Fecha de instalación"><input type="date" value={String(r.fecha_instalacion || '').slice(0, 10)} onChange={e => set('fecha_instalacion', e.target.value)} /></Field>
        <Field label="Puesta en servicio"><input type="date" value={String(r.fecha_puesta_servicio || '').slice(0, 10)} onChange={e => set('fecha_puesta_servicio', e.target.value)} /></Field>
        <Field label="Proveedor"><input value={r.proveedor || ''} onChange={e => set('proveedor', e.target.value)} /></Field>
        <Field label="Vida útil"><input value={r.vida_util || ''} onChange={e => set('vida_util', e.target.value)} /></Field>
        <Field label="Tecnología"><Select value={r.tecnologia} onChange={v => set('tecnologia', v)} options={catalog(db, 'tecnologia')} /></Field>
        <Field label="Fuente de alimentación"><Select value={r.fuente_alimentacion} onChange={v => set('fuente_alimentacion', v)} options={catalog(db, 'fuente_alimentacion')} /></Field>
        <Field label="Responsable"><input value={r.responsable || ''} onChange={e => set('responsable', e.target.value)} /></Field>
        <Field label="Origen de la información"><Select value={r.fuente_info} onChange={v => set('fuente_info', v)} options={FUENTES_INFO} /></Field>
      </>}
      <Field label="Observaciones" wide><textarea rows={2} value={r.observaciones || ''} onChange={e => set('observaciones', e.target.value)} /></Field>
      <div className="wide row">
        <label className="chk"><input type="checkbox" checked={r.es_prueba === true || r.es_prueba === 'true'} onChange={e => set('es_prueba', e.target.checked)} disabled={isEdit} /> Registro de PRUEBA (no se mezcla con el inventario real)</label>
        <label className="chk"><input type="checkbox" checked={r.es_generico === true || r.es_generico === 'true'} onChange={e => set('es_generico', e.target.checked)} /> Registro genérico (agrupa varios equipos)</label>
      </div>
    </div>
    {tipo && <p className="small muted">La ficha técnica de «{tipo.nombre}» mostrará los grupos: {String(tipo.grupos_campos).replace(/,/g, ', ')}.</p>}
    <div className="row end sticky-actions">
      <button disabled={saving} onClick={() => submit(true)}>💾 Guardar borrador</button>
      <button className="primary" disabled={saving} onClick={() => submit(false)}>{saving ? 'Guardando…' : '✔ Guardar'}</button>
    </div>
  </div>;
}

export default function NuevoActivo() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const { idx } = useApp();
  const padre = sp.get('padre') || '';
  const p = padre ? idx.byId.get(padre) : null;
  return <div className="page">
    <div className="page-h"><h2>Registro de nuevo activo</h2></div>
    <p className="muted">Los activos creados aquí quedan identificados como <b>incorporados durante el levantamiento</b>. Puede guardar como borrador y completar después.</p>
    <AssetForm quick={sp.get('rapido') === '1' || !!padre} initial={{ padre_id: padre, area: p?.area || '', proceso: p?.proceso || '', es_prueba: p ? p.es_prueba === true || p.es_prueba === 'true' : false, nivel: p ? nextLevel(p.nivel) : 'Equipo' }}
      onSaved={r => nav('/activo/' + r.id)} />
  </div>;
}

export function nextLevel(n: string) {
  const L = ['Empresa', 'Planta', 'Área', 'Proceso', 'Línea de producción', 'Sistema', 'Subsistema', 'Máquina', 'Equipo', 'Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible'];
  const i = L.indexOf(n); return i >= 0 && i < L.length - 1 ? L[i + 1] : 'Componente';
}
