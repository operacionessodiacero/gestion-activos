/**
 * GESTIÓN DE ACTIVOS INDUSTRIALES — Backend (Google Apps Script)
 * ---------------------------------------------------------------
 * API JSON consumida por el frontend (GitHub Pages).
 * Almacenamiento: Google Sheets (una hoja por tabla) + Google Drive (archivos).
 *
 * Seguridad:
 *  - El frontend envía un ID token de Google (Google Identity Services).
 *  - El backend lo valida contra oauth2.googleapis.com/tokeninfo, comprueba la
 *    audiencia (CLIENT_ID en Propiedades del script) y busca el correo en la
 *    hoja USUARIOS (rol + activo). Sin usuario autorizado no hay acceso.
 *  - La hoja y la carpeta NO se hacen públicas: el script se ejecuta como su dueño.
 *
 * Instalación (una sola vez, desde el editor de Apps Script):
 *  1. Propiedades del script: SPREADSHEET_ID, ROOT_FOLDER_ID, CLIENT_ID, ADMIN_EMAIL.
 *  2. Ejecutar instalar()  -> respaldo + hojas nuevas + catálogos + carpetas.
 *  3. Implementar > Nueva implementación > Aplicación web
 *     (Ejecutar como: Yo; Quién tiene acceso: Cualquier usuario).
 *     El acceso real lo controla la validación del token + USUARIOS.
 */

var APP_VERSION = '1.0.0';
var METODOLOGIA_CRITICIDAD = 'MC-1.0';

/* ============================== ESQUEMA ============================== */

var BASE_COLS = ['creado_en', 'creado_por', 'actualizado_en', 'actualizado_por', 'version', 'eliminado'];

var SCHEMA = {
  ACTIVOS: { pk: 'id', prefix: 'ACT', cols: ['id', 'codigo', 'codigo_anterior', 'nombre', 'tipo_id', 'nivel', 'clasificacion', 'descripcion', 'padre_id', 'area', 'proceso', 'ubicacion_fisica', 'funcion', 'fabricante', 'marca', 'modelo', 'serie', 'pais_fabricacion', 'anio_fabricacion', 'fecha_adquisicion', 'fecha_instalacion', 'fecha_puesta_servicio', 'proveedor', 'vida_util', 'tecnologia', 'fuente_alimentacion', 'especificacion_original', 'riesgo_original', 'estado_verificacion', 'estado_operacional', 'condicion', 'criticidad', 'responsable', 'observaciones', 'origen', 'es_prueba', 'es_generico', 'borrador', 'etapas', 'fuente_info', 'foto_principal_id', 'carpeta_drive_id', 'import_key', 'client_uuid'] },
  JERARQUIA: { pk: 'id', prefix: 'JER', cols: ['id', 'activo_id', 'padre_anterior_id', 'padre_nuevo_id', 'motivo', 'client_uuid'] },
  RELACIONES: { pk: 'id', prefix: 'REL', cols: ['id', 'origen_id', 'tipo', 'destino_id', 'descripcion', 'client_uuid'] },
  TIPOS_ACTIVOS: { pk: 'id', prefix: 'TIP', cols: ['id', 'nombre', 'familia', 'nivel_sugerido', 'grupos_campos', 'descripcion'] },
  CAMPOS_TECNICOS: { pk: 'id', prefix: 'CAM', cols: ['id', 'grupo', 'etiqueta', 'tipo_dato', 'unidad', 'opciones', 'familias', 'orden', 'obligatorio'] },
  DATOS_TECNICOS: { pk: 'id', prefix: 'DT', cols: ['id', 'activo_id', 'campo_id', 'valor', 'unidad', 'fuente', 'no_aplica', 'justificacion', 'client_uuid'] },
  VERIFICACIONES: { pk: 'id', prefix: 'VER', cols: ['id', 'activo_id', 'fecha', 'usuario', 'resultado', 'ubicacion_encontrada', 'estado_fisico', 'estado_operacional', 'codigo_existente', 'codigo_asignado', 'observaciones', 'pendiente', 'client_uuid'] },
  INSPECCIONES: { pk: 'id', prefix: 'INS', cols: ['id', 'activo_id', 'fecha', 'usuario', 'criterios', 'condicion_general', 'observaciones', 'recomendaciones', 'client_uuid'] },
  HALLAZGOS: { pk: 'id', prefix: 'HAL', cols: ['id', 'activo_id', 'inspeccion_id', 'fecha', 'usuario', 'criterio', 'descripcion', 'severidad', 'riesgo_seguridad', 'recomendacion', 'necesidad_intervencion', 'estado', 'client_uuid'] },
  CRITICIDAD: { pk: 'id', prefix: 'CRI', cols: ['id', 'activo_id', 'fecha', 'evaluador', 'version_metodologia', 'puntajes', 'justificacion', 'evidencia', 'indice_consecuencia', 'indice_probabilidad', 'puntaje_total', 'resultado', 'regla_aplicada', 'provisional', 'fecha_revision', 'vigente', 'client_uuid'] },
  CRITERIOS_CRITICIDAD: { pk: 'id', prefix: 'CC', cols: ['id', 'nombre', 'descripcion', 'grupo', 'peso', 'escala', 'regla_especial', 'orden'] },
  FOTOGRAFIAS: { pk: 'id', prefix: 'FOT', cols: ['id', 'activo_id', 'categoria', 'drive_id', 'url', 'nombre_archivo', 'carpeta_id', 'fecha', 'usuario', 'descripcion', 'ref_tipo', 'ref_id', 'client_uuid'] },
  DOCUMENTOS: { pk: 'id', prefix: 'DOC', cols: ['id', 'activo_id', 'tipo_documento', 'drive_id', 'url', 'nombre_archivo', 'carpeta_id', 'fecha', 'usuario', 'descripcion', 'client_uuid'] },
  REPUESTOS: { pk: 'id', prefix: 'REP', cols: ['id', 'codigo', 'descripcion', 'fabricante', 'referencia_comercial', 'numero_parte', 'especificaciones', 'unidad', 'proveedores', 'disponibilidad', 'tiempo_adquisicion_dias', 'costo_estimado', 'criticidad', 'client_uuid'] },
  ACTIVOS_REPUESTOS: { pk: 'id', prefix: 'AR', cols: ['id', 'activo_id', 'repuesto_id', 'tipo', 'cantidad', 'observaciones', 'client_uuid'] },
  MANTENIMIENTO_BASE: { pk: 'id', prefix: 'MB', cols: ['id', 'activo_id', 'maquina_original', 'proceso', 'actividad', 'consumible', 'descripcion', 'frecuencia_dias', 'estado_validacion', 'observacion_import', 'import_key'] },
  UBICACIONES: { pk: 'id', prefix: 'UBI', cols: ['id', 'nombre', 'tipo', 'padre_id', 'descripcion'] },
  CATALOGOS: { pk: 'id', prefix: 'CAT', cols: ['id', 'lista', 'valor', 'orden', 'activo'] },
  USUARIOS: { pk: 'email', cols: ['email', 'nombre', 'rol', 'activo'] },
  AUDITORIA: { pk: 'id', prefix: 'AUD', noBase: true, cols: ['id', 'fecha', 'usuario', 'tabla', 'registro_id', 'accion', 'campo', 'valor_anterior', 'valor_nuevo'] },
  CONFIGURACION: { pk: 'clave', cols: ['clave', 'valor', 'descripcion'] },
  IMPORTACIONES: { pk: 'id', prefix: 'IMP', cols: ['id', 'lote', 'archivo', 'hoja_origen', 'fila_origen', 'codigo_origen', 'registro_destino', 'tabla_destino', 'accion', 'hash', 'datos_originales', 'observaciones'] }
};

/** Permisos por rol: tablas que puede escribir. '*' = todas. */
var ROLES = {
  ADMINISTRADOR: { write: '*', admin: true },
  INGENIERO: { write: ['ACTIVOS', 'JERARQUIA', 'RELACIONES', 'DATOS_TECNICOS', 'VERIFICACIONES', 'INSPECCIONES', 'HALLAZGOS', 'CRITICIDAD', 'FOTOGRAFIAS', 'DOCUMENTOS', 'REPUESTOS', 'ACTIVOS_REPUESTOS', 'MANTENIMIENTO_BASE', 'TIPOS_ACTIVOS', 'CAMPOS_TECNICOS'] },
  INSPECTOR: { write: ['ACTIVOS', 'JERARQUIA', 'RELACIONES', 'DATOS_TECNICOS', 'VERIFICACIONES', 'INSPECCIONES', 'HALLAZGOS', 'FOTOGRAFIAS', 'DOCUMENTOS', 'ACTIVOS_REPUESTOS', 'REPUESTOS'] },
  CONSULTA: { write: [] }
};
/** Tablas que nunca se envían al cliente en bootstrap (se consultan aparte). */
var PRIVATE_TABLES = ['AUDITORIA', 'IMPORTACIONES'];

/* ============================== UTILIDADES ============================== */

function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k) { var v = props_().getProperty(k); if (!v) throw new Error('Falta la propiedad del script ' + k); return v; }
function ss_() { return SpreadsheetApp.openById(prop_('SPREADSHEET_ID')); }
function now_() { return new Date().toISOString(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function pad_(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
function isTrue_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 'SI' || v === 1; }
function str_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}
function slug_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
}

/* ============================== CAPA DE DATOS ============================== */
/* Toda la lectura/escritura pasa por estas funciones (fácil de sustituir por SQL). */

function cols_(table) {
  var s = SCHEMA[table]; if (!s) throw new Error('Tabla desconocida: ' + table);
  return s.noBase ? s.cols : s.cols.concat(BASE_COLS);
}

function sheet_(table) {
  var sh = ss_().getSheetByName(table);
  if (!sh) throw new Error('La hoja ' + table + ' no existe. Ejecute instalar().');
  return sh;
}

/** Lee la tabla completa como objetos. Usa encabezados reales de la hoja. */
function readAll_(table, includeDeleted) {
  var sh = sheet_(table);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i], o = { _row: i + 1 }, empty = true;
    for (var j = 0; j < head.length; j++) {
      if (!head[j]) continue;
      var v = row[j];
      if (v instanceof Date) v = v.toISOString();
      if (v !== '' && v !== null) empty = false;
      o[head[j]] = v;
    }
    if (empty) continue;
    if (!includeDeleted && isTrue_(o.eliminado)) continue;
    out.push(o);
  }
  return out;
}

function headerMap_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var m = {}; head.forEach(function (h, i) { if (h) m[h] = i; });
  return { head: head, map: m };
}

function nextId_(table) {
  var s = SCHEMA[table];
  var key = 'SEQ_' + table;
  var p = props_();
  var n = Number(p.getProperty(key) || 0);
  if (!n) { // inicializar desde los datos existentes
    readAll_(table, true).forEach(function (r) {
      var m = String(r[s.pk] || '').match(/(\d+)$/); if (m) n = Math.max(n, Number(m[1]));
    });
  }
  n++;
  p.setProperty(key, String(n));
  return s.prefix + '-' + pad_(n, 6);
}

function audit_(user, table, id, action, field, before, after) {
  var sh = sheet_('AUDITORIA');
  var key = 'SEQ_AUDITORIA', p = props_();
  var n = Number(p.getProperty(key) || sh.getLastRow()) + 1; p.setProperty(key, String(n));
  sh.appendRow(['AUD-' + pad_(n, 8), now_(), user, table, id, action, field || '', String(str_(before)).substring(0, 5000), String(str_(after)).substring(0, 5000)]);
}

/** Inserta un registro. Idempotente por client_uuid y por import_key. */
function insert_(table, rec, user, opts) {
  opts = opts || {};
  var s = SCHEMA[table], sh = sheet_(table), hm = headerMap_(sh);
  var all = null;
  if (rec.client_uuid && hm.map.client_uuid !== undefined) {
    all = all || readAll_(table, true);
    var dup = all.filter(function (r) { return r.client_uuid && r.client_uuid === rec.client_uuid; })[0];
    if (dup) return { record: dup, duplicate: true };
  }
  if (s.pk === 'id' || !rec[s.pk]) rec[s.pk] = rec[s.pk] && opts.keepId ? rec[s.pk] : (s.prefix ? nextId_(table) : rec[s.pk]);
  if (!s.noBase) {
    rec.creado_en = now_(); rec.creado_por = user; rec.actualizado_en = rec.creado_en; rec.actualizado_por = user;
    rec.version = 1; rec.eliminado = false;
  }
  var row = hm.head.map(function (h) { return h ? str_(rec[h]) : ''; });
  sh.appendRow(row);
  if (!opts.noAudit) audit_(user, table, rec[s.pk], 'CREAR', '', '', JSON.stringify(rec).substring(0, 5000));
  return { record: rec, duplicate: false };
}

/** Actualiza campos con control de concurrencia optimista (version). */
function update_(table, id, changes, user, expectedVersion, opts) {
  opts = opts || {};
  var s = SCHEMA[table], sh = sheet_(table), hm = headerMap_(sh);
  var rows = readAll_(table, true);
  var cur = rows.filter(function (r) { return String(r[s.pk]) === String(id); })[0];
  if (!cur) throw new Error('Registro no encontrado: ' + table + ' ' + id);
  if (expectedVersion && !s.noBase && Number(cur.version) !== Number(expectedVersion)) {
    var err = new Error('CONFLICTO: el registro ' + id + ' fue modificado por ' + cur.actualizado_por + ' el ' + cur.actualizado_en + '. Recargue antes de guardar.');
    err.code = 'CONFLICT'; throw err;
  }
  var protectedCols = [s.pk, 'creado_en', 'creado_por', 'version', 'client_uuid'];
  var line = sh.getRange(cur._row, 1, 1, hm.head.length).getValues()[0];
  var changed = [];
  Object.keys(changes).forEach(function (k) {
    if (protectedCols.indexOf(k) >= 0 || hm.map[k] === undefined || k.charAt(0) === '_') return;
    var nv = str_(changes[k]);
    var ov = line[hm.map[k]]; if (ov instanceof Date) ov = ov.toISOString();
    if (String(ov) === String(nv)) return;
    line[hm.map[k]] = nv; cur[k] = nv;
    changed.push([k, ov, nv]);
  });
  if (!changed.length) return { record: cur, changed: 0 };
  if (!s.noBase) {
    cur.version = Number(cur.version || 0) + 1; cur.actualizado_en = now_(); cur.actualizado_por = user;
    line[hm.map.version] = cur.version; line[hm.map.actualizado_en] = cur.actualizado_en; line[hm.map.actualizado_por] = user;
  }
  sh.getRange(cur._row, 1, 1, hm.head.length).setValues([line]);
  if (!opts.noAudit) changed.forEach(function (c) { audit_(user, table, id, opts.action || 'MODIFICAR', c[0], c[1], c[2]); });
  return { record: cur, changed: changed.length };
}

/* ============================== AUTENTICACIÓN ============================== */

function verifyToken_(token) {
  if (!token) throw new Error('AUTH: falta el token de sesión.');
  var digest = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var cache = CacheService.getScriptCache();
  var hit = cache.get('tok_' + digest);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('AUTH: sesión inválida o vencida. Inicie sesión de nuevo.');
  var info = JSON.parse(res.getContentText());
  if (info.aud !== prop_('CLIENT_ID')) throw new Error('AUTH: token emitido para otra aplicación.');
  if (String(info.email_verified) !== 'true') throw new Error('AUTH: correo no verificado.');
  if (Number(info.exp) * 1000 < Date.now()) throw new Error('AUTH: sesión vencida.');
  var who = { email: String(info.email).toLowerCase(), nombre: info.name || info.email, foto: info.picture || '' };
  var ttl = Math.max(1, Math.min(600, Math.floor((Number(info.exp) * 1000 - Date.now()) / 1000)));
  cache.put('tok_' + digest, JSON.stringify(who), ttl);
  return who;
}

function getUser_(who) {
  var admin = (props_().getProperty('ADMIN_EMAIL') || '').toLowerCase();
  var u = readAll_('USUARIOS').filter(function (r) { return String(r.email).toLowerCase() === who.email; })[0];
  if (u && isTrue_(u.activo) && ROLES[u.rol]) return { email: who.email, nombre: u.nombre || who.nombre, rol: u.rol, foto: who.foto };
  if (who.email === admin) return { email: who.email, nombre: who.nombre, rol: 'ADMINISTRADOR', foto: who.foto };
  var e = new Error('ACCESO DENEGADO: ' + who.email + ' no está autorizado. Solicite acceso al administrador.'); e.code = 'FORBIDDEN'; throw e;
}

function canWrite_(user, table) {
  var r = ROLES[user.rol]; if (!r) return false;
  return r.write === '*' || r.write.indexOf(table) >= 0;
}
function requireWrite_(user, table) {
  if (!canWrite_(user, table)) { var e = new Error('PERMISO: el rol ' + user.rol + ' no puede modificar ' + table + '.'); e.code = 'FORBIDDEN'; throw e; }
}
function requireAdmin_(user) {
  if (!ROLES[user.rol].admin) { var e = new Error('PERMISO: requiere rol ADMINISTRADOR.'); e.code = 'FORBIDDEN'; throw e; }
}

/* ============================== ENTRADA HTTP ============================== */

function doGet(e) {
  return json_({ ok: true, app: 'Gestión de Activos', version: APP_VERSION, mensaje: 'API activa. Use POST con token.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Solicitud inválida' }); }
  try {
    var who = verifyToken_(req.token);
    var user = getUser_(who);
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Acción desconocida: ' + req.action);
    var needsLock = WRITE_ACTIONS.indexOf(req.action) >= 0;
    var lock = null;
    if (needsLock) { lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) throw new Error('Servidor ocupado, intente de nuevo.'); }
    try {
      var data = fn(req.payload || {}, user);
      if (needsLock) SpreadsheetApp.flush();
      return json_({ ok: true, data: data, user: user });
    } finally { if (lock) lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err), code: err.code || '' });
  }
}

var WRITE_ACTIONS = ['save', 'remove', 'restore', 'setParent', 'verify', 'uploadFile', 'saveCriticality', 'importBatch', 'saveUser', 'saveConfig', 'createBackup', 'saveTechData', 'saveInspection'];

var ACTIONS = {
  /** Usuario actual. */
  me: function (p, user) { return user; },

  /** Carga inicial: todas las tablas operativas. */
  bootstrap: function (p, user) {
    var out = {};
    Object.keys(SCHEMA).forEach(function (t) {
      if (PRIVATE_TABLES.indexOf(t) >= 0) return;
      if (t === 'USUARIOS' && !ROLES[user.rol].admin) return;
      out[t] = readAll_(t).map(function (r) { delete r._row; return r; });
    });
    out._serverTime = now_();
    out._version = APP_VERSION;
    return out;
  },

  /** Lectura de una tabla (incluye auditoría para admin). */
  list: function (p, user) {
    if (PRIVATE_TABLES.indexOf(p.table) >= 0 || p.table === 'USUARIOS') requireAdmin_(user);
    var rows = readAll_(p.table, !!p.includeDeleted);
    if (p.filter) rows = rows.filter(function (r) { return Object.keys(p.filter).every(function (k) { return String(r[k]) === String(p.filter[k]); }); });
    if (p.limit) rows = rows.slice(-p.limit);
    return rows.map(function (r) { delete r._row; return r; });
  },

  /** Crear o actualizar un registro genérico. */
  save: function (p, user) {
    var t = p.table; requireWrite_(user, t);
    var rec = p.record || {};
    var pk = SCHEMA[t].pk;
    if (t === 'ACTIVOS') validateAsset_(rec, rec[pk]);
    if (t === 'RELACIONES') validateRelation_(rec);
    if (rec[pk] && t !== 'USUARIOS' && t !== 'CONFIGURACION') {
      return update_(t, rec[pk], rec, user.email, p.version).record;
    }
    if (t === 'ACTIVOS') {
      if (!rec.estado_verificacion) rec.estado_verificacion = 'Pendiente de verificación';
      if (!rec.origen) rec.origen = 'LEVANTAMIENTO';
    }
    var res = insert_(t, rec, user.email);
    if (t === 'ACTIVOS' && rec.padre_id && !res.duplicate) {
      insert_('JERARQUIA', { activo_id: res.record.id, padre_anterior_id: '', padre_nuevo_id: rec.padre_id, motivo: 'Creación' }, user.email, { noAudit: true });
    }
    return res.record;
  },

  /** Eliminación lógica. */
  remove: function (p, user) {
    requireWrite_(user, p.table);
    if (p.table === 'ACTIVOS') {
      var hijos = readAll_('ACTIVOS').filter(function (a) { return a.padre_id === p.id; });
      if (hijos.length) throw new Error('No se puede eliminar: el activo tiene ' + hijos.length + ' elemento(s) hijo(s). Muévalos primero.');
    }
    return update_(p.table, p.id, { eliminado: true }, user.email, null, { action: 'ELIMINAR' }).record;
  },

  /** Recuperar un registro eliminado lógicamente. */
  restore: function (p, user) {
    requireWrite_(user, p.table);
    return update_(p.table, p.id, { eliminado: false }, user.email, null, { action: 'RESTAURAR' }).record;
  },

  /** Cambiar padre en el árbol (con control de ciclos e historial). */
  setParent: function (p, user) {
    requireWrite_(user, 'ACTIVOS');
    var all = readAll_('ACTIVOS');
    checkCycle_(all, p.id, p.padre_id);
    var cur = all.filter(function (a) { return a.id === p.id; })[0];
    if (!cur) throw new Error('Activo no encontrado');
    var res = update_('ACTIVOS', p.id, { padre_id: p.padre_id || '' }, user.email, p.version).record;
    insert_('JERARQUIA', { activo_id: p.id, padre_anterior_id: cur.padre_id || '', padre_nuevo_id: p.padre_id || '', motivo: p.motivo || '' }, user.email, { noAudit: true });
    return res;
  },

  /** Verificación física en campo (rápida). Actualiza el activo y guarda historial. */
  verify: function (p, user) {
    requireWrite_(user, 'VERIFICACIONES');
    var v = p.verificacion || {};
    v.fecha = v.fecha || now_(); v.usuario = user.email;
    var ins = insert_('VERIFICACIONES', v, user.email);
    if (ins.duplicate) return { verificacion: ins.record, duplicate: true };
    var ch = { estado_verificacion: v.resultado };
    if (v.estado_operacional) ch.estado_operacional = v.estado_operacional;
    if (v.estado_fisico) ch.condicion = v.estado_fisico;
    if (v.ubicacion_encontrada) ch.ubicacion_fisica = v.ubicacion_encontrada;
    if (v.codigo_asignado) {
      var dup = readAll_('ACTIVOS').filter(function (a) { return a.id !== v.activo_id && String(a.codigo).toUpperCase() === String(v.codigo_asignado).toUpperCase(); })[0];
      if (dup) throw new Error('El código ' + v.codigo_asignado + ' ya está asignado a ' + dup.id + ' (' + dup.nombre + ').');
      ch.codigo = v.codigo_asignado;
    }
    var act = readAll_('ACTIVOS').filter(function (a) { return a.id === v.activo_id; })[0];
    if (act) {
      var et = parseJson_(act.etapas, {});
      if (['Existencia confirmada', 'Existe, pero presenta información incorrecta', 'Fuera de servicio', 'Trasladado', 'Desmontado'].indexOf(v.resultado) >= 0) et.existencia = true;
      if (v.ubicacion_encontrada) et.ubicacion = true;
      ch.etapas = JSON.stringify(et);
    }
    var a = update_('ACTIVOS', v.activo_id, ch, user.email, null, { action: 'VERIFICAR' }).record;
    return { verificacion: ins.record, activo: a };
  },

  /** Datos técnicos: upsert de varios valores para un activo. */
  saveTechData: function (p, user) {
    requireWrite_(user, 'DATOS_TECNICOS');
    var existing = readAll_('DATOS_TECNICOS').filter(function (d) { return d.activo_id === p.activo_id; });
    var out = [];
    (p.valores || []).forEach(function (v) {
      var cur = existing.filter(function (d) { return d.campo_id === v.campo_id; })[0];
      var rec = { activo_id: p.activo_id, campo_id: v.campo_id, valor: v.valor, unidad: v.unidad || '', fuente: v.fuente || 'Pendiente', no_aplica: !!v.no_aplica, justificacion: v.justificacion || '' };
      if (cur) out.push(update_('DATOS_TECNICOS', cur.id, rec, user.email).record);
      else if (v.valor !== '' || v.no_aplica) out.push(insert_('DATOS_TECNICOS', rec, user.email).record);
    });
    if (p.etapas) update_('ACTIVOS', p.activo_id, { etapas: JSON.stringify(p.etapas) }, user.email, null, { noAudit: false });
    return out;
  },

  /** Inspección + hallazgos en una sola transacción. */
  saveInspection: function (p, user) {
    requireWrite_(user, 'INSPECCIONES');
    var ins = p.inspeccion; ins.fecha = ins.fecha || now_(); ins.usuario = user.email;
    var r = insert_('INSPECCIONES', ins, user.email);
    if (r.duplicate) return { inspeccion: r.record, duplicate: true };
    var hs = (p.hallazgos || []).map(function (h) {
      h.activo_id = ins.activo_id; h.inspeccion_id = r.record.id; h.fecha = ins.fecha; h.usuario = user.email; h.estado = h.estado || 'Abierto';
      return insert_('HALLAZGOS', h, user.email).record;
    });
    if (ins.condicion_general) update_('ACTIVOS', ins.activo_id, { condicion: ins.condicion_general }, user.email);
    return { inspeccion: r.record, hallazgos: hs };
  },

  /** Criticidad: calcula en servidor (fuente de verdad), conserva historial. */
  saveCriticality: function (p, user) {
    requireWrite_(user, 'CRITICIDAD');
    var crit = readAll_('CRITERIOS_CRITICIDAD');
    var cfg = configMap_();
    var calc = computeCriticality_(crit, p.puntajes || {}, cfg);
    readAll_('CRITICIDAD').filter(function (c) { return c.activo_id === p.activo_id && isTrue_(c.vigente); })
      .forEach(function (c) { update_('CRITICIDAD', c.id, { vigente: false }, user.email, null, { noAudit: true }); });
    var rec = {
      activo_id: p.activo_id, fecha: now_(), evaluador: user.email, version_metodologia: cfg.metodologia_criticidad || METODOLOGIA_CRITICIDAD,
      puntajes: JSON.stringify(p.puntajes || {}), justificacion: p.justificacion || '', evidencia: p.evidencia || '',
      indice_consecuencia: calc.ic, indice_probabilidad: calc.ip, puntaje_total: calc.total, resultado: calc.resultado,
      regla_aplicada: calc.regla, provisional: calc.provisional, fecha_revision: p.fecha_revision || '', vigente: true, client_uuid: p.client_uuid
    };
    var r = insert_('CRITICIDAD', rec, user.email).record;
    var a = readAll_('ACTIVOS').filter(function (x) { return x.id === p.activo_id; })[0];
    var et = parseJson_(a && a.etapas, {}); et.criticidad = calc.resultado !== 'Pendiente de evaluación';
    update_('ACTIVOS', p.activo_id, { criticidad: calc.resultado, etapas: JSON.stringify(et) }, user.email);
    return r;
  },

  /** Subida de archivos a Drive (base64), con carpeta por activo y nombre normalizado. */
  uploadFile: function (p, user) {
    var isDoc = p.kind === 'DOCUMENTO';
    requireWrite_(user, isDoc ? 'DOCUMENTOS' : 'FOTOGRAFIAS');
    var table = isDoc ? 'DOCUMENTOS' : 'FOTOGRAFIAS';
    if (p.client_uuid) {
      var dup = readAll_(table, true).filter(function (r) { return r.client_uuid === p.client_uuid; })[0];
      if (dup) return dup;
    }
    var act = readAll_('ACTIVOS').filter(function (a) { return a.id === p.activo_id; })[0];
    if (!act) throw new Error('Activo no encontrado: ' + p.activo_id);
    var folder = assetSubfolder_(act, user.email, isDoc ? docFolderFor_(p.categoria) : photoFolderFor_(p.categoria));
    var ext = (String(p.filename || '').match(/\.([A-Za-z0-9]{1,6})$/) || [null, isDoc ? 'pdf' : 'jpg'])[1].toLowerCase();
    var code = slug_(act.codigo || act.id).replace(/_/g, '-');
    var tipo = slug_(p.categoria || (isDoc ? 'DOCUMENTO' : 'FOTO'));
    var ts = Utilities.formatDate(new Date(), cfgTz_(), 'yyyyMMdd_HHmmss');
    var base = code + '_' + tipo + '_' + ts + '_';
    var seq = 1, name;
    do { name = base + pad_(seq++, 3) + '.' + ext; } while (folder.getFilesByName(name).hasNext());
    var blob = Utilities.newBlob(Utilities.base64Decode(p.base64), p.mimeType || 'application/octet-stream', name);
    var file = folder.createFile(blob);
    file.setDescription('Activo ' + act.id + ' | ' + (act.codigo || '') + ' | ' + (act.nombre || '') + ' | ' + (p.descripcion || ''));
    var rec = {
      activo_id: act.id, drive_id: file.getId(), url: file.getUrl(), nombre_archivo: name, carpeta_id: folder.getId(),
      fecha: now_(), usuario: user.email, descripcion: p.descripcion || '', client_uuid: p.client_uuid
    };
    if (isDoc) rec.tipo_documento = p.categoria; else { rec.categoria = p.categoria; rec.ref_tipo = p.ref_tipo || ''; rec.ref_id = p.ref_id || ''; }
    var r = insert_(table, rec, user.email).record;
    if (!isDoc) {
      var et = parseJson_(act.etapas, {}); et.fotos = true; if (p.categoria === 'Placa de identificación') et.placa = true;
      var ch = { etapas: JSON.stringify(et) };
      if (!act.foto_principal_id && (p.categoria === 'Vista general' || !act.foto_principal_id)) ch.foto_principal_id = r.drive_id;
      update_('ACTIVOS', act.id, ch, user.email, null, { noAudit: true });
    }
    return r;
  },

  /** Imagen en miniatura (base64) para visualizar sin hacer públicos los archivos. */
  thumbnail: function (p, user) {
    var f = DriveApp.getFileById(p.drive_id);
    var desc = f.getDescription() || '';
    if (desc.indexOf('Activo ') !== 0) throw new Error('Archivo no pertenece a la aplicación.');
    var url = 'https://www.googleapis.com/drive/v3/files/' + p.drive_id + '?fields=thumbnailLink';
    var token = ScriptApp.getOAuthToken();
    var meta = JSON.parse(UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } }).getContentText());
    var blob;
    if (meta.thumbnailLink && !p.full) {
      blob = UrlFetchApp.fetch(meta.thumbnailLink.replace(/=s\d+$/, '=s' + (p.size || 640)), { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }).getBlob();
    } else { blob = f.getBlob(); }
    return { mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
  },

  /** Importación por lotes (repetible: clave import_key). Solo administrador. */
  importBatch: function (p, user) {
    requireAdmin_(user);
    return importBatch_(p, user);
  },

  /** Usuarios (solo administrador). */
  saveUser: function (p, user) {
    requireAdmin_(user);
    var u = p.user; u.email = String(u.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) throw new Error('Correo inválido');
    if (!ROLES[u.rol]) throw new Error('Rol inválido');
    var cur = readAll_('USUARIOS', true).filter(function (r) { return String(r.email).toLowerCase() === u.email; })[0];
    if (cur) return update_('USUARIOS', cur.email, u, user.email).record;
    u.activo = u.activo === undefined ? true : u.activo;
    return insert_('USUARIOS', u, user.email).record;
  },

  saveConfig: function (p, user) {
    requireAdmin_(user);
    var cur = readAll_('CONFIGURACION').filter(function (r) { return r.clave === p.clave; })[0];
    if (cur) return update_('CONFIGURACION', cur.clave, { valor: p.valor }, user.email).record;
    return insert_('CONFIGURACION', { clave: p.clave, valor: p.valor, descripcion: p.descripcion || '' }, user.email).record;
  },

  /** Respaldo manual (copia completa de la hoja en RESPALDOS). */
  createBackup: function (p, user) {
    requireAdmin_(user);
    return backup_(p.motivo || 'Manual');
  },

  audit: function (p, user) {
    var rows = readAll_('AUDITORIA');
    if (p.registro_id) rows = rows.filter(function (r) { return r.registro_id === p.registro_id; });
    else requireAdmin_(user);
    return rows.slice(-(p.limit || 500)).map(function (r) { delete r._row; return r; });
  },

  /** Hoja de vida en PDF guardada en Drive (REPORTES y carpeta del activo). */
  savePdf: function (p, user) {
    var act = readAll_('ACTIVOS').filter(function (a) { return a.id === p.activo_id; })[0];
    if (!act) throw new Error('Activo no encontrado');
    var blob = Utilities.newBlob(p.html, 'text/html', 'hv.html').getAs('application/pdf');
    var ts = Utilities.formatDate(new Date(), cfgTz_(), 'yyyyMMdd_HHmmss');
    blob.setName(slug_(act.codigo || act.id).replace(/_/g, '-') + '_HOJA-DE-VIDA_' + ts + '.pdf');
    var folder = assetSubfolder_(act, user.email, '08_HISTORIAL');
    var f = folder.createFile(blob);
    f.setDescription('Activo ' + act.id + ' | Hoja de vida generada por ' + user.email);
    return { drive_id: f.getId(), url: f.getUrl(), nombre: f.getName() };
  }
};

/* ============================== REGLAS DE NEGOCIO ============================== */

function parseJson_(s, d) { try { return s ? (typeof s === 'string' ? JSON.parse(s) : s) : d; } catch (e) { return d; } }

function validateAsset_(rec, id) {
  if (rec.nombre !== undefined && !String(rec.nombre).trim()) throw new Error('El nombre del activo es obligatorio.');
  if (rec.codigo) {
    var c = String(rec.codigo).trim().toUpperCase();
    var dup = readAll_('ACTIVOS').filter(function (a) { return a.id !== id && String(a.codigo).trim().toUpperCase() === c; })[0];
    if (dup) throw new Error('Código duplicado: ' + rec.codigo + ' ya pertenece a ' + dup.id + ' (' + dup.nombre + ').');
  }
  if (rec.padre_id !== undefined && id) checkCycle_(readAll_('ACTIVOS'), id, rec.padre_id);
  if (rec.padre_id) {
    var exists = readAll_('ACTIVOS').some(function (a) { return a.id === rec.padre_id; });
    if (!exists) throw new Error('El activo padre ' + rec.padre_id + ' no existe.');
  }
}

function checkCycle_(all, id, parentId) {
  if (!parentId) return;
  if (parentId === id) throw new Error('Relación circular: un activo no puede ser su propio padre.');
  var byId = {}; all.forEach(function (a) { byId[a.id] = a; });
  var cur = byId[parentId], guard = 0;
  while (cur && guard++ < 1000) {
    if (cur.id === id) throw new Error('Relación circular: ' + parentId + ' es descendiente de ' + id + '.');
    cur = cur.padre_id ? byId[cur.padre_id] : null;
  }
}

function validateRelation_(rec) {
  if (rec.id) return;
  if (!rec.origen_id || !rec.destino_id || !rec.tipo) throw new Error('Relación incompleta.');
  if (rec.origen_id === rec.destino_id) throw new Error('Un activo no puede relacionarse consigo mismo.');
  var dup = readAll_('RELACIONES').filter(function (r) { return r.origen_id === rec.origen_id && r.destino_id === rec.destino_id && r.tipo === rec.tipo; })[0];
  if (dup) throw new Error('La relación ya existe (' + dup.id + ').');
}

function configMap_() {
  var m = {}; readAll_('CONFIGURACION').forEach(function (r) { m[r.clave] = r.valor; }); return m;
}
function cfgTz_() { return props_().getProperty('TIMEZONE') || 'America/Bogota'; }

/**
 * Metodología semicuantitativa MC-1.0 (documentada en docs/METODOLOGIA_CRITICIDAD.md)
 *  - Cada criterio se califica 1..5; "null" = desconocido (NO se asume bajo).
 *  - IC = promedio ponderado de criterios del grupo CONSECUENCIA (conocidos).
 *  - IP = promedio ponderado de criterios del grupo PROBABILIDAD (conocidos).
 *  - Puntaje = IC × IP (1..25).
 *  - Umbrales configurables. Reglas especiales: SEGURIDAD/AMBIENTAL con 5 => MUY ALTA; con 4 => mínimo ALTA.
 *  - Si falta > umbral_desconocidos de los criterios => Pendiente de evaluación.
 *  - Si falta alguno o se marca preliminar => provisional = true.
 */
function computeCriticality_(criterios, puntajes, cfg) {
  var sum = { CONSECUENCIA: [0, 0], PROBABILIDAD: [0, 0] }, unknown = 0, total = 0, regla = [];
  var minRank = 0; // 0 baja,1 media,2 alta,3 muy alta
  criterios.forEach(function (c) {
    total++;
    var v = puntajes[c.id];
    if (v === null || v === undefined || v === '' || v === 'ND') { unknown++; return; }
    v = Number(v); var w = Number(c.peso || 1);
    var g = sum[c.grupo] || sum.CONSECUENCIA; g[0] += v * w; g[1] += w;
    if (c.regla_especial === 'SEGURIDAD_AMBIENTAL') {
      if (v >= 5) { minRank = Math.max(minRank, 3); regla.push(c.nombre + '=5 ⇒ Muy alta'); }
      else if (v >= 4) { minRank = Math.max(minRank, 2); regla.push(c.nombre + '=4 ⇒ mínimo Alta'); }
    }
  });
  var maxUnknown = Number(cfg.umbral_desconocidos || 0.4);
  if (!total || unknown / total > maxUnknown || !sum.CONSECUENCIA[1] || !sum.PROBABILIDAD[1]) {
    return { ic: '', ip: '', total: '', resultado: minRank >= 2 ? (minRank === 3 ? 'Muy alta' : 'Alta') : 'Pendiente de evaluación', regla: regla.join('; ') || 'Información insuficiente', provisional: true };
  }
  var ic = sum.CONSECUENCIA[0] / sum.CONSECUENCIA[1], ip = sum.PROBABILIDAD[0] / sum.PROBABILIDAD[1];
  var score = Math.round(ic * ip * 100) / 100;
  var uMA = Number(cfg.umbral_muy_alta || 16), uA = Number(cfg.umbral_alta || 10), uM = Number(cfg.umbral_media || 5);
  var rank = score >= uMA ? 3 : score >= uA ? 2 : score >= uM ? 1 : 0;
  if (minRank > rank) rank = minRank;
  var names = ['Baja', 'Media', 'Alta', 'Muy alta'];
  return { ic: Math.round(ic * 100) / 100, ip: Math.round(ip * 100) / 100, total: score, resultado: names[rank], regla: regla.join('; '), provisional: unknown > 0 || isTrue_(puntajes._preliminar) };
}

/* ============================== DRIVE ============================== */

var PHOTO_FOLDERS = ['01_FOTOGRAFIAS_GENERALES', '02_PLACAS_DE_IDENTIFICACION', '03_COMPONENTES', '04_HALLAZGOS', '05_MANUALES', '06_PLANOS', '07_FICHAS_TECNICAS', '08_HISTORIAL'];

function photoFolderFor_(cat) {
  if (cat === 'Placa de identificación') return '02_PLACAS_DE_IDENTIFICACION';
  if (['Componentes', 'Acoplamientos', 'Sistemas de transmisión', 'Conexiones eléctricas', 'Conexiones hidráulicas', 'Conexiones neumáticas'].indexOf(cat) >= 0) return '03_COMPONENTES';
  if (['Daños', 'Desgaste', 'Hallazgos'].indexOf(cat) >= 0) return '04_HALLAZGOS';
  if (['Antes de intervención', 'Después de intervención'].indexOf(cat) >= 0) return '08_HISTORIAL';
  return '01_FOTOGRAFIAS_GENERALES';
}
function docFolderFor_(cat) {
  if (['Manual', 'Catálogo', 'Documento del fabricante'].indexOf(cat) >= 0) return '05_MANUALES';
  if (['Plano mecánico', 'Diagrama eléctrico', 'Diagrama hidráulico', 'Diagrama neumático'].indexOf(cat) >= 0) return '06_PLANOS';
  if (['Ficha técnica', 'Listado de repuestos', 'Certificado'].indexOf(cat) >= 0) return '07_FICHAS_TECNICAS';
  return '08_HISTORIAL';
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function appRoot_() {
  var root = DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'));
  return childFolder_(root, 'GESTION_DE_ACTIVOS');
}

/** Carpeta del activo: se crea una vez y se guarda su ID (no depende de código/ubicación). */
function assetSubfolder_(act, userEmail, sub) {
  var folder = null;
  if (act.carpeta_drive_id) { try { folder = DriveApp.getFolderById(act.carpeta_drive_id); } catch (e) { folder = null; } }
  if (!folder) {
    var activos = childFolder_(appRoot_(), 'ACTIVOS');
    folder = childFolder_(activos, act.id + '_' + slug_(act.nombre));
    PHOTO_FOLDERS.forEach(function (n) { childFolder_(folder, n); });
    update_('ACTIVOS', act.id, { carpeta_drive_id: folder.getId() }, userEmail, null, { noAudit: true });
    act.carpeta_drive_id = folder.getId();
  }
  return childFolder_(folder, sub);
}

function backup_(motivo) {
  var root = appRoot_();
  var folder = childFolder_(root, 'RESPALDOS');
  var src = DriveApp.getFileById(prop_('SPREADSHEET_ID'));
  var name = src.getName() + ' — RESPALDO ' + Utilities.formatDate(new Date(), cfgTz_(), 'yyyy-MM-dd HHmmss') + ' — ' + motivo;
  var copy = src.makeCopy(name, folder);
  return { id: copy.getId(), url: copy.getUrl(), nombre: name };
}

/* ============================== IMPORTACIÓN ============================== */

/**
 * p = { lote, archivo, activos:[{import_key, hoja, fila, codigo, datos_originales, record}], mantenimiento:[...], descartados:[...] }
 * - Si existe un activo con el mismo import_key: no se duplica. Sólo se rellenan campos vacíos
 *   (nunca se sobrescribe información levantada en campo).
 */
function importBatch_(p, user) {
  var existing = {}; readAll_('ACTIVOS', true).forEach(function (a) { if (a.import_key) existing[a.import_key] = a; });
  var res = { creados: 0, actualizados: 0, sin_cambios: 0, mantenimiento: 0, descartados: 0, errores: [] };
  (p.activos || []).forEach(function (it) {
    try {
      var cur = existing[it.import_key], accion, destino;
      if (!cur) {
        var rec = it.record; rec.import_key = it.import_key; rec.origen = 'IMPORTADO'; rec.estado_verificacion = 'Pendiente de verificación';
        rec.fuente_info = 'Histórica'; rec.etapas = JSON.stringify({ identificado: true });
        var r = insert_('ACTIVOS', rec, user.email, { noAudit: true });
        existing[it.import_key] = r.record; destino = r.record.id; accion = 'CREADO'; res.creados++;
      } else {
        var fill = {};
        Object.keys(it.record).forEach(function (k) { if ((cur[k] === '' || cur[k] === undefined) && it.record[k] !== '' && it.record[k] !== undefined) fill[k] = it.record[k]; });
        var u = Object.keys(fill).length ? update_('ACTIVOS', cur.id, fill, user.email, null, { action: 'IMPORTAR' }) : { changed: 0 };
        destino = cur.id; accion = u.changed ? 'ACTUALIZADO' : 'SIN_CAMBIOS'; if (u.changed) res.actualizados++; else res.sin_cambios++;
      }
      insert_('IMPORTACIONES', { lote: p.lote, archivo: p.archivo, hoja_origen: it.hoja, fila_origen: it.fila, codigo_origen: it.codigo, registro_destino: destino, tabla_destino: 'ACTIVOS', accion: accion, hash: it.hash || '', datos_originales: JSON.stringify(it.datos_originales).substring(0, 45000), observaciones: (it.observaciones || []).join(' | ') }, user.email, { noAudit: true });
    } catch (e) { res.errores.push(it.import_key + ': ' + e.message); }
  });
  var mExisting = {}; readAll_('MANTENIMIENTO_BASE', true).forEach(function (m) { mExisting[m.import_key] = m; });
  (p.mantenimiento || []).forEach(function (m) {
    if (mExisting[m.import_key]) return;
    var act = m.codigo_activo ? existing['1MACP|' + m.codigo_activo] : null;
    m.activo_id = act ? act.id : '';
    m.estado_validacion = 'Histórica - pendiente de validación';
    var codigo = m.codigo_activo; delete m.codigo_activo;
    insert_('MANTENIMIENTO_BASE', m, user.email, { noAudit: true });
    res.mantenimiento++;
  });
  (p.descartados || []).forEach(function (d) {
    var key = 'DESC|' + d.hoja + '|' + d.fila;
    var exists = readAll_('IMPORTACIONES').some(function (r) { return r.hash === key; });
    if (exists) return;
    insert_('IMPORTACIONES', { lote: p.lote, archivo: p.archivo, hoja_origen: d.hoja, fila_origen: d.fila, codigo_origen: d.codigo, registro_destino: '', tabla_destino: '', accion: 'DESCARTADO', hash: key, datos_originales: JSON.stringify(d.datos_originales || {}), observaciones: d.motivo }, user.email, { noAudit: true });
    res.descartados++;
  });
  audit_(user.email, 'IMPORTACIONES', p.lote, 'IMPORTAR', '', '', JSON.stringify(res));
  return res;
}

/** Guarda el archivo original en IMPORTACIONES_ORIGINALES (lo llama el cliente antes de importar). */
ACTIONS.uploadImportFile = function (p, user) {
  requireAdmin_(user);
  var folder = childFolder_(appRoot_(), 'IMPORTACIONES_ORIGINALES');
  var name = Utilities.formatDate(new Date(), cfgTz_(), 'yyyyMMdd_HHmmss') + '_' + p.filename;
  var f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.mimeType, name));
  return { drive_id: f.getId(), url: f.getUrl(), nombre: name };
};
WRITE_ACTIONS.push('uploadImportFile', 'savePdf');

/* ============================== INSTALACIÓN ============================== */

/**
 * Ejecutar UNA VEZ desde el editor (y repetible sin riesgo):
 *  - Respalda la hoja completa en Drive (GESTION_DE_ACTIVOS/RESPALDOS).
 *  - Crea las hojas que falten (NO modifica ni borra hojas existentes;
 *    si una hoja ya existe sólo agrega columnas faltantes al final).
 *  - Crea la estructura de carpetas en Drive.
 *  - Siembra catálogos, tipos, campos técnicos, criterios y configuración (sólo si están vacíos).
 */
function instalar() {
  var p = props_();
  ['SPREADSHEET_ID', 'ROOT_FOLDER_ID'].forEach(function (k) { if (!p.getProperty(k)) throw new Error('Configure la propiedad ' + k); });
  if (!p.getProperty('ADMIN_EMAIL')) p.setProperty('ADMIN_EMAIL', Session.getEffectiveUser().getEmail());
  var root = appRoot_();
  ['ACTIVOS', 'REPORTES', 'IMPORTACIONES_ORIGINALES', 'RESPALDOS'].forEach(function (n) { childFolder_(root, n); });
  var bk = backup_('Antes de instalar');
  Logger.log('Respaldo creado: ' + bk.url);

  var ss = ss_();
  var existentes = ss.getSheets().map(function (s) { return s.getName(); });
  Logger.log('Hojas existentes: ' + existentes.join(', '));
  Object.keys(SCHEMA).forEach(function (t) {
    var sh = ss.getSheetByName(t);
    var cols = cols_(t);
    if (!sh) {
      sh = ss.insertSheet(t);
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      Logger.log('Creada hoja ' + t);
    } else {
      var head = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
      var missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
      if (head.length && head.indexOf(SCHEMA[t].pk) < 0) throw new Error('La hoja ' + t + ' ya existe con otra estructura. No se modifica. Renómbrela o ajuste el esquema.');
      if (missing.length) { sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold'); Logger.log('Agregadas columnas a ' + t + ': ' + missing); }
    }
  });
  seed_();
  Logger.log('Instalación completa. Administrador: ' + p.getProperty('ADMIN_EMAIL'));
  return { respaldo: bk.url };
}

function seedIfEmpty_(table, rows, sys) {
  if (readAll_(table, true).length) return;
  rows.forEach(function (r) { insert_(table, r, sys, { noAudit: true, keepId: !!r.id }); });
}

function seed_() {
  var sys = 'sistema@instalacion';
  var admin = props_().getProperty('ADMIN_EMAIL');
  seedIfEmpty_('USUARIOS', [{ email: admin.toLowerCase(), nombre: 'Administrador', rol: 'ADMINISTRADOR', activo: true }], sys);

  seedIfEmpty_('CONFIGURACION', [
    { clave: 'empresa', valor: 'LAMINADOS JAB', descripcion: 'Nombre de la empresa (encabezado de hojas de vida)' },
    { clave: 'formato_hv_codigo', valor: 'JAB-PA-GEA-F-46', descripcion: 'Código documental del formato de hoja de vida' },
    { clave: 'formato_hv_version', valor: 'Versión 3', descripcion: 'Versión oficial del formato (no modificar sin control documental)' },
    { clave: 'formato_hv_vigencia', valor: '08/07/2025', descripcion: 'Vigencia del formato' },
    { clave: 'metodologia_criticidad', valor: METODOLOGIA_CRITICIDAD, descripcion: 'Versión vigente de la metodología' },
    { clave: 'umbral_muy_alta', valor: 16, descripcion: 'Puntaje IC×IP mínimo para criticidad muy alta' },
    { clave: 'umbral_alta', valor: 10, descripcion: 'Puntaje mínimo para criticidad alta' },
    { clave: 'umbral_media', valor: 5, descripcion: 'Puntaje mínimo para criticidad media' },
    { clave: 'umbral_desconocidos', valor: 0.4, descripcion: 'Fracción máxima de criterios desconocidos para emitir resultado' },
    { clave: 'prefijo_codigo', valor: 'JAB', descripcion: 'Prefijo de la metodología de codificación' }
  ], sys);

  var cat = [];
  function addList(lista, vals) { vals.forEach(function (v, i) { cat.push({ lista: lista, valor: v, orden: i + 1, activo: true }); }); }
  addList('estado_verificacion', ['Pendiente de verificación', 'Existencia confirmada', 'Existe, pero presenta información incorrecta', 'No localizado', 'Trasladado', 'Desmontado', 'Fuera de servicio', 'Dado de baja (previa aprobación)', 'Posible duplicado', 'Incorporado en levantamiento']);
  addList('estado_operacional', ['En operación', 'Disponible / en espera', 'Fuera de servicio', 'En reparación', 'Desmontado', 'Desconocido']);
  addList('condicion', ['Excelente', 'Buena', 'Regular', 'Mala', 'Crítica', 'No evaluada', 'No aplica']);
  addList('nivel', ['Empresa', 'Planta', 'Área', 'Proceso', 'Línea de producción', 'Sistema', 'Subsistema', 'Máquina', 'Equipo', 'Conjunto', 'Subconjunto', 'Componente', 'Pieza', 'Elemento mantenible']);
  addList('area', ['PLANTA - TREN DE LAMINACIÓN 230', 'PLANTA - TREN DE LAMINACIÓN 380', 'PATIO Y ALISTAMIENTO', 'TALLER', 'PLANTA- TREFI/DOBL/ELECTR', 'AREA LABORATORIO', 'AREA ADMINISTRATIVA', 'AREA DE BIENESTAR ADMINISTRATIVO', 'AREA DE BIENESTAR PLANTA']);
  addList('tecnologia', ['MECÁNICO', 'ELÉCTRICO', 'ELECTRÓNICO', 'HIDRÁULICO', 'NEUMÁTICO', 'MANUAL', 'BATERÍA', 'COMBUSTIÓN', 'ANÁLOGO']);
  addList('fuente_alimentacion', ['AGUA', 'AIRE', 'GAS', 'BATERÍAS', 'ELECTRICIDAD', 'OTROS', 'ACEITE HIDRÁULICO', 'MECÁNICO', 'GASOLINA', 'ACPM', 'OXÍGENO Y GAS']);
  addList('fuente_info', ['Verificada', 'Suministrada por operadores', 'Documental', 'Histórica', 'Estimada', 'Pendiente']);
  addList('categoria_foto', ['Vista general', 'Placa de identificación', 'Ubicación', 'Componentes', 'Acoplamientos', 'Sistemas de transmisión', 'Conexiones eléctricas', 'Conexiones hidráulicas', 'Conexiones neumáticas', 'Daños', 'Desgaste', 'Hallazgos', 'Antes de intervención', 'Después de intervención', 'Otras evidencias']);
  addList('tipo_documento', ['Manual', 'Catálogo', 'Plano mecánico', 'Diagrama eléctrico', 'Diagrama hidráulico', 'Diagrama neumático', 'Certificado', 'Informe de inspección', 'Ficha técnica', 'Listado de repuestos', 'Documento del fabricante']);
  addList('tipo_relacion', ['Está conectado a', 'Acciona', 'Transmite movimiento a', 'Alimenta', 'Es alimentado por', 'Controla', 'Protege', 'Lubrica', 'Refrigera', 'Soporta', 'Depende de', 'Sirve como respaldo de', 'Comparte componentes con']);
  addList('criterio_inspeccion', ['Condición física', 'Condición operacional', 'Desgaste', 'Corrosión', 'Fugas', 'Vibraciones anormales', 'Ruidos anormales', 'Sobrecalentamiento', 'Lubricación deficiente', 'Holguras', 'Desalineación', 'Daños eléctricos visibles', 'Ausencia de protecciones', 'Elementos faltantes', 'Modificaciones no documentadas', 'Riesgos de seguridad']);
  addList('severidad_hallazgo', ['Baja', 'Media', 'Alta', 'Crítica']);
  addList('estado_hallazgo', ['Abierto', 'En revisión', 'Programado', 'Cerrado']);
  addList('disponibilidad_repuesto', ['En almacén', 'Bajo pedido', 'Importado', 'Descontinuado', 'Desconocida']);
  seedIfEmpty_('CATALOGOS', cat, sys);

  seedIfEmpty_('UBICACIONES', [
    { id: 'UBI-000001', nombre: 'LAMINADOS JAB', tipo: 'Empresa', padre_id: '' },
    { id: 'UBI-000002', nombre: 'PLANTA PRINCIPAL', tipo: 'Planta', padre_id: 'UBI-000001' }
  ], sys);

  seedIfEmpty_('TIPOS_ACTIVOS', TIPOS_SEED, sys);
  seedIfEmpty_('CAMPOS_TECNICOS', CAMPOS_SEED.map(function (c, i) { c.orden = i + 1; return c; }), sys);
  seedIfEmpty_('CRITERIOS_CRITICIDAD', CRITERIOS_SEED, sys);
}

/* ---- Semillas de familias y campos técnicos (editables luego desde la app) ---- */
var TIPOS_SEED = [
  ['TIP-UBIC', 'Ubicación / agrupación', 'UBICACION', 'Área', 'GENERAL'],
  ['TIP-SIST', 'Sistema / línea', 'SISTEMA', 'Sistema', 'GENERAL,OPERACIONAL'],
  ['TIP-MOTOR', 'Motor eléctrico', 'MOTOR_ELECTRICO', 'Equipo', 'GENERAL,ELECTRICA,MECANICA,OPERACIONAL'],
  ['TIP-REDUC', 'Reductor / caja de engranajes', 'REDUCTOR', 'Equipo', 'GENERAL,MECANICA,OPERACIONAL'],
  ['TIP-ACOPL', 'Acoplamiento', 'ACOPLAMIENTO', 'Conjunto', 'GENERAL,MECANICA'],
  ['TIP-RODAM', 'Rodamiento', 'RODAMIENTO', 'Componente', 'GENERAL,MECANICA'],
  ['TIP-BOMBA', 'Bomba', 'BOMBA', 'Equipo', 'GENERAL,HIDRAULICA,MECANICA,OPERACIONAL'],
  ['TIP-HIDR', 'Unidad / cilindro hidráulico', 'HIDRAULICO', 'Equipo', 'GENERAL,HIDRAULICA,OPERACIONAL'],
  ['TIP-VALV', 'Válvula', 'VALVULA', 'Componente', 'GENERAL,HIDRAULICA'],
  ['TIP-COMPR', 'Compresor', 'COMPRESOR', 'Equipo', 'GENERAL,NEUMATICA,ELECTRICA,OPERACIONAL'],
  ['TIP-HORNO', 'Horno / quemador', 'HORNO', 'Equipo', 'GENERAL,TERMICA,OPERACIONAL'],
  ['TIP-TABLE', 'Tablero eléctrico', 'TABLERO', 'Equipo', 'GENERAL,ELECTRICA'],
  ['TIP-GRUA', 'Puente grúa / izaje', 'IZAJE', 'Equipo', 'GENERAL,MECANICA,ELECTRICA,OPERACIONAL'],
  ['TIP-MAQH', 'Máquina herramienta', 'MAQUINA_HERRAMIENTA', 'Máquina', 'GENERAL,MECANICA,ELECTRICA,OPERACIONAL'],
  ['TIP-LAMIN', 'Equipo de laminación (castillo, caja trío, volante)', 'LAMINACION', 'Equipo', 'GENERAL,MECANICA,OPERACIONAL'],
  ['TIP-SOLD', 'Equipo de soldadura / corte', 'SOLDADURA', 'Equipo', 'GENERAL,ELECTRICA'],
  ['TIP-VEHIC', 'Vehículo / montacargas', 'VEHICULO', 'Equipo', 'GENERAL,MECANICA,OPERACIONAL'],
  ['TIP-INSTR', 'Instrumento de medición', 'INSTRUMENTO', 'Equipo', 'GENERAL,METROLOGIA'],
  ['TIP-MOBIL', 'Mobiliario', 'MOBILIARIO', 'Equipo', 'GENERAL'],
  ['TIP-COMPU', 'Equipo de cómputo / oficina', 'COMPUTO', 'Equipo', 'GENERAL,ELECTRICA'],
  ['TIP-GENER', 'Genérico / por clasificar', 'GENERICO', 'Equipo', 'GENERAL']
].map(function (r) { return { id: r[0], nombre: r[1], familia: r[2], nivel_sugerido: r[3], grupos_campos: r[4] }; });

/** [grupo, etiqueta, tipo_dato, unidad, opciones, familias('*' = todas las del grupo)] */
var CAMPOS_SEED = [
  ['MECANICA', 'Potencia mecánica', 'numero', 'kW', '', '*'],
  ['MECANICA', 'Velocidad de rotación', 'numero', 'rpm', '', '*'],
  ['MECANICA', 'Torque', 'numero', 'N·m', '', 'MOTOR_ELECTRICO,REDUCTOR,ACOPLAMIENTO,LAMINACION'],
  ['MECANICA', 'Dimensiones', 'texto', 'mm', '', '*'],
  ['MECANICA', 'Peso', 'numero', 'kg', '', '*'],
  ['MECANICA', 'Materiales', 'texto', '', '', '*'],
  ['MECANICA', 'Tipo de transmisión', 'lista', '', 'Directa,Correas,Cadena,Engranajes,Acoplamiento flexible,Acoplamiento rígido,Cardán,Otra', '*'],
  ['MECANICA', 'Relación de reducción', 'texto', '', '', 'REDUCTOR,LAMINACION,IZAJE'],
  ['MECANICA', 'Rodamientos (referencias)', 'texto', '', '', '*'],
  ['MECANICA', 'Sellos / retenes', 'texto', '', '', '*'],
  ['MECANICA', 'Acoplamientos', 'texto', '', '', 'MOTOR_ELECTRICO,REDUCTOR,BOMBA,LAMINACION'],
  ['MECANICA', 'Lubricante', 'texto', '', '', '*'],
  ['MECANICA', 'Capacidad de carga', 'numero', 'kg', '', 'IZAJE,VEHICULO,RODAMIENTO'],
  ['MECANICA', 'Tolerancias', 'texto', '', '', 'RODAMIENTO,ACOPLAMIENTO,LAMINACION,MAQUINA_HERRAMIENTA'],
  ['MECANICA', 'Parámetros de alineación', 'texto', '', '', 'ACOPLAMIENTO,MOTOR_ELECTRICO,REDUCTOR,BOMBA'],
  ['MECANICA', 'Referencia del rodamiento', 'texto', '', '', 'RODAMIENTO'],
  ['MECANICA', 'Diámetro interior', 'numero', 'mm', '', 'RODAMIENTO'],
  ['MECANICA', 'Diámetro exterior', 'numero', 'mm', '', 'RODAMIENTO'],
  ['ELECTRICA', 'Tensión nominal', 'numero', 'V', '', '*'],
  ['ELECTRICA', 'Corriente nominal', 'numero', 'A', '', '*'],
  ['ELECTRICA', 'Potencia eléctrica', 'numero', 'kW', '', '*'],
  ['ELECTRICA', 'Frecuencia', 'numero', 'Hz', '', '*'],
  ['ELECTRICA', 'Número de fases', 'lista', '', '1,3', '*'],
  ['ELECTRICA', 'Factor de potencia', 'numero', '', '', 'MOTOR_ELECTRICO,COMPRESOR'],
  ['ELECTRICA', 'Eficiencia', 'numero', '%', '', 'MOTOR_ELECTRICO'],
  ['ELECTRICA', 'Clase de aislamiento', 'lista', '', 'A,B,F,H', 'MOTOR_ELECTRICO'],
  ['ELECTRICA', 'Grado de protección IP', 'texto', '', '', '*'],
  ['ELECTRICA', 'Tipo de conexión', 'lista', '', 'Estrella,Triángulo,Estrella-Triángulo,Otra', 'MOTOR_ELECTRICO,COMPRESOR'],
  ['ELECTRICA', 'Sistema de arranque', 'lista', '', 'Directo,Estrella-triángulo,Arrancador suave,Variador de frecuencia,Resistencias rotóricas,Otro', 'MOTOR_ELECTRICO,COMPRESOR,BOMBA,TABLERO'],
  ['ELECTRICA', 'Protecciones eléctricas', 'texto', '', '', '*'],
  ['ELECTRICA', 'Variador de frecuencia', 'texto', '', '', 'MOTOR_ELECTRICO,TABLERO,IZAJE'],
  ['ELECTRICA', 'Datos de placa (transcripción)', 'textarea', '', '', '*'],
  ['HIDRAULICA', 'Presión nominal', 'numero', 'bar', '', '*'],
  ['HIDRAULICA', 'Presión máxima', 'numero', 'bar', '', '*'],
  ['HIDRAULICA', 'Caudal', 'numero', 'L/min', '', '*'],
  ['HIDRAULICA', 'Fluido de trabajo', 'texto', '', '', '*'],
  ['HIDRAULICA', 'Tipo de bomba', 'lista', '', 'Centrífuga,Engranajes,Paletas,Pistones,Tornillo,Otra', 'BOMBA,HIDRAULICO'],
  ['HIDRAULICA', 'Cilindros', 'texto', '', '', 'HIDRAULICO'],
  ['HIDRAULICA', 'Válvulas', 'texto', '', '', 'HIDRAULICO,BOMBA'],
  ['HIDRAULICA', 'Filtros', 'texto', '', '', '*'],
  ['HIDRAULICA', 'Mangueras / conexiones', 'texto', '', '', '*'],
  ['HIDRAULICA', 'Capacidad del depósito', 'numero', 'L', '', 'HIDRAULICO'],
  ['HIDRAULICA', 'Temperatura de trabajo', 'numero', '°C', '', '*'],
  ['NEUMATICA', 'Presión de trabajo', 'numero', 'bar', '', '*'],
  ['NEUMATICA', 'Caudal de aire', 'numero', 'm³/min', '', '*'],
  ['NEUMATICA', 'Capacidad del tanque', 'numero', 'L', '', 'COMPRESOR'],
  ['TERMICA', 'Capacidad térmica', 'numero', 'kW', '', '*'],
  ['TERMICA', 'Combustible', 'texto', '', '', '*'],
  ['TERMICA', 'Temperatura máxima', 'numero', '°C', '', '*'],
  ['TERMICA', 'Refractario', 'texto', '', '', 'HORNO'],
  ['METROLOGIA', 'Rango de medición', 'texto', '', '', '*'],
  ['METROLOGIA', 'Resolución', 'texto', '', '', '*'],
  ['METROLOGIA', 'Exactitud / incertidumbre', 'texto', '', '', '*'],
  ['METROLOGIA', 'Frecuencia de calibración', 'texto', '', '', '*'],
  ['METROLOGIA', 'Último certificado de calibración', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Horas de operación', 'numero', 'h', '', '*'],
  ['OPERACIONAL', 'Régimen de trabajo', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Capacidad nominal', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Capacidad real', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Temperatura de operación', 'numero', '°C', '', '*'],
  ['OPERACIONAL', 'Condiciones ambientales', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Ciclos de trabajo', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Cargas operacionales', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Condiciones normales de funcionamiento', 'textarea', '', '', '*'],
  ['OPERACIONAL', 'Límites operacionales documentados', 'textarea', '', '', '*'],
  ['OPERACIONAL', 'Fuentes de energía', 'texto', '', '', '*'],
  ['OPERACIONAL', 'Riesgos asociados', 'textarea', '', '', '*']
].map(function (r) { return { grupo: r[0], etiqueta: r[1], tipo_dato: r[2], unidad: r[3], opciones: r[4], familias: r[5], obligatorio: false }; });

/** Escala 1..5 documentada por criterio. */
var CRITERIOS_SEED = [
  ['CC-SEG', 'Seguridad de las personas', 'CONSECUENCIA', 3, 'SEGURIDAD_AMBIENTAL', '1 Sin lesión|2 Primeros auxilios|3 Lesión con incapacidad temporal|4 Lesión grave / incapacidad permanente|5 Fatalidad posible'],
  ['CC-AMB', 'Impacto ambiental', 'CONSECUENCIA', 2, 'SEGURIDAD_AMBIENTAL', '1 Sin impacto|2 Impacto menor contenido en sitio|3 Impacto moderado reportable|4 Impacto mayor fuera del sitio|5 Daño ambiental grave / sanción'],
  ['CC-PROD', 'Impacto en producción', 'CONSECUENCIA', 3, '', '1 Sin efecto|2 Reducción < 10%|3 Reducción 10-50%|4 Parada de una línea|5 Parada de planta'],
  ['CC-CAL', 'Impacto en calidad', 'CONSECUENCIA', 1.5, '', '1 Sin efecto|2 Desviación menor corregible|3 Reproceso|4 Producto no conforme|5 Reclamo / producto liberado defectuoso'],
  ['CC-ECO', 'Consecuencias económicas', 'CONSECUENCIA', 2, '', '1 < 1 SMMLV|2 1-5 SMMLV|3 5-20 SMMLV|4 20-100 SMMLV|5 > 100 SMMLV'],
  ['CC-TREC', 'Tiempo estimado de recuperación', 'CONSECUENCIA', 1.5, '', '1 < 1 h|2 1-4 h|3 4-24 h|4 1-7 días|5 > 7 días'],
  ['CC-REP', 'Disponibilidad de repuestos', 'CONSECUENCIA', 1, '', '1 En almacén|2 Local < 24 h|3 Nacional < 1 semana|4 Importado / fabricación|5 Descontinuado'],
  ['CC-RED', 'Existencia de redundancia', 'CONSECUENCIA', 1.5, '', '1 Respaldo automático|2 Respaldo manual inmediato|3 Respaldo parcial|4 Respaldo improvisado|5 Sin respaldo'],
  ['CC-PER', 'Disponibilidad de personal especializado', 'CONSECUENCIA', 1, '', '1 Personal propio entrenado|2 Propio parcialmente|3 Contratista local|4 Contratista nacional|5 Especialista externo / fabricante'],
  ['CC-DEP', 'Dependencia de otros equipos', 'CONSECUENCIA', 1, '', '1 Ninguno depende|2 Uno no crítico|3 Varios equipos|4 Una línea completa|5 Toda la planta'],
  ['CC-FUN', 'Consecuencia de la pérdida de función', 'CONSECUENCIA', 1.5, '', '1 Insignificante|2 Menor|3 Moderada|4 Mayor|5 Catastrófica'],
  ['CC-FREC', 'Frecuencia / probabilidad de falla', 'PROBABILIDAD', 1, '', '1 < 1 falla en 5 años|2 1 falla en 2-5 años|3 1 falla al año|4 Varias al año|5 Mensual o más']
].map(function (r, i) { return { id: r[0], nombre: r[1], grupo: r[2], peso: r[3], regla_especial: r[4], escala: r[5], descripcion: '', orden: i + 1 }; });
