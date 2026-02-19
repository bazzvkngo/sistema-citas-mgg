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
  header: { marginBottom: 10 },
  titleRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 16, color: '#111', margin: 0, fontWeight: 900 },
  subtitle: { margin: '6px 0 0', fontSize: 12, color: '#666', fontWeight: 700, lineHeight: 1.35 },

  empty: { padding: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' },

  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' },
  th: { textAlign: 'left', padding: 10, background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 900, color: '#111' },
  td: { padding: 10, borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: 12 },

  badge: (variant) => {
    const base = {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      border: '1px solid #e5e7eb',
      background: '#fff',
      color: '#111'
    };
    if (variant === 'web') return { ...base, background: '#eaf2ff', border: '1px solid #cfe0ff', color: '#0b3d91' };
    if (variant === 'state') return { ...base, background: '#f3f4f6' };
    return base;
  }
};

export default function AgentAppointments({ atencionActual, moduloEfectivo }) {
  const [citas, setCitas] = useState([]);
  const [tramitesMap, setTramitesMap] = useState({});

  // Mapa de trámites
  useEffect(() => {
    const qT = query(collection(db, 'tramites'));
    const unsub = onSnapshot(qT, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
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
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCitas(list);
    });

    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    return citas.map((c) => {
      const tramiteNombre = tramitesMap[c.tramiteID] || c.tramiteID || 'Trámite';
      const fecha = c.fechaHora?.toDate ? format(c.fechaHora.toDate(), 'dd/MM/yyyy HH:mm') : '—';

      const modulo = c.moduloAsignado || '—';
      const estado = c.estado || '—';

      return { ...c, tramiteNombre, fecha, modulo, estado };
    });
  }, [citas, tramitesMap]);

  return (
    <div>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h2 style={styles.title}>Citas Web (Agendadas) — Hoy</h2>
          <span style={styles.badge('web')}>WEB</span>
        </div>

        <p style={styles.subtitle}>
          Vista informativa (no se llama desde aquí). El llamado se realiza únicamente con <strong>“Llamar siguiente”</strong>.
          {moduloEfectivo ? (
            <> Módulo efectivo: <strong>{moduloEfectivo}</strong>.</>
          ) : (
            <> <span style={{ color: '#7a0000' }}>Asigna un módulo para poder llamar.</span></>
          )}
          {atencionActual ? (
            <> Atención en curso: <strong>{atencionActual.codigo}</strong>.</>
          ) : null}
        </p>
      </div>

      {rows.length === 0 ? (
        <div style={styles.empty}>No hay citas web activas para hoy.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
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
                <td style={styles.td}><strong>{c.codigo || c.id}</strong></td>
                <td style={styles.td}>{c.tramiteNombre}</td>
                <td style={styles.td}>{c.fecha}</td>
                <td style={styles.td}>
                  <span style={styles.badge('state')}>{c.estado}</span>
                </td>
                <td style={styles.td}>{c.modulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
