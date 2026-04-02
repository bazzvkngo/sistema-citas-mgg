// src/pages/AgentPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
    padding: 28,
    maxWidth: 1360,
    margin: '0 auto',
    color: '#0f172a'
  },

  topbar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 22,
    flexWrap: 'wrap',
    marginBottom: 22
  },
  titleWrap: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#C8102E'
  },
  title: { margin: 0, fontSize: 38, lineHeight: 0.98, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em' },
  subtitle: { margin: 0, fontSize: 15, fontWeight: 600, color: '#475569', lineHeight: 1.55, maxWidth: 780 },

  rightWrap: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' },
  quickStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8
  },

  pill: (variant = 'neutral') => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
      color: '#0f172a',
      boxShadow: '0 12px 28px rgba(15,23,42,0.07)'
    };
    if (variant === 'primary') {
      return {
        ...base,
        background: 'linear-gradient(180deg, #eef4ff 0%, #e0ecff 100%)',
        border: '1px solid rgba(59,130,246,0.18)',
        color: '#1d4ed8'
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        background: 'linear-gradient(180deg, #fff4f5 0%, #ffe7ea 100%)',
        border: '1px solid #fecdd3',
        color: '#9f1239'
      };
    }
    return base;
  },

  smallBtn: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#0f172a',
    borderRadius: 16,
    padding: '11px 14px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: '0.02em',
    boxShadow: '0 12px 22px rgba(15,23,42,0.06)'
  },
  smallBtnDanger: {
    border: '1px solid #fecdd3',
    background: 'linear-gradient(180deg, #fff5f5 0%, #ffe8eb 100%)',
    color: '#9f1239'
  },
  smallBtnDisabled: { opacity: 0.65, cursor: 'not-allowed' },

  select: {
    padding: '11px 13px',
    borderRadius: 16,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    fontWeight: 900,
    fontSize: 12,
    color: '#0f172a',
    boxShadow: '0 10px 22px rgba(15,23,42,0.05)'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1.08fr 0.92fr',
    gap: 20
  },

  card: {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 26,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.97) 100%)',
    boxShadow: '0 24px 52px rgba(15,23,42,0.09)'
  },
  cardTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, rgba(200,16,46,0.36), rgba(59,130,246,0.12), rgba(15,23,42,0))'
  },
  cardHead: {
    padding: 20,
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap'
  },
  cardBody: { padding: 20 },
  cardTitle: { margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' },
  cardHint: { margin: '8px 0 0', fontSize: 14, fontWeight: 600, color: '#64748b', maxWidth: 700, lineHeight: 1.55 },

  currentHero: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    padding: '18px 20px',
    borderRadius: 22,
    border: '1px solid rgba(59,130,246,0.12)',
    background: 'radial-gradient(circle at top left, rgba(239,246,255,0.96) 0%, rgba(255,255,255,0.98) 58%, rgba(248,250,252,0.98) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 18px 34px rgba(37,99,235,0.08)'
  },
  currentType: { fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.14em' },
  currentCode: {
    margin: '12px 0 0',
    fontSize: 54,
    fontWeight: 900,
    color: '#0f3d91',
    letterSpacing: '-0.05em',
    lineHeight: 0.95,
    textShadow: '0 12px 28px rgba(37,99,235,0.14)'
  },
  currentMetaRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  metaItem: {
    fontSize: 12,
    fontWeight: 800,
    color: '#0f172a',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    padding: '10px 13px',
    borderRadius: 16,
    boxShadow: '0 10px 20px rgba(15,23,42,0.04)'
  },
  emptyState: {
    fontSize: 14,
    fontWeight: 700,
    color: '#475569',
    lineHeight: 1.65,
    padding: '18px 20px',
    borderRadius: 20,
    border: '1px dashed rgba(148, 163, 184, 0.28)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
  },

  primaryBtn: {
    width: '100%',
    padding: '15px 18px',
    borderRadius: 18,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 14,
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    color: '#fff',
    letterSpacing: '0.01em',
    boxShadow: '0 18px 30px rgba(22, 163, 74, 0.24)'
  },
  primaryBtnActive: {
    background: 'linear-gradient(135deg, #0f766e 0%, #0f9f8a 100%)',
    boxShadow: '0 22px 34px rgba(15, 118, 110, 0.28)'
  },

  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    padding: 18,
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.88) 100%)'
  },
  tabBtn: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#334155',
    borderRadius: 999,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    boxShadow: '0 8px 18px rgba(15,23,42,0.05)'
  },
  tabActive: {
    border: '1px solid rgba(59,130,246,0.18)',
    background: 'linear-gradient(180deg, #eef4ff 0%, #dfeafe 100%)',
    color: '#1d4ed8',
    boxShadow: '0 12px 22px rgba(37,99,235,0.12)'
  },
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
  if (code.includes('failed-precondition')) return 'Faltan índices en Firestore. Revisa Firestore > Indexes.';
  if (code.includes('internal')) return 'Error interno en la función. Revisa los logs de Cloud Functions.';

  return msg;
}

function normalizeModuloValue(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  const n = parseInt(String(v).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function useIsNarrow(breakpointPx = 980) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsNarrow(mql.matches);

    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isNarrow;
}

export default function AgentPanel() {
  const { currentUser } = useAuth();
  const closingDayRef = useRef(false);
  const [closingDay, setClosingDay] = useState(false);

  const [calledTurno, setCalledTurno] = useState(null);
  const [calledCita, setCalledCita] = useState(null);

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [activeTab, setActiveTab] = useState('cola'); // 'cola' | 'cerradas' | 'citizens'
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

  const moduloEfectivo = useMemo(() => {
    return moduloAsignado || moduloSeleccionado || null;
  }, [moduloAsignado, moduloSeleccionado]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) return;

    if (moduloAsignado) setModuloFiltro(moduloAsignado);
  }, [currentUser, isAdmin, moduloAsignado]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setCalledTurno(null);
      setCalledCita(null);
      return;
    }

    const filtroModulo = isAdmin ? moduloSeleccionado : moduloAsignado;

    const qTurnos = filtroModulo
      ? query(collection(db, 'turnos'), where('estado', '==', 'llamado'), where('modulo', '==', filtroModulo), limit(1))
      : query(collection(db, 'turnos'), where('estado', '==', 'llamado'), limit(1));

    const qCitas = filtroModulo
      ? query(collection(db, 'citas'), where('estado', '==', 'llamado'), where('moduloAsignado', '==', filtroModulo), limit(1))
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
        moduloAsignado: data.moduloAsignado ?? null
      });
    });

    return () => {
      unsubTurnos();
      unsubCitas();
    };
  }, [currentUser, isAdmin, moduloAsignado, moduloSeleccionado]);

  const atencionActual = calledTurno || calledCita;

  const cerrarJornada = async () => {
    if (closingDay || closingDayRef.current) return;

    const ok = window.confirm(
      'Esto cerrará todas las citas y turnos activos del día y los marcará como NO_SE_PRESENTO.\n¿Desea continuar?'
    );
    if (!ok) return;

    closingDayRef.current = true;
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
      closingDayRef.current = false;
      setClosingDay(false);
    }
  };

  const onFinalizarExito = (tipo, codigo) => {
    setShowFinishModal(false);
    alert(`${tipo} finalizado correctamente: ${codigo}`);
  };

  const moduloLabel = moduloEfectivo ? `Módulo ${moduloEfectivo}` : 'Sin módulo';
  const rolLabel = (currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil || 'usuario').toString();

  const isNarrow = useIsNarrow(980);
  const gridStyle = useMemo(() => {
    return isNarrow ? { ...styles.grid, gridTemplateColumns: '1fr' } : styles.grid;
  }, [isNarrow]);

  return (
    <div style={styles.page} className="page-container">
      <div style={styles.topbar}>
        <div style={styles.titleWrap}>
          <p style={styles.eyebrow}>Operación en tiempo real</p>
          <h1 style={styles.title}>Panel de Atención</h1>
          <p style={styles.subtitle}>
            {currentUser?.email ? <strong>{currentUser.email}</strong> : '—'} · {rolLabel} · {moduloLabel}
          </p>
          <div style={styles.quickStats}>
            <span style={styles.pill('neutral')}>{atencionActual ? 'Atención en curso' : 'Sin atención activa'}</span>
            <span style={styles.pill(moduloAsignado ? 'primary' : 'danger')}>
              {moduloAsignado ? `Módulo asignado: ${moduloAsignado}` : 'Módulo asignado: —'}
            </span>
          </div>
        </div>

        <div style={styles.rightWrap}>
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
                type="button"
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

      <div style={gridStyle}>
        <div style={styles.card}>
          <div style={styles.cardTopAccent} />
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
              <div style={styles.emptyState}>
                No hay una atención activa en este momento.
                {!moduloEfectivo ? (
                  <>
                    <br />
                    <span style={{ color: '#9f1239' }}>Asigna un módulo para poder llamar.</span>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                <div style={styles.currentHero}>
                  <div>
                    <div style={styles.currentType}>{atencionActual.tipo}</div>
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
                  <button
                    type="button"
                    style={{ ...styles.primaryBtn, ...styles.primaryBtnActive }}
                    onClick={() => setShowFinishModal(true)}
                  >
                    Finalizar atención
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTopAccent} />
          <div style={styles.tabs}>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(activeTab === 'cola' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('cola')}
            >
              Cola & Llamado
            </button>

            <button
              type="button"
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
              type="button"
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

            {activeTab === 'cerradas' && <AdminClosedAppointments />}

            {activeTab === 'citizens' && <CitizenProfile role={isAdmin ? 'admin' : 'agente'} />}
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
