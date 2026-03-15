// src/pages/TicketTracking.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isExpiredTrackingRecord } from '../utils/tracking';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f3f4f6',
    minHeight: '100vh'
  },
  card: {
    border: '2px solid #C8102E',
    borderRadius: '16px',
    padding: '30px 40px',
    width: '90%',
    maxWidth: '600px',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
    backgroundColor: 'white'
  },
  header: {
    color: '#C8102E',
    fontSize: '30px',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  myTurnLabel: {
    fontSize: '20px',
    color: '#555',
    marginTop: '15px'
  },
  myTurnNumber: {
    fontSize: '72px',
    fontWeight: 'bold',
    margin: '10px 0',
    color: '#C8102E'
  },
  currentTurnLabel: {
    fontSize: '18px',
    color: '#333',
    fontWeight: '600',
    marginBottom: '5px'
  },
  currentTurnNumber: {
    fontSize: '48px',
    fontWeight: 'bold',
    margin: '0 0 20px 0',
    color: '#333333'
  },
  statusEnEspera: {
    backgroundColor: '#ffc107',
    padding: '15px',
    borderRadius: '8px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333'
  },
  statusLlamado: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: '15px',
    borderRadius: '8px',
    fontSize: '24px',
    fontWeight: 'bold',
    animation: 'blink 1s linear infinite'
  },
  statusCompletado: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'green'
  },
  statusPasado: {
    fontSize: '24px',
    color: '#555'
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

  // ✅ Saber si lo encontrado es una CITA (para ocultar "Faltan")
  const [sourceCollection, setSourceCollection] = useState(null); // 'turnos' | 'citas'

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
    setSourceCollection(null); // ✅ reset

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
        unsubscribes.forEach((u) => u());
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
      unsubscribes.forEach((u) => u());
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

    if (estado === 'llamado' && currentCode && currentCode === miTurno.codigo) {
      const moduloTexto = miTurno.modulo || turnoActualTramite?.modulo || '-';
      return (
        <div style={styles.statusLlamado}>
          ES SU TURNO
          <br />
          Diríjase al Módulo {moduloTexto}
        </div>
      );
    }

    if (estado === 'completado' || estado === 'cerrado') {
      return <p style={styles.statusCompletado}>Su atención ha finalizado. Gracias.</p>;
    }

    if (estado === 'cancelado') {
      return <p style={styles.statusPasado}>Este turno fue cancelado.</p>;
    }

    if (estado === 'expirado') {
      return <p style={styles.statusPasado}>Este enlace de seguimiento ha expirado.</p>;
    }

    if (estado === 'en-espera' || estado === 'activa') {
      // ✅ Si es CITA (no kiosko), ocultar el contador "Faltan"
      const esCitaAgendada = sourceCollection === 'citas';

      if (esCitaAgendada) {
        return (
          <div style={styles.statusEnEspera}>
            <p style={{ margin: 0, fontSize: '18px' }}>ESTADO: EN ESPERA</p>
          </div>
        );
      }

      // ✅ Kiosko (turnos): mantener el cálculo tal cual
      const actualNum = parseCodigoNum(currentCode);
      const mioNum = parseCodigoNum(miTurno.codigo);

      const faltan =
        actualNum != null && mioNum != null ? Math.max(0, mioNum - actualNum - 1) : null;

      return (
        <div style={styles.statusEnEspera}>
          <p style={{ margin: 0, fontSize: '18px' }}>ESTADO: EN ESPERA</p>
          <p style={{ margin: '10px 0 0 0', fontWeight: 'normal', fontSize: '16px' }}>
            Faltan: <strong>{faltan == null ? '?' : faltan}</strong> turnos de {nombreTramite}
          </p>
        </div>
      );
    }

    if (estado === 'llamado') {
      return <p style={styles.statusPasado}>Su turno ya fue llamado (ausente).</p>;
    }

    return null;
  };

  if (['completado', 'cerrado'].includes(normalizeTrackingState(miTurno?.estado))) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.header}>Seguimiento de Turno</h1>
          <p style={styles.myTurnNumber}>{miTurno.codigo}</p>
          <hr style={{ margin: '30px 0' }} />
          <p style={styles.statusCompletado}>Su atención ha finalizado. Gracias por su visita.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <p style={{ textAlign: 'center', fontSize: '24px', marginTop: '40px' }}>
        Cargando estado del turno...
      </p>
    );
  }

  if (notFound || !miTurno) {
    return (
      <p style={{ textAlign: 'center', fontSize: '24px', marginTop: '40px', color: 'red' }}>
        {notFoundMessage}
      </p>
    );
  }

  return (
    <div style={styles.container}>
      <BlinkKeyframeStyle />
      <div style={styles.card}>
        <h1 style={styles.header}>Seguimiento de Turno</h1>

        <p style={styles.myTurnLabel}>Su Turno:</p>
        <p style={styles.myTurnNumber}>{miTurno.codigo}</p>

        <hr style={{ margin: '30px 0' }} />

        <p style={styles.currentTurnLabel}>Turno Actual (en {nombreTramite}):</p>
        <p style={styles.currentTurnNumber}>{turnoActualTramite?.codigoLlamado || '---'}</p>

        <div style={{ marginTop: '30px', minHeight: '80px' }}>{renderEstado()}</div>
      </div>
    </div>
  );
}
