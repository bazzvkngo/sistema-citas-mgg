import React, { useEffect, useMemo, useState } from 'react';
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
  const [nowMs, setNowMs] = useState(Date.now());

  const [pendingTurnos, setPendingTurnos] = useState(0);
  const [citasHoy, setCitasHoy] = useState([]);

  const [turnosList, setTurnosList] = useState([]);
  const [citasList, setCitasList] = useState([]);

  const [loadingCall, setLoadingCall] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const qTurnos = query(collection(db, 'turnos'), where('estado', '==', 'pendiente'));
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
      where('estado', '==', 'pendiente'),
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
    if (loadingCall) return;

    if (!moduloEfectivo) return alert('Asigna un módulo para poder llamar.');
    if (atencionActual) return alert('Ya hay una atención activa. Finaliza primero.');

    setLoadingCall(true);
    try {
      const fn = httpsCallable(functions, 'agentCallNext');
      const res = await fn({ modulo: moduloEfectivo || null });

      if (!res?.data?.called) alert(res?.data?.message || 'No se pudo llamar el siguiente.');
    } catch (e) {
      alert(e?.message || 'Error llamando siguiente.');
    } finally {
      setLoadingCall(false);
    }
  };

  const callDisabled = loadingCall || !moduloEfectivo || !!atencionActual;

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <div>
          <h3 style={styles.title}>Cola unificada</h3>
          <p style={styles.sub}>
            Prioridad: <b>WEB</b> (si está dentro de hora) → <b>KIOSKO</b>
          </p>
        </div>

        <div style={styles.badges}>
          <span style={styles.chip('kiosko')}>
            <span style={styles.chipDot('#6c757d')} />
            Kiosko <span style={styles.chipValue}>{pendingTurnos}</span>
          </span>

          <span style={styles.chip('web')}>
            <span style={styles.chipDot('#0d6efd')} />
            Web (elegibles) <span style={styles.chipValue}>{pendingCitas}</span>
          </span>
        </div>
      </div>

      <div style={styles.callBox}>
        <div style={styles.callHeader}>
          <div>
            <div style={styles.callTitle}>Llamado simple</div>
            <div style={styles.callText}>
              El sistema decide automáticamente si corresponde <b>KIOSKO</b> o <b>WEB</b> según prioridad.
            </div>
          </div>
          <div style={styles.callTotal}>
            Pendientes totales: <b>{totalPendientes}</b>
          </div>
        </div>

        <button
          type="button"
          onClick={callNext}
          disabled={callDisabled}
          title={!moduloEfectivo ? 'Asigna un módulo para poder llamar.' : (atencionActual ? 'Finaliza la atención actual.' : '')}
          style={{
            ...styles.callBtn,
            opacity: callDisabled ? 0.6 : 1,
            cursor: callDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingCall ? 'Llamando...' : 'Llamar siguiente'}
        </button>

        <button type="button" onClick={() => setShowDetail((v) => !v)} style={styles.detailBtn}>
          {showDetail ? 'Ocultar detalle' : 'Ver detalle'}
        </button>

        {showDetail && (
          <div style={styles.detailBox}>
            <div style={styles.detailTitle}>Detalle de pendientes</div>
            <div style={styles.detailHint}>Lista unificada por prioridad (máx. 120).</div>

            <div style={styles.tableWrap}>
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
                  {unifiedList.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={4}>Sin pendientes.</td>
                    </tr>
                  ) : (
                    unifiedList.map((r) => (
                      <tr key={`${r.tipo}-${r.id}`}>
                        <td style={styles.td}><b>{r.tipo}</b></td>
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
    background: '#fff',
    borderRadius: 16,
    padding: 18,
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
  },
  topRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingBottom: 10,
    borderBottom: '1px solid rgba(0,0,0,0.06)'
  },
  title: { margin: 0, fontSize: 22 },
  sub: { margin: '6px 0 0', color: '#555', fontSize: 13 },
  badges: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  chip: (type) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.08)',
    background: type === 'web' ? 'rgba(13,110,253,0.06)' : 'rgba(108,117,125,0.08)',
    fontSize: 13,
  }),
  chipDot: (c) => ({ width: 10, height: 10, borderRadius: 999, background: c }),
  chipValue: { fontWeight: 800, marginLeft: 4 },

  callBox: { marginTop: 14 },
  callHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  callTitle: { fontSize: 18, fontWeight: 800, color: '#0d6efd' },
  callText: { marginTop: 6, fontSize: 13, color: '#555', maxWidth: 520 },
  callTotal: { fontSize: 13, color: '#555', alignSelf: 'center' },

  callBtn: {
    width: '100%',
    marginTop: 10,
    border: 'none',
    borderRadius: 12,
    padding: '14px 16px',
    fontWeight: 900,
    fontSize: 18,
    background: '#0d6efd',
    color: '#fff'
  },
  detailBtn: {
    marginTop: 10,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.12)',
    background: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },

  detailBox: {
    marginTop: 12,
    borderRadius: 14,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: 12
  },
  detailTitle: { fontWeight: 900, fontSize: 13 },
  detailHint: { marginTop: 4, fontSize: 12, color: '#666', fontWeight: 700 },

  tableWrap: { marginTop: 10, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: 10, borderBottom: '1px solid rgba(0,0,0,0.08)', fontSize: 12 },
  td: { padding: 10, borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 12 }
};