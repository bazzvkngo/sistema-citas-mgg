import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  onSnapshot
} from 'firebase/firestore';
import { db, app } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, addDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import './Appointments.css';

const functions = getFunctions(app, 'southamerica-west1');
const getAvailableSlots = httpsCallable(functions, 'getAvailableSlots');
const checkDuplicados = httpsCallable(functions, 'checkDuplicados');
const agendarCitaWebLock = httpsCallable(functions, 'agendarCitaWebLock');

const finesDeSemana = { daysOfWeek: [0, 6] };
const CHILE_TZ = 'America/Santiago';

function getChileDateISO(dateObj) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

function getChileHHmm(dateObj) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHILE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(dateObj);

  const hh = parts.find(p => p.type === 'hour')?.value ?? '00';
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

export default function Appointments() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tramites, setTramites] = useState([]);
  const [myCitas, setMyCitas] = useState([]);
  const [loadingTramites, setLoadingTramites] = useState(true);
  const [loadingMyCitas, setLoadingMyCitas] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTramiteId, setSelectedTramiteId] = useState("");
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [agendarError, setAgendarError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const tomorrow = addDays(new Date(), 1);

  useEffect(() => {
    const fetchTramites = async () => {
      setLoadingTramites(true);
      try {
        const tramitesSnapshot = await getDocs(collection(db, 'tramites'));
        const tramitesList = tramitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTramites(tramitesList);
      } catch (error) {
        console.error("Error al cargar trámites: ", error);
      }
      setLoadingTramites(false);
    };
    fetchTramites();
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const uid = auth.currentUser?.uid || currentUser?.uid;

    if (!uid) {
      setLoadingMyCitas(false);
      setMyCitas([]);
      return;
    }

    setLoadingMyCitas(true);

    const q = query(
      collection(db, 'citas'),
      where('userID', '==', uid),
      where('estado', 'in', ['activa', 'llamado'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const citasList = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setMyCitas(citasList);
        setLoadingMyCitas(false);
      },
      (error) => {
        console.error("Error al escuchar mis citas: ", error);
        setLoadingMyCitas(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Slots ocupados por el propio usuario en la fecha seleccionada (para ocultarlos en el select)
  const userTakenSlotsOnSelectedDate = useMemo(() => {
    if (!selectedDate || !myCitas?.length) return new Set();
    const selectedKey = getChileDateISO(selectedDate);

    const taken = new Set();
    for (const c of myCitas) {
      if (!c?.fechaHora?.toDate) continue;
      const d = c.fechaHora.toDate();
      const key = getChileDateISO(d);
      if (key !== selectedKey) continue;
      taken.add(getChileHHmm(d));
    }
    return taken;
  }, [selectedDate, myCitas]);

  useEffect(() => {
    if (!selectedTramiteId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    const day = getDay(selectedDate);
    if (day === 0 || day === 6) {
      setAvailableSlots([]);
      return;
    }

    const fetchAvailableSlots = async () => {
      setLoadingSlots(true);
      setAvailableSlots([]);
      setSelectedSlot("");
      setAgendarError(null);

      try {
        const result = await getAvailableSlots({
          tramiteId: selectedTramiteId,
          fechaISO: selectedDate.toISOString()
        });

        const slots = Array.isArray(result?.data?.slots) ? result.data.slots : [];
        setAvailableSlots(slots);
      } catch (error) {
        console.error("Error al buscar horarios (Cloud Function):", error);
        setAgendarError("Error al buscar horarios. Intente de nuevo.");
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [selectedDate, selectedTramiteId]);

  const filteredSlots = useMemo(() => {
    if (!availableSlots?.length) return [];
    return availableSlots.filter(s => !userTakenSlotsOnSelectedDate.has(s));
  }, [availableSlots, userTakenSlotsOnSelectedDate]);

  const handleAgendarCita = async (e) => {
    e.preventDefault();
    setAgendarError(null);
    setSuccessMessage(null);

    if (!selectedSlot) {
      setAgendarError("Por favor, seleccione un horario.");
      return;
    }

    if (!currentUser || !currentUser.dni) {
      setAgendarError("Error: No se pudieron cargar sus datos de usuario (DNI).");
      return;
    }

    const auth = getAuth(app);
    const uid = auth.currentUser?.uid || currentUser?.uid;

    if (!uid) {
      setAgendarError("Sesión no válida.");
      return;
    }

    setLoading(true);

    try {
      await checkDuplicados({
        dniLimpio: currentUser.dni,
        tramiteId: selectedTramiteId
      });

      const resp = await agendarCitaWebLock({
        tramiteId: selectedTramiteId,
        fechaISO: selectedDate.toISOString(),
        slot: selectedSlot,
        dni: currentUser.dni,
        userNombre: currentUser.nombre || currentUser.displayName || '',
        userEmail: currentUser.email || ''
      });

      const codigo = resp?.data?.codigo || '';
      const mensajeFinal = `Cita agendada con éxito. Su código es: ${codigo}.\nRecuerde estar 10 minutos antes.`;
      setSuccessMessage(mensajeFinal);

      setSelectedTramiteId("");
      setSelectedDate(undefined);
      setAvailableSlots([]);
      setSelectedSlot("");
    } catch (error) {
      console.error("Error al agendar la cita: ", error);

      const msg =
        error?.message ||
        error?.details ||
        "No se pudo agendar. Intente nuevamente.";

      setAgendarError(msg);
    }

    setLoading(false);
  };

  const handleCancelCita = async (citaId) => {
    if (!window.confirm("¿Está seguro de que desea cancelar esta cita?")) {
      return;
    }
    try {
      const citaDocRef = doc(db, 'citas', citaId);
      await deleteDoc(citaDocRef);
    } catch (error) {
      console.error("Error al cancelar la cita: ", error);
      alert("Hubo un error al cancelar la cita.");
    }
  };

  const renderSuccessMessage = () => {
    if (!successMessage) return null;
    return (
      <div style={styles.successCard}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{successMessage}</p>
      </div>
    );
  };

  const renderCitaItem = (cita) => {
    const tramite = tramites.find(t => t.id === cita.tramiteID);
    const link = tramite?.enlaceInfo;
    const nombreTramite = tramite?.nombre || cita.tramiteID;

    const esLlamada = cita.estado === 'llamado';

    let estadoTexto = 'Activa (aún en espera)';
    if (esLlamada) {
      estadoTexto = 'Llamada (el consulado está listo para atenderle)';
    }

    const qrUrl = `${window.location.origin}/qr-seguimiento?turnoId=${cita.id}`;

    return (
      <li key={cita.id} style={styles.citaListItem}>
        <strong>Trámite:</strong> {nombreTramite}
        <br />
        <strong>Código:</strong> {cita.codigo}
        <br />
        <strong>Fecha:</strong>{" "}
        {cita.fechaHora
          ? format(cita.fechaHora.toDate(), 'dd/MM/yyyy HH:mm')
          : 'Fecha no disponible'}
        <br />

        <p style={{ marginTop: 8, marginBottom: 4 }}>
          <strong>Estado:</strong> {estadoTexto}
        </p>

        {link && (
          <p style={{ marginTop: '5px', fontSize: '13px', color: '#666' }}>
            Importante: Verifique la documentación requerida.
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              {' '}
              (Ver requisitos)
            </a>
          </p>
        )}

        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          Puede seguir el estado de su cita aquí:{' '}
          <a
            href={qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Ver mi turno en tiempo real
          </a>
        </p>

        {cita.estado === 'activa' && (
          <button
            onClick={() => handleCancelCita(cita.id)}
            style={styles.cancelButton}
          >
            Cancelar Cita
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="appointments-page">
      <h2 className="appointments-title">Mis Citas en el Consulado</h2>

      <div className="appointments-grid">
        <section className="appointments-card">
          <h3>Mis Citas Agendadas</h3>

          {loadingMyCitas ? (
            <p>Cargando mis citas...</p>
          ) : myCitas.length === 0 ? (
            <p>No tienes citas agendadas.</p>
          ) : (
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {myCitas.map(renderCitaItem)}
            </ul>
          )}
        </section>

        <section className="appointments-card">
          <h3>Agendar Nueva Cita</h3>

          {renderSuccessMessage()}

          <form onSubmit={handleAgendarCita}>
            {loadingTramites ? (
              <p>Cargando trámites...</p>
            ) : (
              <div>
                <label>1. Seleccione un trámite:</label>
                <br />
                <select
                  value={selectedTramiteId}
                  onChange={(e) => {
                    setSelectedTramiteId(e.target.value);
                    setAgendarError(null);
                    setSuccessMessage(null);
                  }}
                  required
                  style={styles.select}
                >
                  <option value="">-- Por favor seleccione --</option>
                  {tramites.map(tramite => (
                    <option key={tramite.id} value={tramite.id}>
                      {tramite.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedTramiteId && (
              <>
                <div style={{ marginTop: '15px' }}>
                  <label>2. Seleccione una fecha:</label>
                  <br />
                  <div style={styles.calendarContainer}>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      disabled={[
                        finesDeSemana,
                        { before: tomorrow }
                      ]}
                      hidden={day => {
                        const esFinDeSemana = getDay(day) === 0 || getDay(day) === 6;
                        return esFinDeSemana;
                      }}
                      initialFocus
                      footer={selectedDate ?
                        <p style={styles.calendarFooter}>Has seleccionado: {format(selectedDate, 'dd/MM/yyyy')}</p> :
                        <p style={styles.calendarFooter}>Por favor seleccione un día.</p>
                      }
                    />
                  </div>
                </div>

                {loadingSlots && <p>Buscando horarios disponibles...</p>}

                {filteredSlots.length > 0 && selectedDate && (
                  <div style={{ marginTop: '15px' }}>
                    <label>3. Seleccione un horario:</label>
                    <br />
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      required
                      style={styles.select}
                    >
                      <option value="">-- Seleccione un horario --</option>
                      {filteredSlots.map((slotString, index) => (
                        <option key={index} value={slotString}>
                          {slotString}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {filteredSlots.length === 0 && !loadingSlots && selectedTramiteId && selectedDate && (
                  <p style={styles.errorText}>No hay horarios disponibles para esta fecha.</p>
                )}

                {agendarError && <p style={styles.errorText}>{agendarError}</p>}

                <button
                  type="submit"
                  style={styles.submitButton}
                  disabled={
                    !selectedSlot ||
                    loadingSlots ||
                    loadingMyCitas ||
                    !currentUser ||
                    loading
                  }
                >
                  {loading || loadingSlots ? 'Cargando...' : 'Agendar Cita'}
                </button>
              </>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}

const styles = {
  citaListItem: {
    border: '1px solid #ccc',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px'
  },
  cancelButton: {
    backgroundColor: 'red',
    color: 'white',
    marginTop: '10px',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  select: {
    padding: '8px',
    width: '100%',
    maxWidth: '320px',
    boxSizing: 'border-box'
  },
  calendarContainer: {
    border: '1px solid #ccc',
    borderRadius: '5px',
    padding: '5px',
    display: 'inline-block',
    background: 'white'
  },
  calendarFooter: { fontSize: '14px', textAlign: 'center' },
  errorText: { color: 'red', fontWeight: 'bold', marginTop: '10px' },
  submitButton: {
    marginTop: '20px',
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  link: { color: '#007bff', fontWeight: 'bold', textDecoration: 'none' },
  successCard: {
    padding: '15px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #c8e6c9',
    borderRadius: '8px',
    marginBottom: '20px',
    whiteSpace: 'pre-wrap',
    color: '#2e7d32'
  }
};
