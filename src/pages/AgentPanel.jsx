// src/pages/AgentPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AgentAppointments from '../components/agent/AgentAppointments';
import AgentQueue from '../components/agent/AgentQueue';
import FinishServiceModal from '../components/agent/FinishServiceModal';
import AdminClosedAppointments from '../components/admin/AdminClosedAppointments';
import CitizenProfile from './CitizenProfile';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../firebase';

import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';

const FUNCTIONS_REGION = 'southamerica-west1';

const styles = {
  panelContainer: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
    borderBottom: '1px solid #eee',
    paddingBottom: '15px',
    gap: '16px'
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#C8102E',
    margin: 0
  },
  closeDayButton: {
    backgroundColor: '#b00020',
    color: 'white',
    padding: '10px 14px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: 'fit-content'
  },
  closeDayButtonDisabled: {
    backgroundColor: '#cccccc',
    color: '#666666',
    cursor: 'not-allowed'
  },
  agentInfoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f8f9fa',
    padding: '10px 20px',
    borderRadius: '16px',
    border: '1px solid #e9ecef',
    color: '#333',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
    whiteSpace: 'nowrap'
  },

  filterLabel: { fontSize: 12, color: '#666', fontWeight: 700, marginTop: 6 },
  filterSelect: {
    marginTop: 6,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: '#fff',
    fontWeight: 700
  },

  // Banner verde
  attentionBanner: {
    marginTop: '10px',
    padding: '14px',
    borderRadius: '10px',
    border: '2px solid #28a745',
    backgroundColor: '#eaffea',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  attentionTitle: { margin: 0, fontSize: '14px', color: '#1e7e34', fontWeight: '700' },
  attentionCode: { margin: 0, fontSize: '28px', fontWeight: '900', color: '#155724' },

  attentionBtn: {
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 18px',
    cursor: 'pointer',
    fontWeight: '900',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    minWidth: 220,
    height: 52,
    boxShadow: '0 10px 18px rgba(22, 163, 74, 0.22)',
    pointerEvents: 'auto',
    zIndex: 10
  },

  tabs: {
    display: 'flex',
    gap: '10px',
    borderBottom: '2px solid #ddd',
    marginTop: '16px',
    marginBottom: '18px',
    flexWrap: 'wrap'
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: '800',
    color: '#666',
    borderBottom: '3px solid transparent'
  },
  tabActive: {
    color: '#C8102E',
    borderBottom: '3px solid #C8102E'
  },
  tabDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },

  section: { marginTop: '18px' }
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

  const [activeTab, setActiveTab] = useState('hoy'); // 'hoy' | 'cerradas' | 'citizens'

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

  return (
    <div style={styles.panelContainer} className="page-container">
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Panel de Atención</h1>

          {isAdmin && (
            <button
              onClick={cerrarJornada}
              disabled={!currentUser || closingDay}
              style={{
                ...styles.closeDayButton,
                ...((!currentUser || closingDay) ? styles.closeDayButtonDisabled : {})
              }}
              title="Cierra todas las citas y turnos activos del día"
            >
              {closingDay ? 'Cerrando...' : 'Cerrar Jornada'}
            </button>
          )}
        </div>

        {currentUser && (
          <div style={styles.agentInfoBadge}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold' }}>{currentUser.email}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                Módulo Asignado:{' '}
                <strong style={{ color: '#007bff' }}>{moduloAsignado || 'Sin Asignar'}</strong>
              </span>

              {isAdmin && (
                <>
                  <span style={styles.filterLabel}>Filtrar atención por módulo:</span>
                  <select
                    style={styles.filterSelect}
                    value={moduloFiltro ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModuloFiltro(v === '' ? null : parseInt(v, 10));
                    }}
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
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {atencionActual && (
        <div style={styles.attentionBanner} className="agent-attention-banner">
          <div>
            <p style={styles.attentionTitle}>Atendiendo {atencionActual.tipo}:</p>
            <p style={styles.attentionCode}>{atencionActual.codigo}</p>
          </div>

          <button style={styles.attentionBtn} onClick={() => setShowFinishModal(true)}>
            Finalizar Atención
          </button>
        </div>
      )}

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'hoy' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('hoy')}
        >
          Atención de Hoy
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
          Citas Cerradas
        </button>

        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'citizens' ? styles.tabActive : {}),
            ...(!isStaff ? styles.tabDisabled : {})
          }}
          onClick={() => isStaff && setActiveTab('citizens')}
          disabled={!isStaff}
          title={!isStaff ? 'No autorizado' : 'Perfil de Ciudadano'}
        >
          Perfil de Ciudadano
        </button>
      </div>

      {activeTab === 'hoy' && (
        <>
          <div style={styles.section}>
            <AgentAppointments atencionActual={atencionActual} moduloEfectivo={moduloEfectivo} />
          </div>

          <div style={styles.section}>
            <AgentQueue atencionActual={atencionActual} moduloEfectivo={moduloEfectivo} />
          </div>
        </>
      )}

      {activeTab === 'cerradas' && (
        <div style={styles.section}>
          <AdminClosedAppointments />
        </div>
      )}

      {activeTab === 'citizens' && (
        <div style={styles.section}>
          <CitizenProfile />
        </div>
      )}

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
