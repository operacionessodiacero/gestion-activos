import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { useApp } from '../store';

/** Escáner QR con la cámara (jsQR, funciona en Android e iPhone). También acepta código escrito. */
export default function Escanear() {
  const nav = useNavigate(); const { db } = useApp();
  const video = useRef<HTMLVideoElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState(''); const [manual, setManual] = useState('');
  function resolve(text: string) {
    const m = text.match(/#\/activo\/([^/?#]+)/); const id = m ? decodeURIComponent(m[1]) : text.trim();
    const a = db.ACTIVOS.find(x => x.id === id || String(x.codigo).toUpperCase() === id.toUpperCase() || String(x.codigo_anterior).toUpperCase() === id.toUpperCase());
    if (a) { nav('/activo/' + a.id); return true; }
    setErr(`No se encontró un activo con «${id}».`); return false;
  }
  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current!; v.srcObject = stream; v.setAttribute('playsinline', 'true'); await v.play();
        const tick = () => {
          if (stop) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            const c = canvas.current!; c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            if (code?.data) { if (navigator.vibrate) navigator.vibrate(100); if (resolve(code.data)) { stop = true; return; } }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e: any) { setErr('No se pudo acceder a la cámara: ' + e.message + '. Puede escribir el código manualmente.'); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  }, []); // eslint-disable-line
  return <div className="page"><div className="page-h"><h2>Escanear código QR</h2></div>
    <div className="scanner"><video ref={video} muted /><div className="scan-frame" /></div>
    <canvas ref={canvas} hidden />
    {err && <div className="alert warn">{err}</div>}
    <div className="row"><input placeholder="…o escriba el código / ID del activo" value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && resolve(manual)} /><button className="primary" onClick={() => resolve(manual)}>Buscar</button></div>
  </div>;
}
