// src/pages/TicketTracking.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; // Importar getDoc
import { db } from '../firebase';

// --- ESTILOS (Finalizados) ---
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
    borderRadius: '16px', // Más redondeado
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
  // --- Estilos de Estado ---
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
// --- FIN DE ESTILOS ---

// Componente para la animación (sin cambios)
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

export default function TicketTracking() {
  const [searchParams] = useSearchParams();
  const documentoId = searchParams.get('turnoId');

  const [miTurno, setMiTurno] = useState(null);
  const [nombreTramite, setNombreTramite] = useState('...'); // Para el nombre limpio
  const [turnoActualTramite, setTurnoActualTramite] = useState(null); 
  
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 1. Oyente para MI TURNO/CITA (Combinado y con carga de Nombre)
  useEffect(() => {
    if (!documentoId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);

    let isMounted = true;
    let unsubscribes = [];
    let found = false;

    // Función para obtener el nombre del trámite y el estado actual de la cola
    const setupListeners = async (docSnap) => {
      const turnoData = docSnap.data();
      setMiTurno(turnoData);
      
      const tramiteID = turnoData.tramiteID;
      
      // ✅ 1. Obtener Nombre del Trámite (asíncrono)
      try {
        const tramiteDoc = await getDoc(doc(db, 'tramites', tramiteID));
        if (isMounted && tramiteDoc.exists()) {
          setNombreTramite(tramiteDoc.data().nombre);
        } else if (isMounted) {
          setNombreTramite(tramiteID); // Mostrar ID si no se encuentra el nombre
        }
      } catch (e) {
        console.error("Error al obtener nombre del trámite:", e);
        setNombreTramite(tramiteID);
      }
      
      // ✅ 2. Escuchar el Turno Actual de la cola
      if (tramiteID) {
        const tramiteDocRef = doc(db, 'estadoSistema', `tramite_${tramiteID}`);
        const unsubscribeTramite = onSnapshot(tramiteDocRef, (tramiteSnap) => {
          if (isMounted) {
            setTurnoActualTramite(tramiteSnap.data());
          }
        });
        unsubscribes.push(unsubscribeTramite); // Añadir al cleanup
      }
      
      setLoading(false);
    };

    // Escucha en ambas colecciones
    const collectionsToCheck = ['turnos', 'citas']; 
    collectionsToCheck.forEach(collectionName => {
      if (found) return; 
      
      const docRef = doc(db, collectionName, documentoId);
      const unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
        if (!isMounted) return;

        if (docSnap.exists()) {
          found = true; 
          setupListeners(docSnap);
        }
      }, (error) => {
        console.error(`Error al escuchar ${collectionName}:`, error);
        setLoading(false);
      });
      unsubscribes.push(unsubscribeDoc);
    });

    setTimeout(() => {
        if (isMounted && !found) {
            setLoading(false);
            setNotFound(true);
        }
    }, 3000);

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };

  }, [documentoId]);


  // Función para renderizar el estado
  const renderEstado = () => {
    if (!miTurno) return null;
    
    // El turno actual de la cola (puede ser '---' si no hay nadie)
    const currentCode = turnoActualTramite?.codigoLlamado;

    // Estado 1: ¡ES SU TURNO! (Llamado)
    if (miTurno.estado === 'llamado' && currentCode === miTurno.codigo) {
      return (
        <div style={styles.statusLlamado}>
          ¡ES SU TURNO!
          <br />
          Diríjase al Módulo {miTurno.modulo}
        </div>
      );
    }
    
    // Estado 2: FINALIZADO
    if (miTurno.estado === 'completado') {
      return <p style={styles.statusCompletado}>Su atención ha finalizado. ¡Gracias!</p>;
    }
    
    // Estado 3: EN ESPERA
    if (miTurno.estado === 'en-espera' || miTurno.estado === 'activa') {
      // ✅ Calculamos cuántos faltan
      let turnosFaltantes = '—';
      if (currentCode && miTurno.codigo && miTurno.codigo.includes('-')) {
          const turnoActualNum = parseInt(currentCode.split('-')[1]);
          const miTurnoNum = parseInt(miTurno.codigo.split('-')[1]);
          turnosFaltantes = Math.max(0, miTurnoNum - turnoActualNum - 1);
      }
      
      return (
        <div style={styles.statusEnEspera}>
          <p style={{margin: 0, fontSize: '18px'}}>ESTADO: EN ESPERA</p>
          <p style={{margin: '10px 0 0 0', fontWeight: 'normal', fontSize: '16px'}}>
            Faltan: <strong>{turnosFaltantes === '—' ? '?' : turnosFaltantes}</strong> turnos de {nombreTramite}
          </p>
        </div>
      );
    }

    // Estado 4: PASADO
    if (miTurno.estado === 'llamado') {
      return <p style={styles.statusPasado}>Su turno ya fue llamado (ausente).</p>;
    }

    return null;
  };

  // ... (useEffect de @keyframes - sin cambios) ...
  useEffect(() => {
    const styleSheet = document.styleSheets[0];
    if (!styleSheet) return;
    try {
      styleSheet.insertRule(`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.2; }
          100% { opacity: 1; }
        }
      `, styleSheet.cssRules.length);
    } catch (e) {
      if (e.name !== 'SyntaxError' && e.name !== 'InvalidModificationError') {
         console.warn("No se pudo insertar la regla @keyframes.");
      }
    }
  }, []);

  // --- RENDERIZADO ---
  if (miTurno?.estado === 'completado') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.header}>Seguimiento de Turno</h1>
          <p style={styles.myTurnNumber}>{miTurno.codigo}</p>
          <hr style={{ margin: '30px 0' }} />
          <p style={styles.statusCompletado}>Su atención ha finalizado. ¡Gracias por su visita!</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p style={{ textAlign: 'center', fontSize: '24px', marginTop: '40px' }}>Cargando estado del turno...</p>;
  }

  if (notFound || !miTurno) {
    return <p style={{ textAlign: 'center', fontSize: '24px', marginTop: '40px', color: 'red' }}>El ID del turno no es válido o ha expirado.</p>;
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
        <p style={styles.currentTurnNumber}>
          {turnoActualTramite ? turnoActualTramite.codigoLlamado : '---'}
        </p>

        <div style={{ marginTop: '30px', minHeight: '80px' }}>
          {renderEstado()}
        </div>
      </div>
    </div>
  );
}