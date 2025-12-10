// src/components/agente/PanelAgenteCitas.jsx
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import FinalizarAtencionModal from './FinishServiceModal';
import { format, addMinutes, subMinutes, endOfDay } from 'date-fns';

// --- Estilos ---
const styles = {
  container: { marginTop: '20px' },
  citaBox: {
    border: '2px solid #C8102E', // Rojo
    borderRadius: '8px',
    padding: '30px',
    marginBottom: '20px',
    backgroundColor: '#ffeded', // Fondo rojo muy claro
    textAlign: 'center'
  },
  citaHeader: { fontSize: '28px', color: '#C8102E', fontWeight: 'bold' },
  citaCode: { fontSize: '48px', fontWeight: 'bold', margin: '10px 0' },
  atenderButton: {
    padding: '15px 30px',
    fontSize: '22px',
    backgroundColor: 'green',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '20px'
  },
  atenderButtonDisabled: {
    padding: '15px 30px',
    fontSize: '22px',
    backgroundColor: '#999',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'not-allowed',
    marginTop: '20px'
  },
  helperText: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#555'
  },
  atencionBox: {
    border: '2px solid #004C91',
    borderRadius: '8px',
    padding: '30px',
    marginBottom: '20px',
    backgroundColor: '#e6f0f8',
    textAlign: 'center'
  },
  atencionTipo: { fontSize: '18px', color: '#004C91', fontWeight: 'bold' },
  atencionTurno: { fontSize: '20px', fontWeight: 'bold' },
  finishButton: {
    padding: '15px 30px',
    fontSize: '22px',
    backgroundColor: '#C8102E',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '20px'
  },

  // Lista de próximas citas
  listaContainer: {
    marginTop: '30px',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    backgroundColor: '#fafafa'
  },
  listaTitulo: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#333'
  },
  listaTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  listaTh: {
    textAlign: 'left',
    padding: '8px',
    borderBottom: '1px solid #ddd',
    color: '#555'
  },
  listaTd: {
    padding: '6px 8px',
    borderBottom: '1px solid #eee'
  },
  listaRowDestacada: {
    backgroundColor: '#ffecec'
  }
};
// --- Fin de Estilos ---

// Tolerancia total antes de marcar NO_SE_PRESENTO (backend)
const MARGEN_TOLERANCIA_MIN = 15;

// Cuánto antes de la hora de la cita el agente puede verla como "en camino"
const ANTICIPO_VISUAL_MIN = 10;

// Ventanita en la que mostramos el mensaje fuerte de "¡AHORA!"
const VENTANA_AHORA_MIN = 5;

export default function PanelAgenteCitas() {
  const { currentUser } = useAuth();
  const [citaActiva, setCitaActiva] = useState(null);       // Cita prioritaria
  const [citasProximas, setCitasProximas] = useState([]);   // Todas las siguientes del día
  const [citaLlamada, setCitaLlamada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Marcar citas como NO_SE_PRESENTO cuando se pasan de la tolerancia
  const marcarCitasComoAusentes = async (ids) => {
    if (ids.length === 0) return;
    console.log(`Sistema: Marcando ${ids.length} citas como NO_SE_PRESENTO...`);
    const batch = writeBatch(db);

    ids.forEach(id => {
      const citaDocRef = doc(db, 'citas', id);
      batch.update(citaDocRef, {
        estado: 'completado',
        clasificacion: 'NO_SE_PRESENTO',
        comentariosAgente: `Sistema automático: Cita expiró tras ${MARGEN_TOLERANCIA_MIN} minutos de tolerancia.`
      });
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error en batch al marcar ausentes:", err);
    }
  };

  // Oyente de citas activas para el agente
  useEffect(() => {
    if (
      !currentUser ||
      !currentUser.habilidades ||
      currentUser.habilidades.length === 0 ||
      !currentUser.moduloAsignado
    ) {
      setLoading(false);
      return;
    }

    const habilidadesLimitadas = currentUser.habilidades.slice(0, 10);

    const qCitas = query(
      collection(db, 'citas'),
      where('estado', '==', 'activa'),
      where('tramiteID', 'in', habilidadesLimitadas)
    );

    const unsubscribe = onSnapshot(
      qCitas,
      (snapshot) => {
        const now = Timestamp.now().toDate();
        let proximaCita = null;
        const citasAusentesIds = [];
        const proximasDelDia = [];

        snapshot.docs.forEach(docSnap => {
          const base = { id: docSnap.id, ...docSnap.data() };
          const citaTime = base.fechaHora.toDate();

          // Solo nos interesan las de hoy hacia adelante (no de días pasados)
          const finDelDia = endOfDay(now);
          if (citaTime > finDelDia) {
            // Citas de días futuros no se muestran en la lista de hoy
            return;
          }

          const limiteSuperior = addMinutes(citaTime, MARGEN_TOLERANCIA_MIN);
          const limiteInferiorVisual = subMinutes(citaTime, ANTICIPO_VISUAL_MIN);

          // Si ya pasó la tolerancia total -> marcar como NO_SE_PRESENTO
          if (now > limiteSuperior) {
            citasAusentesIds.push(base.id);
            return;
          }

          const esMomentoDeLlamar = now >= citaTime;
          const esAhora =
            now >= citaTime && now <= addMinutes(citaTime, VENTANA_AHORA_MIN);
          const estaRetrasada =
            now > addMinutes(citaTime, VENTANA_AHORA_MIN) && now <= limiteSuperior;
          const dentroVentanaVisual =
            now >= limiteInferiorVisual && now <= limiteSuperior;

          const citaEnriquecida = {
            ...base,
            limite: limiteSuperior,
            esMomentoDeLlamar,
            esAhora,
            estaRetrasada,
            dentroVentanaVisual
          };

          // 👉 Lista informativa de PRÓXIMAS citas (hoy, de ahora en adelante)
          if (citaTime >= now) {
            proximasDelDia.push(citaEnriquecida);
          }

          // 👉 Cita prioritaria: la más cercana dentro de la ventana visual
          if (dentroVentanaVisual) {
            if (
              !proximaCita ||
              citaTime < proximaCita.fechaHora.toDate()
            ) {
              proximaCita = citaEnriquecida;
            }
          }
        });

        // Ordenar lista de próximas por hora
        proximasDelDia.sort(
          (a, b) => a.fechaHora.toDate() - b.fechaHora.toDate()
        );

        setCitaActiva(proximaCita);
        setCitasProximas(proximasDelDia);
        setLoading(false);
        marcarCitasComoAusentes(citasAusentesIds);
      },
      (error) => {
        console.error("Error en el oyente de citas (onSnapshot):", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Lógica para ATENDER la cita
  const handleAtenderCita = async (cita) => {
    const modulo = currentUser.moduloAsignado || 0;

    try {
      // 1. Actualizar la TV GLOBAL
      const tvDocRef = doc(db, 'estadoSistema', 'llamadaActual');
      await setDoc(tvDocRef, {
        codigoLlamado: cita.codigo,
        modulo: modulo,
        timestamp: Timestamp.now()
      });

      // 2. Actualizar el estado del TRÁMITE (seguimiento/QR)
      const tramiteDocRef = doc(db, 'estadoSistema', `tramite_${cita.tramiteID}`);
      await setDoc(tramiteDocRef, {
        codigoLlamado: cita.codigo,
        modulo: modulo,
        timestamp: Timestamp.now()
      });

      // 3. Marcar la cita como LLAMADA
      const citaDocRef = doc(db, 'citas', cita.id);
      await updateDoc(citaDocRef, {
        estado: 'llamado',
        agenteID: currentUser.uid,
        modulo: modulo
      });

      // 4. Poner en estado de atención en el front
      setCitaLlamada({
        id: cita.id,
        codigo: cita.codigo,
        tipo: 'Cita',
        nombreCliente: cita.userNombre
      });
      setCitaActiva(null);
    } catch (error) {
      console.error("Error al atender cita:", error);
      alert("Error al intentar llamar la cita. Revise la consola.");
    }
  };

  const handleFinalizarExito = (tipo, codigo) => {
    setCitaLlamada(null);
    setShowModal(false);
    alert(`Atención de ${tipo} ${codigo} finalizada.`);
  };

  // --- Render ---
  if (loading) return <p>Cargando citas web...</p>;

  // Lista de próximas sin duplicar la que está arriba como prioritaria
  const citasSiguientes = citasProximas.filter(
    (c) => !citaActiva || c.id !== citaActiva.id
  );

  return (
    <div style={styles.container}>
      {showModal && (
        <FinalizarAtencionModal
          turnoEnAtencion={citaLlamada}
          onClose={() => setShowModal(false)}
          onFinalizarExito={handleFinalizarExito}
        />
      )}

      {/* Bloque de cita en atención */}
      {citaLlamada ? (
        <div style={styles.atencionBox}>
          <p style={styles.atencionTipo}>Atendiendo Cita Agendada:</p>
          <p style={{ fontSize: '32px', margin: '0 0 10px 0' }}>
            {citaLlamada.nombreCliente || 'Ciudadano'} ({citaLlamada.codigo})
          </p>
          <p style={styles.atencionTurno}>
            MÓDULO {currentUser.moduloAsignado || 'N/A'}
          </p>
          <button
            style={styles.finishButton}
            onClick={() => setShowModal(true)}
          >
            Finalizar Atención
          </button>
        </div>
      ) : citaActiva ? (
        <div style={styles.citaBox}>
          <p style={styles.citaHeader}>
            {citaActiva.esAhora
              ? '¡Cita agendada para AHORA!'
              : !citaActiva.esMomentoDeLlamar
              ? 'Cita próxima (aún no es hora de llamar)'
              : citaActiva.estaRetrasada
              ? 'Cita atrasada (aún dentro de la tolerancia)'
              : 'Cita para este momento'}
          </p>

          <p style={{ fontSize: '20px' }}>
            Cliente: {citaActiva.userNombre || 'Ciudadano'}
          </p>
          <p style={styles.citaCode}>{citaActiva.codigo}</p>

          <p style={{ fontSize: '16px', color: 'gray' }}>
            Hora:{' '}
            {format(citaActiva.fechaHora.toDate(), 'HH:mm')} | Tolerancia hasta:{' '}
            {format(citaActiva.limite, 'HH:mm')}
          </p>

          <button
            style={
              citaActiva.esMomentoDeLlamar
                ? styles.atenderButton
                : styles.atenderButtonDisabled
            }
            onClick={() =>
              citaActiva.esMomentoDeLlamar && handleAtenderCita(citaActiva)
            }
            disabled={!citaActiva.esMomentoDeLlamar}
          >
            Atender Cita Ahora
          </button>

          {!citaActiva.esMomentoDeLlamar && (
            <p style={styles.helperText}>
              Espere a que sea la hora de la cita para poder llamar al ciudadano.
            </p>
          )}
        </div>
      ) : (
        <p
          style={{
            fontSize: '18px',
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
        >
          No hay citas agendadas activas para atender en este momento.
        </p>
      )}

      {/* Lista informativa de próximas citas del día */}
      {citasProximas.length > 0 && (
        <div style={styles.listaContainer}>
          <div style={styles.listaTitulo}>Próximas citas del día</div>
          <table style={styles.listaTable}>
            <thead>
              <tr>
                <th style={styles.listaTh}>Hora</th>
                <th style={styles.listaTh}>Código</th>
                <th style={styles.listaTh}>Cliente</th>
                <th style={styles.listaTh}>Trámite</th>
                <th style={styles.listaTh}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {citasProximas.map((cita) => {
                const esPrincipal = citaActiva && cita.id === citaActiva.id;
                const labelEstado = cita.esMomentoDeLlamar
                  ? cita.estaRetrasada
                    ? 'En atraso (tolerancia)'
                    : 'Listo para llamar'
                  : 'Pendiente';

                return (
                  <tr
                    key={cita.id}
                    style={esPrincipal ? styles.listaRowDestacada : {}}
                  >
                    <td style={styles.listaTd}>
                      {format(cita.fechaHora.toDate(), 'HH:mm')}
                    </td>
                    <td style={styles.listaTd}>{cita.codigo}</td>
                    <td style={styles.listaTd}>
                      {cita.userNombre || 'Ciudadano'}
                    </td>
                    <td style={styles.listaTd}>{cita.tramiteID}</td>
                    <td style={styles.listaTd}>{labelEstado}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
