import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { format } from 'date-fns';

const styles = {
  title: { fontSize: 22, color: '#C8102E', marginBottom: 16, fontWeight: 800 },
  empty: { padding: 14, border: '1px solid #ddd', borderRadius: 10, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { textAlign: 'left', padding: 12, background: '#f3f3f3', borderBottom: '1px solid #ddd' },
  td: { padding: 12, borderBottom: '1px solid #eee', verticalAlign: 'top' },
  btn: {
    backgroundColor: '#0d6efd',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 800
  },
  btnDisabled: {
    backgroundColor: '#0d6efd',
    opacity: 0.55,
    cursor: 'not-allowed'
  }
};

export default function AgentAppointments({ atencionActual, moduloEfectivo }) {
  const [citas, setCitas] = useState([]);
  const [tramitesMap, setTramitesMap] = useState({});

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

  const llamarCita = async (cita) => {
    try {
      const modulo = moduloEfectivo;
      if (!modulo) return alert('No tienes módulo asignado.');

      if (atencionActual) {
        return alert(`Ya estás atendiendo un ${atencionActual.tipo} (${atencionActual.codigo}). Finaliza antes de llamar otro.`);
      }

      const ref = doc(db, 'citas', cita.id);

      await updateDoc(ref, {
        estado: 'llamado',
        moduloAsignado: modulo
      });

      const tramiteNombre = tramitesMap[cita.tramiteID] || cita.tramiteID || '';

      const payload = {
        codigoLlamado: cita.codigo || cita.id,
        modulo: modulo,
        timestamp: Timestamp.now(),
        tipo: 'Cita',
        tramiteID: cita.tramiteID || '',
        tramiteNombre
      };

      await setDoc(doc(db, 'estadoSistema', 'llamadaActual'), payload, { merge: true });

      if (cita.tramiteID) {
        await setDoc(doc(db, 'estadoSistema', `tramite_${cita.tramiteID}`), payload, { merge: true });
      }
    } catch (e) {
      console.error('Error llamando cita:', e);
      alert('Error al llamar la cita. Revisa consola.');
    }
  };

  const rows = useMemo(() => {
    return citas.map(c => {
      const tramiteNombre = tramitesMap[c.tramiteID] || c.tramiteID || 'Trámite';
      const fecha = c.fechaHora?.toDate ? format(c.fechaHora.toDate(), 'dd/MM/yyyy HH:mm') : '—';
      return { ...c, tramiteNombre, fecha };
    });
  }, [citas, tramitesMap]);

  return (
    <div>
      <h2 style={styles.title}>Citas Web (Agendadas)</h2>

      {rows.length === 0 ? (
        <div style={styles.empty}>No hay citas agendadas activas para atender en este momento.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Código</th>
              <th style={styles.th}>Trámite</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const disabled = !!atencionActual;
              return (
                <tr key={c.id}>
                  <td style={styles.td}><strong>{c.codigo}</strong></td>
                  <td style={styles.td}>{c.tramiteNombre}</td>
                  <td style={styles.td}>{c.fecha}</td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.btn, ...(disabled ? styles.btnDisabled : {}) }}
                      disabled={disabled}
                      onClick={() => llamarCita(c)}
                      title={disabled ? 'Finaliza la atención actual para llamar otra' : 'Llamar cita'}
                    >
                      Llamar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
