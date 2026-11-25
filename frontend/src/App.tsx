import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './store';
import { CLIENT_ID, API_URL } from './api';
import { norm } from './domain';
import Dashboard from './pages/Dashboard';
import Inventario from './pages/Inventario';
import Campo from './pages/Campo';
import Arbol from './pages/Arbol';
import Relaciones from './pages/Relaciones';
import NuevoActivo from './pages/NuevoActivo';
import ActivoDetalle from './pages/ActivoDetalle';
import Inspecciones from './pages/Inspecciones';
import Hallazgos from './pages/Hallazgos';
import Criticidad from './pages/Criticidad';
import Repuestos from './pages/Repuestos';
import Archivos from './pages/Archivos';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';
import HojaVida from './pages/HojaVida';
import Escanear from './pages/Escanear';
import Fichas from './pages/Fichas';
import Cola from './pages/Cola';

const NAV: [string, string, string][] = [
  ['/', '📊', 'Dashboard'], ['/inventario', '📋', 'Inventario maestro'], ['/campo', '✅', 'Verificación en campo'],
  ['/arbol', '🌳', 'Árbol jerárquico'], ['/relaciones', '🔗', 'Relaciones funcionales'], ['/nuevo', '➕', 'Registro de nuevos activos'],
  ['/fichas', '🧾', 'Fichas técnicas'], ['/inspecciones', '🔍', 'Inspecciones'], ['/hallazgos', '⚠️', 'Hallazgos'],
  ['/criticidad', '🎯', 'Criticidad'], ['/repuestos', '⚙️', 'Componentes y repuestos'], ['/archivos', '🖼️', 'Fotografías y documentos'],
  ['/reportes', '📑', 'Reportes'], ['/configuracion', '🛠️', 'Configuración']
];

function Login() {
  const { signIn, toast } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let tries = 0;
    const init = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id) { if (tries++ < 50) setTimeout(init, 200); return; }
      g.accounts.id.initialize({
        client_id: CLIENT_ID, auto_select: true, cancel_on_tap_outside: false, use_fedcm_for_prompt: true,
        callback: async (r: any) => { setErr(''); try { await signIn(r.credential); } catch (e: any) { setErr(e.message); toast(e.message, 'error'); } }
      });
      if (ref.current) g.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'es', shape: 'pill' });
      g.accounts.id.prompt();
    };
    init();
  }, [signIn, toast]);
  return <div className="login">
    <div className="login-card">
      <div className="logo">⚙️</div>
      <h1>Gestión de Activos Industriales</h1>
      <p className="muted">Levantamiento, verificación y caracterización de activos físicos.</p>
      {!CLIENT_ID || !API_URL ? <div className="alert error">La aplicación aún no está configurada (falta CLIENT_ID o URL del backend).</div> : <div ref={ref} className="gbtn" />}
      {err && <div className="alert error">{err}</div>}
      <p className="small muted">Acceso exclusivo para usuarios autorizados por el administrador. La información se almacena en Google Sheets y Google Drive privados de la empresa.</p>
    </div>
  </div>;
}

function GlobalSearch() {
  const { db } = useApp(); const nav = useNavigate();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const res = useMemo(() => {
    const n = norm(q); if (n.length < 2) return [];
    return db.ACTIVOS.filter(a => norm(`${a.id} ${a.codigo} ${a.codigo_anterior} ${a.nombre} ${a.marca} ${a.modelo} ${a.serie} ${a.area}`).includes(n)).slice(0, 12);
  }, [q, db.ACTIVOS]);
  return <div className="gsearch">
    <input placeholder="🔎 Buscar activo, código, serie…" value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
    {open && res.length > 0 && <div className="gsearch-res">{res.map(a =>
      <div key={a.id} onMouseDown={() => { nav('/activo/' + a.id); setQ(''); }}><b>{a.codigo || a.id}</b> {a.nombre}<small>{a.area}</small></div>)}</div>}
  </div>;
}

function Shell() {
  const { user, signOut, online, queue, loading, toasts, reload, sync } = useApp();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  if (!user) return <Login />;
  const expired = (user as any)._expired;
  const pend = queue.length;
  return <div className="app">
    <header className="top">
      <button className="ghost menu-btn" onClick={() => setMenu(!menu)} aria-label="Menú">☰</button>
      <NavLink to="/" className="brand">⚙️ <span>Activos</span></NavLink>
      <GlobalSearch />
      <NavLink to="/escanear" className="iconbtn" title="Escanear QR">▦</NavLink>
      <NavLink to="/cola" className={'sync ' + (!online ? 'off' : pend ? 'pend' : 'ok')} title="Estado de sincronización">
        {!online ? '⛔ Sin conexión' : pend ? `⏳ ${pend} por enviar` : loading ? '↻' : '☁️'}
      </NavLink>
    </header>
    {expired && <div className="alert warn banner">Su sesión venció. <button onClick={() => { localStorage.removeItem('ga_token'); location.reload(); }}>Iniciar sesión de nuevo</button> (los registros en cola se conservan).</div>}
    <div className="body">
      <nav className={'side' + (menu ? ' open' : '')}>
        {NAV.map(([to, ic, l]) => <NavLink key={to} to={to} end={to === '/'}><span className="ic">{ic}</span>{l}</NavLink>)}
        <div className="side-user">
          {user.foto && <img src={user.foto} alt="" />}<div><b>{user.nombre}</b><small>{user.email}</small><small className="role">{user.rol}</small></div>
          <div className="row"><button className="sm" onClick={() => { reload(); sync(); }}>↻ Recargar</button><button className="sm" onClick={signOut}>Salir</button></div>
        </div>
      </nav>
      {menu && <div className="side-bg" onClick={() => setMenu(false)} />}
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/campo" element={<Campo />} />
          <Route path="/arbol" element={<Arbol />} />
          <Route path="/arbol/:id" element={<Arbol />} />
          <Route path="/relaciones" element={<Relaciones />} />
          <Route path="/nuevo" element={<NuevoActivo />} />
          <Route path="/activo/:id" element={<ActivoDetalle />} />
          <Route path="/activo/:id/:tab" element={<ActivoDetalle />} />
          <Route path="/hoja-vida/:id" element={<HojaVida />} />
          <Route path="/fichas" element={<Fichas />} />
          <Route path="/inspecciones" element={<Inspecciones />} />
          <Route path="/hallazgos" element={<Hallazgos />} />
          <Route path="/criticidad" element={<Criticidad />} />
          <Route path="/repuestos" element={<Repuestos />} />
          <Route path="/archivos" element={<Archivos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/escanear" element={<Escanear />} />
          <Route path="/cola" element={<Cola />} />
          <Route path="*" element={<div className="empty">Página no encontrada</div>} />
        </Routes>
      </main>
    </div>
    <nav className="bottom">
      <NavLink to="/" end>📊<span>Inicio</span></NavLink>
      <NavLink to="/campo">✅<span>Campo</span></NavLink>
      <NavLink to="/escanear">▦<span>QR</span></NavLink>
      <NavLink to="/nuevo">➕<span>Nuevo</span></NavLink>
      <NavLink to="/arbol">🌳<span>Árbol</span></NavLink>
    </nav>
    <div className="toasts">{toasts.map(t => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
  </div>;
}

export default function App() {
  return <AppProvider><HashRouter><Shell /></HashRouter></AppProvider>;
}
