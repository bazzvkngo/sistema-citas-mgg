// src/pages/MonitorScreen.jsx
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';

// --- ESTILOS EN LÍNEA PARA LA PANTALLA TV ---
const styles = {
  tvScreen: {
    backgroundColor: '#FFFFFF',
    color: '#333333',
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },

  // Sección principal (turno grande)
  mainSection: {
    flex: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInner: {
    textAlign: 'center',
  },
  turnoLabel: {
    fontSize: '3vw',
    letterSpacing: '0.6vw',
    marginBottom: '1.5vw',
  },
  turnoCodigo: {
    fontSize: '11vw',
    fontWeight: 'bold',
    color: '#C8102E',
    lineHeight: 1,
    marginBottom: '2vw',
  },
  turnoModulo: {
    fontSize: '4vw',
    fontWeight: 'bold',
  },
  turnoPlaceholder: {
    fontSize: '4vw',
    color: '#999999',
  },

  // Panel lateral (estado por trámite)
  sidePanel: {
    flex: 1.6,
    borderLeft: '8px solid #C8102E',
    backgroundColor: '#f8f8f8',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5vw 1.8vw',
    boxSizing: 'border-box',
  },
  sideHeader: {
    fontSize: '2.2vw',
    fontWeight: 'bold',
    color: '#C8102E',
    marginBottom: '0.6vw',
  },
  sideSubHeader: {
    borderBottom: '4px solid #C8102E',
    marginBottom: '1.2vw',
  },
  cardsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6vw',
    overflowY: 'auto',
    paddingRight: '0.4vw',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '0.6vw 0.9vw',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    borderLeft: '4px solid #C8102E',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '4vw',
  },
  cardNombre: {
    fontSize: '1.2vw',
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: '0.2vw',
  },
  cardPrefijo: {
    fontSize: '0.9vw',
    color: '#666666',
    marginBottom: '0.1vw',
  },
  cardLinea: {
    fontSize: '1.0vw',
    color: '#333333',
  },
  cardLineaCita: {
    fontSize: '0.9vw',
    color: '#555555',
    marginTop: '0.15vw',
  },
  cardSinLlamados: {
    fontSize: '0.95vw',
    color: '#777777',
  },
};

export default function MonitorScreen() {
  const [llamadaActual, setLlamadaActual] = useState(null);
  const [tramites, setTramites] = useState([]);
  const [tramitesEstado, setTramitesEstado] = useState({});

  // 🔴 Suscripción al documento global de llamada actual (turno grande)
  useEffect(() => {
    const ref = doc(db, 'estadoSistema', 'llamadaActual');

    // Truco: ignorar el primer snapshot para que al refrescar la página
    // se "resetee" visualmente el turno grande.
    let initialized = false;

    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : null;

      if (!initialized) {
        initialized = true;
        return; // ignoramos el valor inicial guardado en Firestore
      }

      setLlamadaActual(data);
    });

    return () => unsubscribe();
  }, []);

  // Cargar trámites en tiempo real
  useEffect(() => {
    const tramitesRef = collection(db, 'tramites');
    const unsubscribe = onSnapshot(tramitesRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setTramites(list);
    });

    return () => unsubscribe();
  }, []);

  // Escuchar estado por trámite: estadoSistema/tramite_{id}
  useEffect(() => {
    if (!tramites || tramites.length === 0) return;

    const unsubscribes = tramites.map((tramite) => {
      const estadoId = `tramite_${tramite.id}`;
      const ref = doc(db, 'estadoSistema', estadoId);

      return onSnapshot(ref, (snap) => {
        setTramitesEstado((prev) => ({
          ...prev,
          [tramite.id]: snap.exists() ? snap.data() : null,
        }));
      });
    });

    return () => {
      unsubscribes.forEach((u) => u && u());
    };
  }, [tramites]);

  // Datos para la sección central
  const codigoCentral = llamadaActual?.codigoLlamado || '';
  const moduloCentral = llamadaActual?.modulo || '';
  const hayLlamada = !!codigoCentral;

  return (
    <div style={styles.tvScreen}>
      {/* Sección principal (turno grande) */}
      <div style={styles.mainSection}>
        <div style={styles.mainInner}>
          <div style={styles.turnoLabel}>TURNO LLAMADO</div>
          {hayLlamada ? (
            <>
              <div style={styles.turnoCodigo}>{codigoCentral}</div>
              {moduloCentral && (
                <div style={styles.turnoModulo}>MÓDULO {moduloCentral}</div>
              )}
            </>
          ) : (
            <div style={styles.turnoPlaceholder}>ESPERANDO LLAMADA…</div>
          )}
        </div>
      </div>

      {/* Panel lateral: estado de turnos por trámite */}
      <div style={styles.sidePanel}>
        <div style={styles.sideHeader}>ESTADO DE TURNOS</div>
        <div style={styles.sideHeader}>POR TRÁMITE</div>
        <div style={styles.sideSubHeader} />

        <div style={styles.cardsContainer}>
          {tramites.map((tramite) => {
            const estado = tramitesEstado[tramite.id];
            const tieneLlamado = !!(estado && estado.codigoLlamado);
            const codigo = estado?.codigoLlamado || '';
            const esCitaWeb = codigo.startsWith('C-');

            const prefijo =
              tramite.prefijo || tramite.codigo || tramite.abreviatura || '--';

            return (
              <div key={tramite.id} style={styles.card}>
                <div style={styles.cardNombre}>
                  {tramite.nombre || tramite.id}
                </div>
                <div style={styles.cardPrefijo}>Prefijo: {prefijo}</div>

                {/* Si hay turno de kiosko en curso (no es cita web) */}
                {tieneLlamado && !esCitaWeb && (
                  <div style={styles.cardLinea}>
                    Vamos en:&nbsp;
                    <strong>{estado.codigoLlamado}</strong>
                    &nbsp;— Módulo {estado.modulo}
                  </div>
                )}

                {/* Mensaje base cuando no hay turno de kiosko en curso */}
                {(!tieneLlamado || esCitaWeb) && (
                  <div style={styles.cardSinLlamados}>
                    Sin llamados aún para este trámite.
                  </div>
                )}

                {/* Si lo que está llamado es una cita web, se muestra aparte */}
                {tieneLlamado && esCitaWeb && (
                  <div style={styles.cardLineaCita}>
                    Cita web en atención:&nbsp;
                    <strong>{estado.codigoLlamado}</strong>
                    &nbsp;— Módulo {estado.modulo}
                  </div>
                )}
              </div>
            );
          })}

          {/* Por si no hubiera ningún trámite configurado */}
          {tramites.length === 0 && (
            <div style={styles.cardSinLlamados}>
              No hay trámites configurados en el sistema.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
