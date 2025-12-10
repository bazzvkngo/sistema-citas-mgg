// src/components/agente/PanelAgentePresencial.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  collection, getDocs, query, where, onSnapshot,
  orderBy, limit, doc, updateDoc, setDoc, Timestamp, getDoc, documentId
} from 'firebase/firestore';
import { db } from '../../firebase';
import FinalizarAtencionModal from './FinishServiceModal';

// --- Estilos (sin cambios) ---
const styles = {
  // ... (tus estilos)
  queueContainer: { display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px' },
  queueBox: {
    border: '2px solid #007bff',
    borderRadius: '8px',
    padding: '20px',
    width: '300px',
    textAlign: 'center',
    backgroundColor: '#f8f9fa'
  },
  queueName: { fontSize: '22px', fontWeight: 'bold' },
  countNumber: { fontSize: '48px', fontWeight: 'bold', margin: '10px 0', color: '#007bff' },
  callButton: {
    fontSize: '18px',
    padding: '10px 20px',
    backgroundColor: 'green',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  atencionBox: {
    border: '2px solid green',
    borderRadius: '8px',
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#e6ffed'
  },
  atencionTurno: {
    fontSize: '64px',
    fontWeight: 'bold',
    color: 'green',
    margin: '10px 0'
  },
  atencionTipo: { fontSize: '24px', color: 'green' },
  finishButton: {
    fontSize: '22px',
    padding: '15px 30px',
    backgroundColor: 'red',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '20px'
  }
};
// --- Fin de Estilos ---


export default function PanelAgentePresencial() {
  const { currentUser } = useAuth();
  const [tramites, setTramites] = useState([]);
  const [colasTurnos, setColasTurnos] = useState({});
  const [loading, setLoading] = useState(true);

  const [turnoEnAtencion, setTurnoEnAtencion] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // useEffect (Cargar Trámites y Turnos) - (Sin cambios)
  useEffect(() => {
    if (!currentUser || !currentUser.habilidades || currentUser.habilidades.length === 0) {
      setLoading(false);
      return;
    }
    const habilidadesTramites = currentUser.habilidades.slice(0, 30);
    const fetchTramites = async () => {
      try {
        const q = query(collection(db, 'tramites'), where(documentId(), 'in', habilidadesTramites));
        const tramitesSnapshot = await getDocs(q);
        const tramitesList = tramitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTramites(tramitesList);
      } catch (error) { console.error("Error al cargar trámites: ", error); }
    };
    fetchTramites();
    const habilidadesTurnos = currentUser.habilidades.slice(0, 10);
    const qTurnos = query(
      collection(db, 'turnos'),
      where('estado', '==', 'en-espera'),
      where('tramiteID', 'in', habilidadesTurnos)
    );
    const unsubscribe = onSnapshot(qTurnos, (querySnapshot) => {
      const turnosAgrupados = querySnapshot.docs.reduce((acc, turnoDoc) => {
        const tramiteId = turnoDoc.data().tramiteID;
        if (!acc[tramiteId]) { acc[tramiteId] = []; }
        acc[tramiteId].push(true);
        return acc;
      }, {});
      setColasTurnos(turnosAgrupados);
      setLoading(false);
    }, (error) => { console.error("Error al escuchar turnos: ", error); setLoading(false); });
    return () => unsubscribe();
  }, [currentUser]);

  // Función de TV (Actualización DOBLE)
  const actualizarSistemas = async (codigo, modulo, tramiteId) => {
    const timestamp = Timestamp.now();
    
    // 1. Actualizar la TV GLOBAL (PantallaTV.jsx)
    const tvDocRef = doc(db, 'estadoSistema', 'llamadaActual');
    await setDoc(tvDocRef, { codigoLlamado: codigo, modulo: modulo, timestamp: timestamp });

    // ✅ CAMBIO: 2. Actualizar el estado del TRÁMITE (PaginaQR.jsx)
    // Esto crea un doc ej: 'estadoSistema/tramite_antecedentes'
    const tramiteDocRef = doc(db, 'estadoSistema', `tramite_${tramiteId}`);
    await setDoc(tramiteDocRef, { codigoLlamado: codigo, modulo: modulo, timestamp: timestamp });

    // Historial (Sin cambios)
    const historyDocRef = doc(db, 'estadoSistema', 'historialLlamadas');
    const historySnap = await getDoc(historyDocRef);
    const oldHistory = historySnap.exists() ? historySnap.data().ultimos : [];
    const newHistory = [{ codigo: codigo, modulo: modulo }, ...oldHistory.slice(0, 3)];
    await setDoc(historyDocRef, { ultimos: newHistory });
  };


  // Lógica para llamar al siguiente Turno
  const handleLlamarTurno = async (tramiteId) => {
    if (turnoEnAtencion) {
      alert("Ya tienes un turno en atención. Debes finalizarlo primero.");
      return;
    }
    const modulo = currentUser.moduloAsignado || 0;
    try {
      // 1. Buscar el ticket
      const qTurno = query(
        collection(db, 'turnos'),
        where('estado', '==', 'en-espera'),
        where('tramiteID', '==', tramiteId),
        orderBy('fechaHoraGenerado', 'asc'),
        limit(1)
      );
      const turnoSnapshot = await getDocs(qTurno);
      if (turnoSnapshot.empty) {
        alert("No hay más turnos en esta cola.");
        return;
      }
      const turnoDoc = turnoSnapshot.docs[0];
      const turnoLlamado = { id: turnoDoc.id, ...turnoDoc.data() };
      const turnoId = turnoLlamado.id;
      const turnoCodigo = turnoLlamado.codigo;

      // 2. Actualizar el Turno
      const turnoDocRef = doc(db, 'turnos', turnoId);
      await updateDoc(turnoDocRef, {
        estado: 'llamado',
        agenteID: currentUser.uid,
        modulo: modulo
      });

      // 3. ✅ CAMBIO: Actualizar AMBOS sistemas (TV y QR)
      await actualizarSistemas(turnoCodigo, modulo, tramiteId);

      // 4. Poner en estado de atención
      setTurnoEnAtencion({
        id: turnoId,
        codigo: turnoCodigo,
        tipo: 'Turno',
        nombreCliente: 'Visitante Kiosko'
      });

    } catch (error) {
      console.error("Error al llamar turno: ", error);
      alert("Error al llamar turno. Revisa la consola (F12).");
    }
  };

  // Callback del Modal (Sin cambios)
  const handleFinalizarExito = (tipo, codigo) => {
    setTurnoEnAtencion(null);
    setShowModal(false);
    alert(`Atención del ${tipo} ${codigo} finalizada y clasificada.`);
  };

  // ... (JSX de renderizado - sin cambios) ...
  return (
    <div>
      {showModal && (
        <FinalizarAtencionModal
          turnoEnAtencion={turnoEnAtencion}
          onClose={() => setShowModal(false)}
          onFinalizarExito={handleFinalizarExito}
        />
      )}
      {turnoEnAtencion ? (
        <div style={styles.atencionBox}>
          <p style={styles.atencionTipo}>Atendiendo {turnoEnAtencion.tipo}:</p>
          <p style={{ fontSize: '32px', margin: '0 0 10px 0' }}>
            {turnoEnAtencion.nombreCliente} ({turnoEnAtencion.codigo})
          </p>
          <p style={styles.atencionTurno}>MÓDULO {currentUser.moduloAsignado || 'N/A'}</p>
          <button
            style={styles.finishButton}
            onClick={() => setShowModal(true)}
          >
            Finalizar Atención
          </button>
        </div>
      ) : (
        <>
          <h3 style={{ marginTop: '20px' }}>Colas Presenciales en Espera (Turnos Kiosko)</h3>
          <div style={styles.queueContainer}>
            {loading && <p>Cargando colas...</p>}
            {tramites.map(tramite => {
              const conteo = (colasTurnos[tramite.id] || []).length;
              return (
                <div key={tramite.id} style={styles.queueBox}>
                  <div style={styles.queueName}>{tramite.nombre}</div>
                  <div style={{ margin: '15px 0' }}>
                    <div style={styles.countNumber}>{conteo}</div>
                    <div style={{ fontSize: '16px', color: '#555' }}>en espera</div>
                  </div>
                  <button
                    style={styles.callButton}
                    disabled={conteo === 0}
                    onClick={() => handleLlamarTurno(tramite.id)}
                  >
                    Llamar Siguiente
                  </button>
                </div>
              );
            })}
            {!loading && tramites.length === 0 && (
              <p>No tienes trámites asignados. Contacta a un administrador.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}