// src/components/agent/AgentQueue.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getAuth } from 'firebase/auth';

const styles = {
  container: { width: '100%' },
  title: { fontSize: 22, color: '#C8102E', marginBottom: 16, fontWeight: 800 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))',
    gap: 18
  },

  card: {
    border: '2px solid #0d6efd',
    borderRadius: 16,
    padding: 18,
    background: '#fff',
    boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
    minHeight: 240,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },

  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },

  tramiteTitle: {
    fontSize: 20,
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.2
  },

  centerArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 0'
  },

  count: {
    fontSize: 78,
    fontWeight: 900,
    color: '#0d6efd',
    margin: 0,
    lineHeight: 1
  },

  sub: {
    margin: '6px 0 0',
    color: '#666',
    fontWeight: 700,
    fontSize: 14
  },

  footer: {
    marginTop: 12
  },

  btn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 16,
    transition: 'transform 0.04s ease'
  },

  btnEnabled: {
    background: '#0d6efd',
    color: '#fff'
  },

  btnDisabled: {
    background: '#d9d9d9',
    color: '#666',
    cursor: 'not-allowed'
  },

  empty: {
    padding: 14,
    border: '1px solid #ddd',
    borderRadius: 10,
    background: '#fff',
    color: '#444',
    fontWeight: 600
  },

  bigListBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#fff'
  },
  bigListTitle: { margin: 0, fontWeight: 900, color: '#111', fontSize: 14 },
  bigListSub: { margin: '6px 0 0', color: '#666', fontWeight: 700, fontSize: 12 },
  bigTable: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: 10, background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: 12 },
  td: { padding: 10, borderBottom: '1px solid #f1f5f9', fontSize: 12, verticalAlign: 'top' }
};

export default function AgentQueue({ atencionActual, moduloEfectivo }) {
  const [tramites, setTramites] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [waitingList, setWaitingList] = useState([]); // lista informativa grande

  useEffect(() => {
    const fetchTramites = async () => {
      try {
        const snap = await getDocs(collection(db, 'tramites'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTramites(list);
      } catch (e) {
        console.error('Error cargando tramites:', e);
      }
    };
    fetchTramites();
  }, []);

  useEffect(() => {
    if (!tramites.length) return;

    setLoading(true);

    const unsubs = tramites.map((t) => {
      const q = query(
        collection(db, 'turnos'),
        where('tramiteID', '==', t.id),
        where('estado', '==', 'en-espera')
      );

      return onSnapshot(q, (snap) => {
        setCounts(prev => ({ ...prev, [t.id]: snap.size }));
        setLoading(false);
      });
    });

    return () => unsubs.forEach(u => u());
  }, [tramites]);

  // Lista grande informativa: últimos turnos en espera (ordenados)
  useEffect(() => {
    const qWait = query(
      collection(db, 'turnos'),
      where('estado', '==', 'en-espera'),
      orderBy('fechaHoraGenerado', 'asc'),
      limit(200)
    );

    const unsub = onSnapshot(qWait, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setWaitingList(list);
    });

    return () => unsub();
  }, []);

  const llamarSiguiente = async (tramiteId, tramiteNombre) => {
    try {
      const modulo = moduloEfectivo;
      if (!modulo) return alert('No tienes módulo asignado.');

      if (atencionActual) {
        return alert(`Ya estás atendiendo un ${atencionActual.tipo} (${atencionActual.codigo}). Finaliza antes de llamar otro.`);
      }

      const qTurno = query(
        collection(db, 'turnos'),
        where('tramiteID', '==', tramiteId),
        where('estado', '==', 'en-espera'),
        orderBy('fechaHoraGenerado', 'asc'),
        limit(1)
      );

      const snap = await getDocs(qTurno);
      if (snap.empty) return alert('No hay turnos en espera.');

      const turnoDoc = snap.docs[0];
      const turnoData = turnoDoc.data();
      const turnoRef = doc(db, 'turnos', turnoDoc.id);

      const codigoTurno =
        turnoData.codigo ||
        turnoData.codigoTurno ||
        turnoData.turnoCodigo ||
        turnoData.numero ||
        turnoData.nro ||
        turnoDoc.id;

      const uid = getAuth().currentUser?.uid || '';

      await updateDoc(turnoRef, {
        estado: 'llamado',
        modulo: modulo,
        tramiteNombre: tramiteNombre || '',
        agenteID: uid,
        llamadoAt: Timestamp.now()
      });

      const payload = {
        codigoLlamado: codigoTurno,
        modulo: modulo,
        timestamp: Timestamp.now(),
        agenteID: uid,
        tipo: 'Turno',
        tramiteID: tramiteId,
        tramiteNombre: tramiteNombre || ''
      };

      await setDoc(doc(db, 'estadoSistema', 'llamadaActual'), payload, { merge: true });
      await setDoc(doc(db, 'estadoSistema', `tramite_${tramiteId}`), payload, { merge: true });
    } catch (e) {
      console.error('Error llamando siguiente turno:', e);
      alert('Error al llamar el siguiente turno. Revisa consola.');
    }
  };

  // Cards: SOLO las que tienen gente en espera
  const cards = useMemo(() => {
    const list = tramites.map(t => ({
      ...t,
      count: counts[t.id] ?? 0
    }));
    return list.filter(t => t.count > 0);
  }, [tramites, counts]);

  // Lista informativa agrupada por trámite (para que se vea “grande” y útil)
  const waitingRows = useMemo(() => {
    if (!waitingList.length) return [];
    const byTramite = {};
    waitingList.forEach(t => {
      const key = t.tramiteID || 'sin_tramite';
      if (!byTramite[key]) byTramite[key] = [];
      byTramite[key].push(t);
    });

    const out = [];
    Object.keys(byTramite).forEach(tramiteID => {
      const nombre = tramites.find(x => x.id === tramiteID)?.nombre || tramiteID;
      byTramite[tramiteID].forEach(t => {
        const codigo =
          t.codigo || t.codigoTurno || t.turnoCodigo || t.numero || t.nro || t.id;
        const dni = t.dni || t.rut || t.documento || '';
        out.push({
          id: t.id,
          tramiteID,
          tramiteNombre: nombre,
          codigo,
          dni,
          fecha: t.fechaHoraGenerado?.toDate ? t.fechaHoraGenerado.toDate() : null
        });
      });
    });

    // orden global por fecha
    out.sort((a, b) => {
      const ta = a.fecha ? a.fecha.getTime() : 0;
      const tb = b.fecha ? b.fecha.getTime() : 0;
      return ta - tb;
    });

    return out;
  }, [waitingList, tramites]);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Colas Presenciales en Espera (Turnos Kiosko)</h2>

      {cards.length === 0 ? (
        <div style={styles.empty}>
          No hay turnos presenciales en espera en este momento.
        </div>
      ) : (
        <div style={styles.grid}>
          {cards.map((t) => {
            const disabled = loading || !!atencionActual;

            return (
              <div key={t.id} style={styles.card}>
                <div style={styles.header}>
                  <h3 style={styles.tramiteTitle}>{t.nombre}</h3>
                </div>

                <div style={styles.centerArea}>
                  <p style={styles.count}>{t.count}</p>
                  <p style={styles.sub}>en espera</p>
                </div>

                <div style={styles.footer}>
                  <button
                    style={{
                      ...styles.btn,
                      ...(disabled ? styles.btnDisabled : styles.btnEnabled)
                    }}
                    disabled={disabled}
                    onClick={() => llamarSiguiente(t.id, t.nombre)}
                    onMouseDown={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.transform = 'scale(0.99)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    Llamar Siguiente
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.bigListBox}>
        <p style={styles.bigListTitle}>Detalle turnos en espera (lista informativa)</p>
        <p style={styles.bigListSub}>
          Se muestra una lista ordenada por antigüedad (máximo 200).
        </p>

        {waitingRows.length === 0 ? (
          <div style={{ marginTop: 10, color: '#444', fontWeight: 700, fontSize: 12 }}>
            No hay registros en espera.
          </div>
        ) : (
          <table style={styles.bigTable}>
            <thead>
              <tr>
                <th style={styles.th}>Trámite</th>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>DNI/RUT</th>
              </tr>
            </thead>
            <tbody>
              {waitingRows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.tramiteNombre}</td>
                  <td style={styles.td}><strong>{r.codigo}</strong></td>
                  <td style={styles.td}>{r.dni || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
