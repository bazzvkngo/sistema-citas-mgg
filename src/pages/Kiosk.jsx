// src/pages/Kiosk.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
// import { useSearchParams } from 'react-router-dom'; // ELIMINADO

// Apuntar a Santiago
const functions = getFunctions(app, 'southamerica-west1');
const generarTurnoKiosko = httpsCallable(functions, 'generarTurnoKiosko');

// --- ✅ ESTILOS "CLEAN UI" CONSULADO ---
const styles = {
  kioskoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6', // Fondo gris claro
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '700px',
    padding: '40px',
    textAlign: 'center'
  },
  headerTitle: {
    fontSize: '36px',
    color: '#C8102E', // Rojo Consulado
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  subHeader: {
    fontSize: '20px',
    color: '#555',
    marginBottom: '30px',
    maxWidth: '500px',
    margin: '0 auto 30px auto'
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: '15px'
  },
  tramiteButton: {
    fontSize: '24px',
    padding: '25px',
    cursor: 'pointer',
    backgroundColor: '#C8102E',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 'bold',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  // --- Estilos para la vista de DNI ---
  dniInputContainer: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto'
  },
  dniInput: {
    border: '1px solid #ccc',
    borderRadius: '12px',
    padding: '0 15px',
    height: '60px',
    fontSize: '24px',
    color: '#333',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'center',
    marginBottom: '20px'
  },
  dniButton: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#007bff', // Azul (más estándar)
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  backButton: {
    backgroundColor: 'transparent',
    color: '#555',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '20px',
    textDecoration: 'underline'
  },
  // --- Estilos de Ticket ---
  ticketContainer: {
    textAlign: 'center',
  },
  ticketLabel: {
    fontSize: '24px',
    color: '#555'
  },
  ticketTramiteName: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333',
    margin: '10px 0'
  },
  ticketNumber: {
    fontSize: '80px',
    fontWeight: 'bold',
    color: '#C8102E',
    margin: '10px 0'
  },
  aceptarButton: {
    width: '100%',
    maxWidth: '400px',
    padding: '20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '30px'
  },
  errorText: {
    color: 'red',
    fontSize: '18px',
    fontWeight: 'bold',
    marginTop: '15px'
  }
};

// --- Componente de Acceso Denegado (ELIMINADO) ---
// const AccessDenied = () => ( ... );

export default function Kiosk() {
  // const [searchParams] = useSearchParams(); // ELIMINADO
  // const [isAuthorized, setIsAuthorized] = useState(false); // ELIMINADO

  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState('tramites');
  const [selectedTramite, setSelectedTramite] = useState(null);
  
  const [dniVisual, setDniVisual] = useState('');
  const [dniLimpio, setDniLimpio] = useState('');

  const [generatedTicket, setGeneratedTicket] = useState(null);

  // useEffect(() => { ... }); // ELIMINADO (useEffect de autorización)

  // MODIFICADO: useEffect de carga de trámites (se ejecuta siempre)
  useEffect(() => {
    const fetchTramites = async () => {
      setLoading(true);
      try {
        const tramitesSnapshot = await getDocs(query(collection(db, 'tramites')));
        const tramitesList = tramitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTramites(tramitesList);
      } catch (error) {
        console.error("Error al cargar trámites: ", error);
        setError("Error al cargar servicios. Intente más tarde."); // Corregido de setInternalError a setError
      }
      setLoading(false);
    };
    fetchTramites();
  }, []); // Dependencia vacía, se ejecuta al montar

  const handleSelectTramite = (tramite) => {
    setSelectedTramite(tramite);
    setView('dni');
    setError(null);
    setDniVisual('');
    setDniLimpio('');
  };

  const handleGenerarTurno = async (e) => {
    e.preventDefault();
    if (dniLimpio.trim().length < 7) {
      setError("Por favor, ingrese un DNI/RUT válido.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await generarTurnoKiosko({
        dniLimpio: dniLimpio,
        tramiteId: selectedTramite.id
      });

      const { id, codigo, nombre } = result.data;
      const qrUrl = `${window.location.origin}/qr-seguimiento?turnoId=${id}`; // Corregido (quitada la 't' extra)

      setGeneratedTicket({
        codigo: codigo,
        nombre: nombre,
        qrValue: qrUrl
      });
      setView('ticket');

    } catch (error) {
      console.error("Error al generar turno (Cloud Function): ", error);
      
      let userMessage = "Error al generar su turno. Intente de nuevo.";
      if (error.message && error.message.includes('FirebaseError: ')) {
        userMessage = error.message.replace('FirebaseError: ', '').replace(':', '');
      } else if (error.code) {
        userMessage = `Error de servidor (${error.code}). Por favor, intente más tarde.`;
      }
      
      setError(userMessage);
    }
    setLoading(false);
  };

  const handleDniChange = (e) => {
    let valor = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (valor.length > 9) valor = valor.slice(0, 9);
    
    setDniLimpio(valor); // Guardar valor limpio

    let formateado = valor;
    if (valor.length > 1) {
      const cuerpo = valor.slice(0, -1);
      const dv = valor.slice(-1);
      formateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
    }
    setDniVisual(formateado); // Actualizar estado visual
  };

  const resetKiosk = () => {
    setView('tramites');
    setError(null);
    setDniVisual('');
    setDniLimpio('');
    setSelectedTramite(null);
    setGeneratedTicket(null);
  };

  // if (!isAuthorized) { ... } // ELIMINADO (bloqueo de AccessDenied)

  // --- Vista 1: Seleccionar Trámite ---
  if (view === 'tramites') {
    return (
      <div style={styles.kioskoContainer}>
        <div style={styles.card}>
          <h1 style={styles.headerTitle}>Bienvenido</h1>
          <p style={styles.subHeader}>Seleccione el trámite para obtener su número de atención:</p>
          <div style={styles.buttonContainer}>
            {loading && <p>Cargando trámites...</p>}
            {error && <p style={styles.errorMessage}>{error}</p>}
            {tramites.map(tramite => (
              <button
                key={tramite.id}
                style={styles.tramiteButton}
                onClick={() => handleSelectTramite(tramite)}
              >
                {tramite.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Vista 2: Ingresar DNI ---
  if (view === 'dni') {
    return (
      <div style={styles.kioskoContainer}>
        <div style={styles.card}>
          <h1 style={styles.headerTitle}>{selectedTramite.nombre}</h1>
          <p style={styles.subHeader}>Por favor, ingrese su DNI o RUT para continuar</p>
          <div style={styles.dniInputContainer}>
            <form onSubmit={handleGenerarTurno}>
              <input
                type="text"
                style={styles.dniInput}
                placeholder="12.345.678-K"
                value={dniVisual}
                maxLength={12}
                onChange={handleDniChange}
                autoFocus
              />
              {error && <p style={styles.errorText}>{error}</p>}
              <button 
                type="submit" 
                style={styles.dniButton}
                disabled={loading}
              >
                {loading ? 'Generando...' : 'Generar Turno'}
              </button>
            </form>
            <button 
              style={styles.backButton} 
              onClick={resetKiosk}
              disabled={loading}
            >
              ← Volver a Trámites
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Vista 3: Mostrar Ticket ---
  if (view === 'ticket') {
    return (
      <div style={styles.kioskoContainer}>
        <div style={styles.card}>
          <div style={styles.ticketContainer}>
            <p style={styles.ticketLabel}>Su turno para:</p>
            <p style={styles.ticketTramiteName}>{generatedTicket.nombre}</p>
            <p style={styles.ticketNumber}>{generatedTicket.codigo}</p>
            <hr />
            <p style={{marginTop: '20px'}}>Escanee este QR para ver el estado de su turno:</p>
            <QRCodeSVG value={generatedTicket.qrValue} size={256} />
            <br />
            <button style={styles.aceptarButton} onClick={resetKiosk}>
              Aceptar
            </button>
          </div>
        </div>
      </div>
    );
  }
}