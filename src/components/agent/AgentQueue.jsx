// src/components/agent/AgentQueue.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from 'firebase/firestore';
import { db, app } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const FUNCTIONS_REGION = 'southamerica-west1';

const styles = {
  container: { width: '100%' },

  // Header compacto
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12
  },
  title: { fontSize: 18, color: '#111', fontWeight: 900, margin: 0 },

  chipsRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  chip: (variant = 'neutral') => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      border: '1px solid #e5e7eb',
      background: '#fff',
      color: '#111'
    };

    if (variant === 'kiosko') return { ...base, background: '#f1f5f9' };
    if (variant === 'web') return { ...base, background: '#eaf2ff', border: '1px solid #cfe0ff' };
    if (variant === 'danger') return { ...base, background: '#ffecec', border: '1px solid #ffd0d0' };
    return base;
  },
  chipDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color
  }),
  chipValue: { fontSize: 14, fontWeight: 900 },

  // Card principal
  mainCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 16,
    background: '#fff',
    boxShadow: '0 6px 16px rgba(0,0,0,0.06)'
  },
  mainTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap'
  },
  mainTitle: { margin: 0, fontWeight: 900, fontSize: 16, color: '#0b3d91' },
  mainSub: { margin: '6px 0 0', color: '#666', fontWeight: 700, fontSize: 12, maxWidth: 560 },

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
  btnEnabled: { background: '#0d6efd', color: '#fff' },
  btnDisabled: { background: '#d9d9d9', color: '#666', cursor: 'not-allowed' },

  // Footer acciones
  actionsRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12
  },
  smallBtn: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#111',
    padding: '8px 10px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12
  },
  hint: { fontSize: 12, color: '#777', fontWeight: 700 },

  // Detalle colapsable
  detailBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    background: '#fff'
  },
  detailTitle: { margin: 0, fontWeight: 900, color: '#111', fontSize: 13 },
  detailSub: { margin: '6px 0 0', color: '#666', fontWeight: 700, fontSize: 12 },

  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: 10, background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: 12 },
  td: { padding: 10, borderBottom: '1px solid #f1f5f9', fontSize: 12, verticalAlign: 'top' },

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

function getLocalDateISOChile() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildDayRangeISO(dateISO) {
  const start = new Date(`${dateISO}T00:00:00.000-03:00`);
  const end = new Date(`${dateISO}T23:59:59.999-03:00`);
  return { start, end };
}

export default function AgentQueue({ atencionActual, moduloEfectivo }) {
  const [pendingTurnos, setPendingTurnos] = useState(0);
  const [pendingCitas, setPendingCitas] = useState(0);

  const [list, setList] = useState([]);
  const [calling, setCalling] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const totalPendientes = pendingTurnos + pendingCitas;

  // Turnos kiosko pendientes (en-espera)
  useEffect(() => {
    const qTurnos = query(
      collection(db, 'turnos'),
      where('estado', '==', 'en-espera')
    );

    const unsub = onSnapshot(qTurnos, (snap) => {
      setPendingTurnos(snap.size);
    });

    return () => unsub();
  }, []);

  // Citas web pendientes (activa) SOLO hoy y SOLO hasta ahora (para no llamar citas futuras)
  useEffect(() => {
    const todayISO = getLocalDateISOChile();
    const { start, end } = buildDayRangeISO(todayISO);
    const now = new Date();

    const qCitas = query(
      collection(db, 'citas'),
      where('estado', '==', 'activa'),
      where('fechaHora', '>=', start),
      where('fechaHora', '<=', end),
      where('fechaHora', '<=', now)
    );

    const unsub = onSnapshot(qCitas, (snap) => {
      setPendingCitas(snap.size);
    });

    return () => unsub();
  }, []);

  // Lista unificada informativa (máximo 120, ordenada por prioridad)
  useEffect(() => {
    const todayISO = getLocalDateISOChile();
    const { start, end } = buildDayRangeISO(todayISO);
    const now = new Date();

    const qTurnosList = query(
      collection(db, 'turnos'),
      where('estado', '==', 'en-espera'),
      orderBy('fechaHoraGenerado', 'asc'),
      limit(80)
    );

    const qCitasList = query(
      collection(db, 'citas'),
      where('estado', '==', 'activa'),
      where('fechaHora', '>=', start),
      where('fechaHora', '<=', end),
      where('fechaHora', '<=', now),
      orderBy('fechaHora', 'asc'),
      limit(80)
    );

    let turnosCache = [];
    let citasCache = [];

    const recompute = () => {
      const turnosRows = turnosCache.map((t) => ({
        id: t.id,
        tipo: 'KIOSKO',
        codigo: t.codigo || t.codigoTurno || t.turnoCodigo || t.numero || t.nro || t.id,
        dni: t.dni || t.rut || t.documento || '',
        tramiteID: t.tramiteID || '',
        tramiteNombre: t.tramiteNombre || '',
        effectiveMs: t.fechaHoraGenerado?.toDate ? t.fechaHoraGenerado.toDate().getTime() : 0
      }));

      const citasRows = citasCache.map((c) => ({
        id: c.id,
        tipo: 'WEB',
        codigo: c.codigo || '',
        dni: c.dni || '',
        tramiteID: c.tramiteID || '',
        tramiteNombre: c.tramiteNombre || '',
        effectiveMs: c.fechaHora?.toDate ? c.fechaHora.toDate().getTime() : 0
      }));

      const merged = [...turnosRows, ...citasRows]
        .sort((a, b) => a.effectiveMs - b.effectiveMs)
        .slice(0, 120);

      setList(merged);
    };

    const unsubTurnos = onSnapshot(qTurnosList, (snap) => {
      turnosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      recompute();
    });

    const unsubCitas = onSnapshot(qCitasList, (snap) => {
      citasCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      recompute();
    });

    return () => {
      unsubTurnos();
      unsubCitas();
    };
  }, []);

  const llamarSiguiente = async () => {
    if (calling) return;

    const modulo = moduloEfectivo;
    if (!modulo) return alert('No tienes módulo asignado.');

    if (atencionActual) {
      return alert(`Ya estás atendiendo un ${atencionActual.tipo} (${atencionActual.codigo}). Finaliza antes de llamar otro.`);
    }

    if (totalPendientes <= 0) {
      return alert('No hay pendientes por llamar.');
    }

    setCalling(true);
    try {
      const functions = getFunctions(app, FUNCTIONS_REGION);
      const fn = httpsCallable(functions, 'agentCallNext');
      const res = await fn({ modulo, sources: ['turnos', 'citas'] });

      const ok = res?.data?.called;
      if (!ok) {
        alert(res?.data?.message || 'No hay pendientes.');
      }
    } catch (e) {
      console.error('Error llamando siguiente:', e);
      alert(e?.message || 'Error al llamar siguiente.');
    } finally {
      setCalling(false);
    }
  };

  const disabled = calling || !!atencionActual || !moduloEfectivo;

  const explain = useMemo(() => {
    return 'El sistema decide automáticamente si corresponde KIOSKO o WEB según prioridad.';
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Cola unificada</h2>

        <div style={styles.chipsRow}>
          <span style={styles.chip('kiosko')}>
            <span style={styles.chipDot('#64748b')} />
            Kiosko <span style={styles.chipValue}>{pendingTurnos}</span>
          </span>

          <span style={styles.chip('web')}>
            <span style={styles.chipDot('#0d6efd')} />
            Web (hoy) <span style={styles.chipValue}>{pendingCitas}</span>
          </span>

          {!moduloEfectivo && (
            <span style={styles.chip('danger')}>
              Asigna un módulo para llamar
            </span>
          )}
        </div>
      </div>

      <div style={styles.mainCard}>
        <div style={styles.mainTop}>
          <div>
            <p style={styles.mainTitle}>Llamado simple</p>
            <p style={styles.mainSub}>{explain}</p>
          </div>

          <div style={styles.hint}>
            {atencionActual ? 'Tienes una atención en curso.' : `Pendientes totales: ${totalPendientes}`}
          </div>
        </div>

        <button
          style={{ ...styles.btn, ...(disabled ? styles.btnDisabled : styles.btnEnabled) }}
          disabled={disabled}
          onClick={llamarSiguiente}
          onMouseDown={(e) => {
            if (disabled) return;
            e.currentTarget.style.transform = 'scale(0.99)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {calling ? 'Llamando…' : 'Llamar siguiente'}
        </button>

        <div style={styles.actionsRow}>
          <button
            style={styles.smallBtn}
            onClick={() => setShowDetails((v) => !v)}
            type="button"
          >
            {showDetails ? 'Ocultar detalle' : 'Ver detalle'}
          </button>

          <span style={styles.hint}>
            (Solo informativo. El botón principal decide el siguiente.)
          </span>
        </div>

        {showDetails && (
          <div style={styles.detailBox}>
            <p style={styles.detailTitle}>Detalle de pendientes</p>
            <p style={styles.detailSub}>Lista unificada por prioridad (máx. 120).</p>

            {list.length === 0 ? (
              <div style={{ marginTop: 10, color: '#444', fontWeight: 800, fontSize: 12 }}>
                No hay registros en espera.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Trámite</th>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>DNI/RUT</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={`${r.tipo}_${r.id}`}>
                      <td style={styles.td}>
                        <span style={styles.badge(r.tipo === 'WEB' ? '#E5F0FF' : '#F1F5F9')}>
                          {r.tipo}
                        </span>
                      </td>
                      <td style={styles.td}>{r.tramiteNombre || r.tramiteID || '-'}</td>
                      <td style={styles.td}><strong>{r.codigo}</strong></td>
                      <td style={styles.td}>{r.dni || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
