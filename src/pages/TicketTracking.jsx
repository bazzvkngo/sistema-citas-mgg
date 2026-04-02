// src/pages/TicketTracking.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isExpiredTrackingRecord } from '../utils/tracking';
import logoConsulado from '../assets/logo-consulado.png';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '28px 18px 40px',
    fontFamily: 'Arial, sans-serif',
    background:
      'radial-gradient(circle at top, rgba(200, 16, 46, 0.08), transparent 26%), linear-gradient(180deg, #f8f4ef 0%, #f4f6fa 100%)',
    minHeight: '100vh',
    color: '#10233d'
  },
  publicHeader: {
    width: '100%',
    maxWidth: '760px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '16px'
  },
  logoWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    backgroundColor: 'rgba(255,255,255,0.94)',
    boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  logo: {
    width: '42px',
    height: '42px',
    objectFit: 'contain'
  },
  publicHeaderCopy: {
    display: 'grid',
    gap: '4px'
  },
  publicEyebrow: {
    fontSize: '12px',
    fontWeight: '900',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#c8102e'
  },
  publicTitle: {
    margin: 0,
    fontSize: '30px',
    fontWeight: '900',
    letterSpacing: '-0.04em',
    lineHeight: 1.05
  },
  publicSubtitle: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#475569'
  },
  card: {
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '24px',
    padding: '30px 28px',
    width: '90%',
    maxWidth: '760px',
    textAlign: 'center',
    boxShadow: '0 18px 40px rgba(15,23,42,0.1)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(12px)'
  },
  header: {
    color: '#c8102e',
    fontSize: '14px',
    fontWeight: '900',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    marginBottom: '16px'
  },
  myTurnLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '8px',
    marginBottom: '6px',
    fontWeight: '800',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  myTurnNumber: {
    fontSize: '72px',
    fontWeight: '900',
    margin: '10px 0',
    color: '#c8102e',
    letterSpacing: '-0.06em'
  },
  currentTurnLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '5px'
  },
  currentTurnNumber: {
    fontSize: '48px',
    fontWeight: '900',
    margin: '0 0 20px 0',
    color: '#10233d',
    letterSpacing: '-0.05em'
  },
  divider: {
    margin: '28px 0',
    border: 0,
    borderTop: '1px solid rgba(15,23,42,0.08)'
  },
  statusEnEspera: {
    backgroundColor: '#fff3cd',
    padding: '18px 16px',
    borderRadius: '18px',
    color: '#7c4a03',
    border: '1px solid rgba(245, 158, 11, 0.18)'
  },
  statusLlamado: {
    backgroundColor: '#15803d',
    color: '#ffffff',
    padding: '18px 16px',
    borderRadius: '18px',
    animation: 'blink 1s linear infinite'
  },
  statusCompletado: {
    backgroundColor: '#ecfdf5',
    color: '#166534',
    padding: '18px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(22, 163, 74, 0.18)'
  },
  statusPasado: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    padding: '18px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.18)'
  },
  statusMessageTitle: {
    margin: 0,
    fontSize: '26px',
    fontWeight: '900',
    lineHeight: 1.08,
    letterSpacing: '-0.04em'
  },
  statusMessageBody: {
    margin: '8px 0 0 0',
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: 1.45
  },
  statusBox: {
    marginTop: '30px',
    minHeight: '92px'
  },
  loading: {
    textAlign: 'center',
    fontSize: '22px',
    marginTop: '40px',
    color: '#10233d'
  },
  notFound: {
    textAlign: 'center',
    fontSize: '22px',
    marginTop: '40px',
    color: '#b42318',
    maxWidth: '760px',
    padding: '0 16px'
  }
};

const BlinkKeyframeStyle = () => (
  <style>
    {`
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0.2; }
        100% { opacity: 1; }
      }
    `}
  </style>
);

function parseCodigoNum(codigo) {
  if (!codigo || typeof codigo !== 'string') return null;
  const parts = codigo.split('-');
  if (parts.length < 2) return null;
  const n = parseInt(parts[1], 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeTrackingState(value) {
  return String(value || '').trim().toLowerCase();
}

function isTurnNow(estado, currentCode, myCode) {
  if (!currentCode || !myCode) return false;
  if (['completado', 'cerrado', 'cancelado', 'expirado'].includes(estado)) return false;
  return currentCode === myCode;
}

function renderStatusCard(variantStyle, title, body) {
  return (
    <div style={variantStyle}>
      <p style={styles.statusMessageTitle}>{title}</p>
      {body ? <p style={styles.statusMessageBody}>{body}</p> : null}
    </div>
  );
}

function PublicTrackingHeader() {
  return (
    <div style={styles.publicHeader}>
      <div style={styles.logoWrap}>
        <img src={logoConsulado} alt="Consulado" style={styles.logo} />
      </div>
      <div style={styles.publicHeaderCopy}>
        <div style={styles.publicEyebrow}>Seguimiento público</div>
        <h1 style={styles.publicTitle}>Estado de su turno</h1>
        <p style={styles.publicSubtitle}>Consulta aquí el estado actualizado de tu cita o turno.</p>
      </div>
    </div>
  );
}

export default function TicketTracking() {
  const [searchParams] = useSearchParams();

  const trackingToken = searchParams.get('t');
  const turnoId = searchParams.get('turnoId');
  const citaId = searchParams.get('citaId');
  const legacyCitaId = !trackingToken ? citaId : '';
  const legacyTurnoId = !trackingToken ? turnoId : '';

  const [miTurno, setMiTurno] = useState(null);
  const [nombreTramite, setNombreTramite] = useState('...');
  const [turnoActualTramite, setTurnoActualTramite] = useState(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState('El enlace de seguimiento no es válido o ha expirado.');

  const [sourceCollection, setSourceCollection] = useState(null);

  const estadoDocUnsubRef = useRef(null);

  useEffect(() => {
    const genericNotFoundMessage = 'El enlace de seguimiento no es válido o ha expirado.';
    const legacyTurnoMessage = 'Este enlace antiguo de turno ya no está disponible. Use un enlace nuevo o escanee un QR actualizado.';
    const legacyCitaMessage = 'Este enlace antiguo de cita solo funciona con acceso autorizado. Inicie sesión para verla desde su cuenta o use un enlace actualizado.';

    setNotFoundMessage(genericNotFoundMessage);

    if (!trackingToken && !legacyCitaId && !legacyTurnoId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    if (!trackingToken && legacyTurnoId) {
      setLoading(false);
      setNotFound(true);
      setNotFoundMessage(legacyTurnoMessage);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setMiTurno(null);
    setTurnoActualTramite(null);
    setNombreTramite('...');
    setSourceCollection(null);

    if (estadoDocUnsubRef.current) {
      estadoDocUnsubRef.current();
      estadoDocUnsubRef.current = null;
    }

    let isMounted = true;
    let found = false;
    let foundCollection = null;
    const unsubscribes = [];

    const setupTramiteListener = (tramiteID) => {
      if (!tramiteID) return;

      if (estadoDocUnsubRef.current) {
        estadoDocUnsubRef.current();
        estadoDocUnsubRef.current = null;
      }

      const tramiteDocRef = doc(db, 'estadoSistema', `tramite_${tramiteID}`);
      estadoDocUnsubRef.current = onSnapshot(
        tramiteDocRef,
        (tramiteSnap) => {
          if (!isMounted) return;
          setTurnoActualTramite(tramiteSnap.exists() ? tramiteSnap.data() : null);
        },
        () => {
          if (!isMounted) return;
          setTurnoActualTramite(null);
        }
      );
    };

    const setupListeners = async (data, collectionName, docId) => {
      if (!isMounted) return;

      const effectiveCollection =
        collectionName === 'trackingPublic' ? (data?.sourceCollection || null) : collectionName;

      setMiTurno({ id: docId, ...data });
      setSourceCollection(effectiveCollection);

      const tramiteID = data.tramiteID;

      try {
        const tramiteDoc = await getDoc(doc(db, 'tramites', tramiteID));
        if (!isMounted) return;
        setNombreTramite(tramiteDoc.exists() ? tramiteDoc.data().nombre : tramiteID);
      } catch {
        if (!isMounted) return;
        setNombreTramite(tramiteID);
      }

      setupTramiteListener(tramiteID);
      setLoading(false);
    };

    if (trackingToken) {
      const trackingRef = doc(db, 'trackingPublic', trackingToken);
      const unsub = onSnapshot(
        trackingRef,
        (snap) => {
          if (!isMounted) return;

          if (!snap.exists()) {
            setMiTurno(null);
            setLoading(false);
            setNotFound(true);
            return;
          }

          const data = snap.data() || {};
          if (isExpiredTrackingRecord(data)) {
            setMiTurno(null);
            setLoading(false);
            setNotFound(true);
            return;
          }

          setNotFound(false);
          setupListeners(data, 'trackingPublic', snap.id);
        },
        () => {
          if (!isMounted) return;
          setLoading(false);
          setNotFound(true);
        }
      );

      unsubscribes.push(unsub);

      return () => {
        isMounted = false;
        unsubscribes.forEach((unsubscribe) => unsubscribe());
        if (estadoDocUnsubRef.current) {
          estadoDocUnsubRef.current();
          estadoDocUnsubRef.current = null;
        }
      };
    }

    const listenDoc = (collectionName, documentId) => {
      const ref = doc(db, collectionName, documentId);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!isMounted) return;

          if (!snap.exists()) {
            if (found && collectionName === foundCollection) {
              setMiTurno(null);
              setLoading(false);
              setNotFound(true);
            }
            return;
          }

          if (!found) {
            found = true;
            foundCollection = collectionName;
            setupListeners(snap.data() || {}, collectionName, snap.id);
            return;
          }

          if (collectionName === foundCollection) {
            setupListeners(snap.data() || {}, collectionName, snap.id);
          }
        },
        () => {
          if (!isMounted) return;
        }
      );

      unsubscribes.push(unsub);
    };

    if (legacyCitaId) {
      setNotFoundMessage(legacyCitaMessage);
      listenDoc('citas', legacyCitaId);
    }

    const timer = setTimeout(() => {
      if (!isMounted) return;
      if (!found) {
        setLoading(false);
        setNotFound(true);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      if (estadoDocUnsubRef.current) {
        estadoDocUnsubRef.current();
        estadoDocUnsubRef.current = null;
      }
    };
  }, [trackingToken, legacyCitaId, legacyTurnoId]);

  const renderEstado = () => {
    if (!miTurno) return null;

    const estado = normalizeTrackingState(miTurno.estado);
    const currentCode = turnoActualTramite?.codigoLlamado || null;
    const moduloTexto = miTurno.modulo || turnoActualTramite?.modulo || '-';
    const esMiTurno = isTurnNow(estado, currentCode, miTurno.codigo);

    if (estado === 'completado' || estado === 'cerrado') {
      return renderStatusCard(
        styles.statusCompletado,
        'Atención finalizada',
        'Tu atención ha finalizado. Gracias por tu visita.'
      );
    }

    if (estado === 'cancelado' || estado === 'expirado') {
      return renderStatusCard(
        styles.statusPasado,
        'Seguimiento finalizado',
        'La cita o el turno no pudo concretarse.'
      );
    }

    if (esMiTurno) {
      return renderStatusCard(
        styles.statusLlamado,
        'Es su turno',
        `Diríjase al módulo ${moduloTexto}.`
      );
    }

    if (estado === 'llamado') {
      return renderStatusCard(
        styles.statusPasado,
        'Tu turno ya fue llamado',
        'Si el llamado sigue vigente, acércate al módulo de atención.'
      );
    }

    if (estado === 'en-espera' || estado === 'activa') {
      const esCitaAgendada = sourceCollection === 'citas';

      if (esCitaAgendada) {
        return renderStatusCard(
          styles.statusEnEspera,
          'En espera',
          'Te avisaremos aquí cuando sea tu turno.'
        );
      }

      const actualNum = parseCodigoNum(currentCode);
      const mioNum = parseCodigoNum(miTurno.codigo);
      const faltan =
        actualNum != null && mioNum != null ? Math.max(0, mioNum - actualNum - 1) : null;

      const waitingMessage =
        faltan == null
          ? 'Estamos actualizando la fila en este momento.'
          : faltan === 0
            ? ''
            : `Tienes ${faltan} ${faltan === 1 ? 'turno' : 'turnos'} por delante.`;

      return renderStatusCard(
        styles.statusEnEspera,
        'En espera',
        waitingMessage
      );
    }

    return renderStatusCard(
      styles.statusPasado,
      'Seguimiento disponible',
      'Consulta aquí el estado actualizado del turno.'
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <BlinkKeyframeStyle />
        <PublicTrackingHeader />
        <p style={styles.loading}>Cargando estado del turno...</p>
      </div>
    );
  }

  if (notFound || !miTurno) {
    return (
      <div style={styles.container}>
        <BlinkKeyframeStyle />
        <PublicTrackingHeader />
        <p style={styles.notFound}>{notFoundMessage}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <BlinkKeyframeStyle />
      <PublicTrackingHeader />

      <div style={styles.card}>
        <h2 style={styles.header}>Seguimiento de turno</h2>

        <p style={styles.myTurnLabel}>Su turno</p>
        <p style={styles.myTurnNumber}>{miTurno.codigo}</p>

        <hr style={styles.divider} />

        <p style={styles.currentTurnLabel}>Turno actual en {nombreTramite}</p>
        <p style={styles.currentTurnNumber}>{turnoActualTramite?.codigoLlamado || '---'}</p>

        <div style={styles.statusBox}>{renderEstado()}</div>
      </div>
    </div>
  );
}
