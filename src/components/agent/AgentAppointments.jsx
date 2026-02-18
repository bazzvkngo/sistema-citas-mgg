// src/components/agent/AgentAppointments.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { format } from 'date-fns';

const styles = {
  title: { fontSize: 22, color: '#C8102E', marginBottom: 10, fontWeight: 800 },
  subtitle: { margin: '0 0 16px', fontSize: 12, color: '#666', fontWeight: 700 },

  empty: { padding: 14, border: '1px solid #ddd', borderRadius: 10, background: '#fff' },

  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { textAlign: 'left', padding: 12, background: '#f3f3f3', borderBottom: '1px solid #ddd', fontSize: 12 },
  td: { padding: 12, borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: 12 },

  badge: (bg) => ({
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    background: bg,
    color: '#111'
  })
};

export default function AgentAppointments({ atencionActual, moduloEfectivo }) {
  const [citas, setCitas] = useState([]);
  const [tramitesMap, setTramitesMap] = useState({});

  // Mapa de trámites
  useEffect(() => {
    const qT = query(collection(db, 'tramites'));
    const unsub = onSnapshot(qT, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = data.nombre || d.id;
      });
      setTramitesMap(map);
    });
    return () => unsub();
  }, []);

  // Citas web activas de HOY (solo informativo)
  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const qC = query(
      collection(db, 'citas'),
      where('estado', '==', 'activa'),
      where('fechaHora', '>=', Timestamp.fromDate(start)),
      where('fechaHora', '<', Timestamp.fromDate(end)),
      orderBy('fechaHora', 'asc')
    );

    const unsub = onSnapshot(qC, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCitas(list);
    });

    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    return citas.map(c => {
      const tramiteNombre = tramitesMap[c.tramiteID] || c.tramiteID || 'Trámite';
      const fecha = c.fechaHora?.toDate ? format(c.fechaHora.toDate(), 'dd/MM/yyyy HH:mm') : '—';

      const modulo = c.moduloAsignado || '—';
      const estado = c.estado || '—';

      return { ...c, tramiteNombre, fecha, modulo, estado };
    });
  }, [citas, tramitesMap]);

  return (
    <div>
      <h2 style={styles.title}>Citas Web (Agendadas)</h2>

      <p style={styles.subtitle}>
        Vista informativa. El llamado se realiza únicamente con <strong>“Llamar siguiente”</strong> (Llamado simple).
        {moduloEfectivo ? (
          <> Módulo efectivo: <strong>{moduloEfectivo}</strong>.</>
        ) : (
          <> Asigna un módulo para poder llamar.</>
        )}
        {atencionActual ? (
          <> Atención en curso: <strong>{atencionActual.codigo}</strong>.</>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <div style={styles.empty}>No hay citas agendadas activas para atender en este momento.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Código</th>
              <th style={styles.th}>Trámite</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Módulo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>
                  <span style={styles.badge('#E5F0FF')}>WEB</span>
                </td>
                <td style={styles.td}><strong>{c.codigo || c.id}</strong></td>
                <td style={styles.td}>{c.tramiteNombre}</td>
                <td style={styles.td}>{c.fecha}</td>
                <td style={styles.td}>{c.estado}</td>
                <td style={styles.td}>{c.modulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
