import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, functions } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

function getLocalDateISOChile() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDayRangeISO(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

export default function AgentQueue({ atencionActual, moduloEfectivo }) {
  const callInFlightRef = useRef(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const [pendingTurnos, setPendingTurnos] = useState(0);
  const [citasHoy, setCitasHoy] = useState([]);

  const [turnosList, setTurnosList] = useState([]);
  const [citasList, setCitasList] = useState([]);

  const [loadingCall, setLoadingCall] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [callFeedback, setCallFeedback] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const qTurnos = query(collection(db, 'turnos'), where('estado', '==', 'en-espera'));
    const unsub = onSnapshot(qTurnos, (snap) => setPendingTurnos(snap.size));
    return () => unsub();
  }, []);

  useEffect(() => {
    const todayISO = getLocalDateISOChile();
    const { start, end } = buildDayRangeISO(todayISO);

    const qCitas = query(
      collection(db, 'citas'),
      where('estado', '==', 'activa'),
      where('fechaHora', '>=', start),
      where('fechaHora', '<=', end)
    );

    const unsub = onSnapshot(qCitas, (snap) => {
      setCitasHoy(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const todayISO = getLocalDateISOChile();
    const { start, end } = buildDayRangeISO(todayISO);

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
      orderBy('fechaHora', 'asc'),
      limit(80)
    );

    const unsubTurnos = onSnapshot(qTurnosList, (snap) => setTurnosList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsubCitas = onSnapshot(qCitasList, (snap) => setCitasList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    return () => {
      unsubTurnos();
      unsubCitas();
    };
  }, []);

  const pendingCitas = useMemo(() => {
    return (citasHoy || []).filter((c) => {
      const ms = c?.fechaHora?.toDate ? c.fechaHora.toDate().getTime() : null;
      return !!ms && ms <= nowMs;
    }).length;
  }, [citasHoy, nowMs]);

  const totalPendientes = pendingTurnos + pendingCitas;

  const unifiedList = useMemo(() => {
    const turnosRows = (turnosList || []).map((t) => ({
      id: t.id,
      tipo: 'KIOSKO',
      codigo: t.codigo || '',
      dni: t.dni || '',
      tramiteID: t.tramiteID || '',
      tramiteNombre: t.tramiteNombre || '',
      effectiveMs: t.fechaHoraGenerado?.toDate ? t.fechaHoraGenerado.toDate().getTime() : 0
    }));

    const citasRows = (citasList || [])
      .map((c) => ({
        id: c.id,
        tipo: 'WEB',
        codigo: c.codigo || '',
        dni: c.dni || '',
        tramiteID: c.tramiteID || '',
        tramiteNombre: c.tramiteNombre || '',
        effectiveMs: c.fechaHora?.toDate ? c.fechaHora.toDate().getTime() : 0
      }))
      .filter((c) => c.effectiveMs && c.effectiveMs <= nowMs);

    return [...citasRows, ...turnosRows]
      .sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'WEB' ? -1 : 1;
        return a.effectiveMs - b.effectiveMs;
      })
      .slice(0, 120);
  }, [turnosList, citasList, nowMs]);

  const callNext = async () => {
    if (loadingCall || callInFlightRef.current) return;

    if (!moduloEfectivo) {
      setCallFeedback('Debes asignar un modulo antes de llamar al siguiente turno.');
      return;
    }
    if (atencionActual) {
      setCallFeedback('Debes finalizar la atencion actual antes de llamar al siguiente turno.');
      return;
    }

    callInFlightRef.current = true;
    setLoadingCall(true);
    setCallFeedback('');
    try {
      const fn = httpsCallable(functions, 'agentCallNext');
      const res = await fn({ modulo: moduloEfectivo || null });

      if (!res?.data?.called) setCallFeedback(res?.data?.message || 'No se pudo llamar el siguiente.');
    } catch (e) {
      setCallFeedback(e?.message || 'Error llamando siguiente.');
    } finally {
      callInFlightRef.current = false;
      setLoadingCall(false);
    }
  };

  useEffect(() => {
    if (!callFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setCallFeedback(''), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [callFeedback]);

  const callDisabled = loadingCall || !moduloEfectivo || !!atencionActual;

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <div>
          <h3 style={styles.title}>Cola unificada</h3>
          <p style={styles.sub}>Prioridad: WEB elegible, luego KIOSKO.</p>
        </div>

        <div style={styles.badges}>
          <span style={styles.chip('kiosko')}>
            <span style={styles.chipDot('#64748b')} />
            Kiosko <span style={styles.chipValue}>{pendingTurnos}</span>
          </span>

          <span style={styles.chip('web')}>
            <span style={styles.chipDot('#2563eb')} />
            Web <span style={styles.chipValue}>{pendingCitas}</span>
          </span>
        </div>
      </div>

      <div style={styles.callBox}>
        <div style={styles.callHeader}>
          <div>
            <div style={styles.callTitle}>Llamado simple</div>
            <div style={styles.callText}>Llamado automatico segun prioridad.</div>
          </div>

          <div style={styles.callTotal}>
            <span style={styles.callTotalLabel}>Pendientes</span>
            <strong style={styles.callTotalValue}>{totalPendientes}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={callNext}
          disabled={callDisabled}
          title={!moduloEfectivo ? 'Asigna un modulo para poder llamar.' : atencionActual ? 'Debes finalizar la atencion actual.' : ''}
          style={{
            ...styles.callBtn,
            opacity: callDisabled ? 0.6 : 1,
            cursor: callDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingCall ? 'Llamando...' : 'Llamar siguiente'}
        </button>

        {callFeedback ? (
          <div style={styles.feedbackBox}>
            {callFeedback}
          </div>
        ) : null}

        <button type="button" onClick={() => setShowDetail((v) => !v)} style={styles.detailBtn}>
          {showDetail ? 'Ocultar detalle' : 'Ver detalle'}
        </button>

        {showDetail && (
          <div style={styles.detailBox}>
            <div style={styles.detailTitle}>Detalle de pendientes</div>
            <div style={styles.detailHint}>Orden actual de atencion.</div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Tramite</th>
                    <th style={styles.th}>Codigo</th>
                    <th style={styles.th}>DNI/RUT</th>
                  </tr>
                </thead>
                <tbody>
                  {unifiedList.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        Sin pendientes.
                      </td>
                    </tr>
                  ) : (
                    unifiedList.map((r) => (
                      <tr key={`${r.tipo}-${r.id}`}>
                        <td style={styles.td}>
                          <strong>{r.tipo}</strong>
                        </td>
                        <td style={styles.td}>{r.tramiteNombre || r.tramiteID}</td>
                        <td style={styles.td}>{r.codigo}</td>
                        <td style={styles.td}>{r.dni}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.97) 100%)',
    borderRadius: 22,
    padding: 20,
    border: '1px solid rgba(148,163,184,0.16)',
    boxShadow: '0 20px 42px rgba(15,23,42,0.08)',
  },
  topRow: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingBottom: 14,
    borderBottom: '1px solid rgba(148,163,184,0.14)'
  },
  title: { margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' },
  sub: { margin: '6px 0 0', color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' },
  badges: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  chip: (type) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '9px 13px',
    border: '1px solid rgba(148,163,184,0.16)',
    background:
      type === 'web'
        ? 'linear-gradient(180deg, #eef4ff 0%, #dfeafe 100%)'
        : 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
    fontSize: 11,
    fontWeight: 900,
    color: type === 'web' ? '#1d4ed8' : '#334155',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    boxShadow: '0 10px 20px rgba(15,23,42,0.05)'
  }),
  chipDot: (c) => ({ width: 8, height: 8, borderRadius: 999, background: c }),
  chipValue: { fontWeight: 900, marginLeft: 2 },

  callBox: {
    marginTop: 16,
    padding: '18px 18px 16px',
    borderRadius: 20,
    border: '1px solid rgba(59,130,246,0.12)',
    background: 'radial-gradient(circle at top left, rgba(239,246,255,0.96) 0%, rgba(255,255,255,0.98) 60%, rgba(248,250,252,0.98) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.82), 0 18px 34px rgba(37,99,235,0.07)'
  },
  callHeader: { display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' },
  callTitle: { fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' },
  callText: { marginTop: 5, fontSize: 12, color: '#64748b', fontWeight: 700, letterSpacing: '0.02em' },
  callTotal: {
    minWidth: 118,
    padding: '10px 12px',
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 18px rgba(15,23,42,0.05)',
    display: 'grid',
    gap: 2,
    justifyItems: 'end'
  },
  callTotalLabel: {
    fontSize: 10,
    fontWeight: 900,
    color: '#64748b',
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  callTotalValue: {
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.04em'
  },

  callBtn: {
    width: '100%',
    marginTop: 14,
    border: 'none',
    borderRadius: 16,
    padding: '15px 18px',
    fontWeight: 900,
    fontSize: 17,
    letterSpacing: '0.01em',
    background: 'linear-gradient(135deg, #0b5ed7 0%, #0f4fb6 100%)',
    color: '#fff',
    boxShadow: '0 18px 28px rgba(13,94,215,0.22)'
  },
  detailBtn: {
    marginTop: 10,
    padding: '10px 14px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    fontWeight: 800,
    color: '#334155',
    cursor: 'pointer'
  },
  feedbackBox: {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(245, 158, 11, 0.28)',
    background: 'linear-gradient(180deg, #fff9eb 0%, #fff4d6 100%)',
    color: '#92400e',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45
  },

  detailBox: {
    marginTop: 12,
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(255,255,255,0.88)',
    padding: 14
  },
  detailTitle: { fontWeight: 900, fontSize: 13, color: '#0f172a', letterSpacing: '0.01em' },
  detailHint: { marginTop: 4, fontSize: 12, color: '#64748b', fontWeight: 700 },

  tableWrap: { marginTop: 10, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: 10,
    borderBottom: '1px solid rgba(148,163,184,0.14)',
    fontSize: 11,
    color: '#64748b',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  td: { padding: 10, borderBottom: '1px solid rgba(148,163,184,0.08)', fontSize: 12, color: '#0f172a' }
};
