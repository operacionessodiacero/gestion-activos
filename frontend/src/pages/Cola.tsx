import React from 'react';
import { useApp } from '../store';
import { removeOp } from '../api';
import { fmtDate } from '../domain';
import { Empty } from '../components/ui';

export default function Cola() {
  const { queue, online, sync, lastSync } = useApp();
  return <div className="page"><div className="page-h"><h2>Sincronización</h2><button className="primary" disabled={!online || !queue.length} onClick={sync}>↻ Enviar ahora</button></div>
    <div className={'alert ' + (online ? 'ok' : 'warn')}>{online ? 'Conectado.' : 'Sin conexión: los registros se guardan en este dispositivo y se enviarán automáticamente a Google Sheets/Drive al recuperar la señal.'} {lastSync && `Última descarga: ${fmtDate(lastSync)}.`}</div>
    {queue.length ? <table className="tbl"><thead><tr><th>Registro pendiente de envío</th><th>Creado</th><th>Estado</th><th></th></tr></thead><tbody>{queue.map(q => <tr key={q.qid}><td>{q.label}</td><td>{fmtDate(q.createdAt)}</td><td>{q.status === 'error' ? <span className="danger">Error: {q.error}</span> : 'Pendiente'}</td>
      <td>{q.status === 'error' && <button className="ghost sm" onClick={() => confirm('¿Descartar este registro? No se enviará.') && removeOp(q.qid)}>Descartar</button>}</td></tr>)}</tbody></table>
      : <Empty>✔ Todo está sincronizado. No hay registros pendientes en este dispositivo.</Empty>}
    <p className="small muted">Cada registro lleva un identificador único: si un envío se repite por mala señal, el servidor no lo duplica.</p>
  </div>;
}
