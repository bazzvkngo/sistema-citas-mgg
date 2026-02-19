// src/pages/AgentPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AgentAppointments from '../components/agent/AgentAppointments';
import AgentQueue from '../components/agent/AgentQueue';
import FinishServiceModal from '../components/agent/FinishServiceModal';
import AdminClosedAppointments from '../components/admin/AdminClosedAppointments';
import CitizenProfile from '../components/agent/CitizenProfile';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../firebase';

import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';

const FUNCTIONS_REGION = 'southamerica-west1';

const styles = {
  page: {
    padding: 18,
    fontFamily: 'Arial, sans-serif',
    maxWidth: 1240,
    margin: '0 auto'
  },

  // Top bar (compact)
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14
  },
  titleWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { margin: 0, fontSize: 20, fontWeight: 900, color: '#C8102E' },
  subtitle: { margin: 0, fontSize: 12, fontWeight: 700, color: '#666' },

  rightWrap: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

  pill: (variant = 'neutral') => {
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
      color: '#111',
      boxShadow: '0 6px 14px rgba(0,0,0,0.05)'
    };
    if (variant === 'primary') return { ...base, background: '#f3f4f6' };
    if (variant === 'danger') return { ...base, background: '#ffecec', border: '1px solid #ffd0d0', color: '#7a0000' };
    return base;
  },

  smallBtn: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#111',
    borderRadius: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12
  },
  smallBtnDanger: { border: '1px solid #ffd0d0', background: '#fff5f5', color: '#7a0000' },
  smallBtnDisabled: { opacity: 0.65, cursor: 'not-allowed' },

  select: {
    padding: '10px 10px',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontWeight: 900,
    fontSize: 12
  },

  // Main grid
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.05fr 0.95fr',
    gap: 14
  },
  gridSingle: { gridTemplateColumns: '1fr' },

  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 6px 16px rgba(0,0,0,0.06)'
  },
  cardHead: {
    padding: 14,
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap'
  },
  cardBody: { padding: 14 },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 900, color: '#111' },
  cardHint: { margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: '#666', maxWidth: 640 },

  // Current attention
  currentCode: { margin: '8px 0 0', fontSize: 28, fontWeight: 900, color: '#0b3d91', letterSpacing: 0.4 },
  currentMetaRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 },
  metaItem: { fontSize: 12, fontWeight: 800, color: '#111', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '8px 10px', borderRadius: 12 },

  primaryBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 14,
    background: '#16a34a',
    color: '#fff',
    boxShadow: '0 10px 18px rgba(22, 163, 74, 0.22)'
  },
  primaryBtnDisabled: { background: '#d9d9d9', color: '#666', cursor: 'not-allowed', boxShadow: 'none' },

  // Tabs (right column)
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    padding: 12,
    borderBottom: '1px solid #f1f5f9'
  },
  tabBtn: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#111',
    borderRadius: 999,
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12
  },
  tabActive: { border: '1px solid #cfe0ff', background: '#eaf2ff', color: '#0b3d91' },
  tabDisabled: { opacity: 0.6, cursor: 'not-allowed' }
};

function getLocalDateISOChile() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getFriendlyFirebaseError(err) {
  const code = err?.code || '';
  const msg = err?.message || 'Error';

  if (code.includes('permission-denied')) return 'No tienes permisos para cerrar la jornada.';
  if (code.includes('unauthenticated')) return 'Sesión no válida. Vuelve a iniciar sesión.';
  if (code.includes('failed-precondition')) {
    return 'Faltan índices en Firestore para ejecutar el cierre masivo. Revisa Firestore > Indexes.';
  }
  if (code.includes('internal')) return 'Error interno en la función. Revisa los logs de Cloud Functions.';

  return msg;
}

function normalizeModuloValue(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  const n = parseInt(String(v).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export default function AgentPanel() {
  const { currentUser } = useAuth();
  const [closingDay, setClosingDay] = useState(false);

  const [calledTurno, setCalledTurno] = useState(null);
  const [calledCita, setCalledCita] = useState(null);

  const [showFinishModal, setShowFinishModal] = useState(false);

  // Tabs: right column content
  const [activeTab, setActiveTab] = useState('cola'); // 'cola' | 'web' | 'cerradas' | 'citizens'

  // filtro por módulo (solo admin). si el usuario tiene módulo asignado, manda ese.
  const [moduloFiltro, setModuloFiltro] = useState(null);

  const isAdmin = useMemo(() => {
    const r = currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil;
    return r === 'admin' || currentUser?.isAdmin === true;
  }, [currentUser]);

  const isStaff = useMemo(() => {
    const r = currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil;
    return r === 'admin' || r === 'agente' || currentUser?.isAdmin === true;
  }, [currentUser]);

  const moduloAsignado = useMemo(
    () => normalizeModuloValue(currentUser?.moduloAsignado),
    [currentUser?.moduloAsignado]
  );
  const moduloSeleccionado = useMemo(() => normalizeModuloValue(moduloFiltro), [moduloFiltro]);

  // modulo efectivo: si el usuario tiene módulo asignado, se usa ese. si no, usa el filtro (admin).
  const moduloEfectivo = useMemo(() => {
    return moduloAsignado || moduloSeleccionado || null;
  }, [moduloAsignado, moduloSeleccionado]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) return;

    if (moduloAsignado) {
      setModuloFiltro(moduloAsignado);
    } else if (moduloFiltro === null) {
      setModuloFiltro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin, moduloAsignado]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setCalledTurno(null);
      setCalledCita(null);
      return;
    }

    // Para el “filtro por módulo”, filtramos SOLO la atención “llamado”
    const filtroModulo = isAdmin ? moduloSeleccionado : moduloAsignado;

    const qTurnos = filtroModulo
      ? query(
          collection(db, 'turnos'),
          where('estado', '==', 'llamado'),
          where('modulo', '==', filtroModulo),
          limit(1)
        )
      : query(collection(db, 'turnos'), where('estado', '==', 'llamado'), limit(1));

    const qCitas = filtroModulo
      ? query(
          collection(db, 'citas'),
          where('estado', '==', 'llamado'),
          where('moduloAsignado', '==', filtroModulo),
          limit(1)
        )
      : query(collection(db, 'citas'), where('estado', '==', 'llamado'), limit(1));

    const unsubTurnos = onSnapshot(qTurnos, (snap) => {
      if (snap.empty) return setCalledTurno(null);
      const d = snap.docs[0];
      const data = d.data() || {};
      setCalledTurno({
        id: d.id,
        tipo: 'Turno',
        codigo: data.codigo,
        tramiteID: data.tramiteID,
        // ✅ IMPORTANTE: traer módulo para que al finalizar quede registrado
        modulo: data.modulo ?? null
      });
    });

    const unsubCitas = onSnapshot(qCitas, (snap) => {
      if (snap.empty) return setCalledCita(null);
      const d = snap.docs[0];
      const data = d.data() || {};
      setCalledCita({
        id: d.id,
        tipo: 'Cita',
        codigo: data.codigo,
        tramiteID: data.tramiteID,
        // ✅ IMPORTANTE: traer móduloAsignado para que al finalizar quede registrado
        moduloAsignado: data.moduloAsignado ?? null
      });
    });

    return () => {
      unsubTurnos();
      unsubCitas();
    };
  }, [currentUser, isAdmin, moduloAsignado, moduloSeleccionado]);

  const atencionActual = calledTurno || calledCita;

  useEffect(() => {
    if (atencionActual) setShowFinishModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atencionActual?.id]);

  const cerrarJornada = async () => {
    if (closingDay) return;

    const ok = window.confirm(
      'Esto cerrará todas las citas y turnos activos del día y los marcará como NO_SE_PRESENTO.\n¿Desea continuar?'
    );
    if (!ok) return;

    setClosingDay(true);
    try {
      const functions = getFunctions(app, FUNCTIONS_REGION);
      const fn = httpsCallable(functions, 'cerrarJornadaMasiva');

      const dateISO = getLocalDateISOChile();
      const res = await fn({ dateISO, motivo: 'cierre_contingencia' });

      const citasCerradas = res?.data?.citasCerradas ?? 0;
      const turnosCerrados = res?.data?.turnosCerrados ?? 0;

      alert(`Jornada cerrada.\nCitas cerradas: ${citasCerradas}\nTurnos cerrados: ${turnosCerrados}`);
    } catch (err) {
      console.error('Error al cerrar jornada:', err);
      alert(getFriendlyFirebaseError(err));
    } finally {
      setClosingDay(false);
    }
  };

  const onFinalizarExito = (tipo, codigo) => {
    setShowFinishModal(false);
    alert(`${tipo} finalizado correctamente: ${codigo}`);
  };

  const moduloLabel = moduloEfectivo ? `Módulo ${moduloEfectivo}` : 'Sin módulo';
  const rolLabel = (currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil || 'usuario').toString();

  const gridStyle = useMemo(() => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 980 : false;
    return isMobile ? { ...styles.grid, ...styles.gridSingle } : styles.grid;
  }, []);

  return (
    <div style={styles.page} className="page-container">
      {/* TOP BAR */}
      <div style={styles.topbar}>
        <div style={styles.titleWrap}>
          <h1 style={styles.title}>Panel de Atención</h1>
          <p style={styles.subtitle}>
            {currentUser?.email ? <strong>{currentUser.email}</strong> : '—'} · {rolLabel} · {moduloLabel}
          </p>
        </div>

        <div style={styles.rightWrap}>
          <span style={styles.pill('primary')}>
            {moduloAsignado ? `Módulo asignado: ${moduloAsignado}` : 'Módulo asignado: —'}
          </span>

          {isAdmin && (
            <>
              <select
                style={styles.select}
                value={moduloFiltro ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setModuloFiltro(v === '' ? null : parseInt(v, 10));
                }}
                title="Filtrar atención por módulo (solo admin)"
              >
                <option value="">Todos / Sin filtro</option>
                {Array.from({ length: 10 }).map((_, idx) => {
                  const n = idx + 1;
                  return (
                    <option key={n} value={n}>
                      Módulo {n}
                    </option>
                  );
                })}
              </select>

              <button
                onClick={cerrarJornada}
                disabled={!currentUser || closingDay}
                style={{
                  ...styles.smallBtn,
                  ...styles.smallBtnDanger,
                  ...((!currentUser || closingDay) ? styles.smallBtnDisabled : {})
                }}
                title="Cierra todas las citas y turnos activos del día"
              >
                {closingDay ? 'Cerrando…' : 'Cerrar jornada'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={gridStyle}>
        {/* LEFT: Atención actual */}
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <p style={styles.cardTitle}>Atención actual</p>
              <p style={styles.cardHint}>
                El llamado se realiza desde <strong>“Llamar siguiente”</strong>. Aquí solo se muestra lo que está en estado <strong>LLAMADO</strong>.
              </p>
            </div>

            <span style={styles.pill(atencionActual ? 'primary' : 'neutral')}>
              {atencionActual ? 'EN ATENCIÓN' : 'SIN ATENCIÓN'}
            </span>
          </div>

          <div style={styles.cardBody}>
            {!atencionActual ? (
              <div style={{ fontSize: 13, fontWeight: 800, color: '#555' }}>
                No hay una atención activa en este momento.
                {!moduloEfectivo ? (
                  <>
                    <br />
                    <span style={{ color: '#7a0000' }}>Asigna un módulo para poder llamar.</span>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#666' }}>{atencionActual.tipo}</div>
                    <div style={styles.currentCode}>{atencionActual.codigo}</div>
                  </div>
                  <span style={styles.pill(atencionActual.tipo === 'Cita' ? 'primary' : 'neutral')}>
                    {atencionActual.tipo === 'Cita' ? 'WEB' : 'KIOSKO'}
                  </span>
                </div>

                <div style={styles.currentMetaRow}>
                  <div style={styles.metaItem}>
                    Trámite: <strong>{atencionActual.tramiteID || '—'}</strong>
                  </div>
                  <div style={styles.metaItem}>
                    {atencionActual.tipo === 'Cita' ? (
                      <>Módulo: <strong>{atencionActual.moduloAsignado ?? '—'}</strong></>
                    ) : (
                      <>Módulo: <strong>{atencionActual.modulo ?? '—'}</strong></>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button style={styles.primaryBtn} onClick={() => setShowFinishModal(true)}>
                    Finalizar atención
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Cola / Web / Cerradas / Ciudadanos */}
        <div style={styles.card}>
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tabBtn, ...(activeTab === 'cola' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('cola')}
            >
              Cola & Llamado
            </button>

            <button
              style={{ ...styles.tabBtn, ...(activeTab === 'web' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('web')}
            >
              Citas Web (hoy)
            </button>

            <button
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'cerradas' ? styles.tabActive : {}),
                ...(!isStaff ? styles.tabDisabled : {})
              }}
              onClick={() => isStaff && setActiveTab('cerradas')}
              disabled={!isStaff}
              title={!isStaff ? 'No autorizado' : 'Ver citas cerradas'}
            >
              Cerradas
            </button>

            <button
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'citizens' ? styles.tabActive : {}),
                ...(!isStaff ? styles.tabDisabled : {})
              }}
              onClick={() => isStaff && setActiveTab('citizens')}
              disabled={!isStaff}
              title={!isStaff ? 'No autorizado' : 'Perfil de ciudadano'}
            >
              Ciudadanos
            </button>
          </div>

          <div style={styles.cardBody}>
            {activeTab === 'cola' && (
              <AgentQueue atencionActual={atencionActual} moduloEfectivo={moduloEfectivo} />
            )}

            {activeTab === 'web' && (
              <AgentAppointments atencionActual={atencionActual} moduloEfectivo={moduloEfectivo} />
            )}

            {activeTab === 'cerradas' && (
              <AdminClosedAppointments />
            )}

            {activeTab === 'citizens' && (
              <CitizenProfile />
            )}
          </div>
        </div>
      </div>

      {showFinishModal && atencionActual && (
        <FinishServiceModal
          turnoEnAtencion={atencionActual}
          onClose={() => setShowFinishModal(false)}
          onFinalizarExito={onFinalizarExito}
        />
      )}
    </div>
  );
}
