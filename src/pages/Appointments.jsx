import React, { useEffect, useMemo, useState } from 'react';
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

  const [selectedTramiteId, setSelectedTramiteId] = useState('');
  const [selectedDate, setSelectedDate] = useState(undefined);

  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');

  const [agendarError, setAgendarError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [successCode, setSuccessCode] = useState('');

  const tomorrow = addDays(new Date(), 1);

  useEffect(() => {
    const fetchTramites = async () => {
      setLoadingTramites(true);
      try {
        const tramitesSnapshot = await getDocs(collection(db, 'tramites'));
        const tramitesList = tramitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTramites(tramitesList);
      } catch (error) {
        console.error('Error al cargar trámites: ', error);
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
        console.error('Error al escuchar mis citas: ', error);
        setLoadingMyCitas(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

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
      setSelectedSlot('');
      setAgendarError(null);

      try {
        const result = await getAvailableSlots({
          tramiteId: selectedTramiteId,
          fechaISO: selectedDate.toISOString()
        });

        const slots = Array.isArray(result?.data?.slots) ? result.data.slots : [];
        setAvailableSlots(slots);
      } catch (error) {
        console.error('Error al buscar horarios (Cloud Function):', error);
        setAgendarError('Error al buscar horarios. Intente de nuevo.');
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

  const myCitasSorted = useMemo(() => {
    if (!Array.isArray(myCitas)) return [];
    return [...myCitas].sort((a, b) => {
      const ta = a?.fechaHora?.toDate ? a.fechaHora.toDate().getTime() : 0;
      const tb = b?.fechaHora?.toDate ? b.fechaHora.toDate().getTime() : 0;
      return ta - tb;
    });
  }, [myCitas]);

  const handleAgendarCita = async (e) => {
    e.preventDefault();
    setAgendarError(null);
    setSuccessMessage(null);
    setSuccessCode('');

    if (!selectedSlot) {
      setAgendarError('Por favor, seleccione un horario.');
      return;
    }

    if (!currentUser || !currentUser.dni) {
      setAgendarError('Error: No se pudieron cargar sus datos de usuario (DNI).');
      return;
    }

    const auth = getAuth(app);
    const uid = auth.currentUser?.uid || currentUser?.uid;

    if (!uid) {
      setAgendarError('Sesión no válida.');
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
      const mensajeFinal = `Cita agendada con éxito.\nRecuerde estar 10 minutos antes.`;
      setSuccessMessage(mensajeFinal);
      setSuccessCode(codigo);

      setSelectedTramiteId('');
      setSelectedDate(undefined);
      setAvailableSlots([]);
      setSelectedSlot('');
    } catch (error) {
      console.error('Error al agendar la cita: ', error);

      const msg =
        error?.message ||
        error?.details ||
        'No se pudo agendar. Intente nuevamente.';

      setAgendarError(msg);
    }

    setLoading(false);
  };

  const handleCancelCita = async (citaId) => {
    if (!window.confirm('¿Está seguro de que desea cancelar esta cita?')) return;

    try {
      const citaDocRef = doc(db, 'citas', citaId);
      await deleteDoc(citaDocRef);
    } catch (error) {
      console.error('Error al cancelar la cita: ', error);
      alert('Hubo un error al cancelar la cita.');
    }
  };

  const renderSuccessMessage = () => {
    if (!successMessage) return null;
    return (
      <div className="cp-alert cp-alert--success" role="status">
        <div className="cp-alert-title">Cita confirmada</div>
        {successCode ? (
          <div className="cp-code-row">
            <span className="cp-muted">Código:</span>
            <span className="cp-code-pill">{successCode}</span>
          </div>
        ) : null}
        <div className="cp-alert-body">{successMessage}</div>
      </div>
    );
  };

  const renderCitaItem = (cita) => {
    const tramite = tramites.find(t => t.id === cita.tramiteID);
    const link = tramite?.enlaceInfo;
    const nombreTramite = tramite?.nombre || cita.tramiteID;

    const esLlamada = cita.estado === 'llamado';
    const estadoTexto = esLlamada
      ? 'Llamada (el consulado está listo para atenderle)'
      : 'Activa (aún en espera)';

    const qrUrl = `${window.location.origin}/qr-seguimiento?turnoId=${cita.id}`;
    const fechaTexto = cita.fechaHora
      ? format(cita.fechaHora.toDate(), 'dd/MM/yyyy HH:mm')
      : 'Fecha no disponible';

    const badgeClass = esLlamada ? 'cp-badge cp-badge--green' : 'cp-badge cp-badge--amber';
    const badgeText = esLlamada ? 'Llamado' : 'En espera';

    return (
      <li key={cita.id} className="cp-cita-item">
        <div className="cp-cita-top">
          <div className="cp-cita-title">{nombreTramite}</div>
          <span className={badgeClass}>{badgeText}</span>
        </div>

        <div className="cp-cita-grid">
          <div>
            <div className="cp-muted">Código</div>
            <div className="cp-strong">{cita.codigo || '---'}</div>
          </div>
          <div>
            <div className="cp-muted">Fecha y hora</div>
            <div className="cp-strong">{fechaTexto}</div>
          </div>
        </div>

        <div className="cp-cita-note">{estadoTexto}</div>

        <div className="cp-cita-links">
          {link ? (
            <a className="cp-link" href={link} target="_blank" rel="noopener noreferrer">
              Ver requisitos del trámite
            </a>
          ) : null}

          <a className="cp-link" href={qrUrl} target="_blank" rel="noopener noreferrer">
            Ver mi turno en tiempo real
          </a>
        </div>

        {cita.estado === 'activa' ? (
          <div className="cp-cita-actions">
            <button
              type="button"
              className="cp-btn cp-btn-danger"
              onClick={() => handleCancelCita(cita.id)}
            >
              Cancelar cita
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="appointments-page">
      <header className="appointments-header">
        <h2 className="appointments-title">Mis citas</h2>
        <p className="appointments-subtitle">
          Revise sus citas y agende una nueva si lo necesita.
        </p>
      </header>

      <div className="appointments-grid">
        <section className="appointments-card appointments-card--mine">
          <div className="cp-section-head">
            <h3 className="cp-section-title">Mis citas agendadas</h3>
          </div>

          {loadingMyCitas ? (
            <p className="cp-muted">Cargando citas...</p>
          ) : myCitas.length === 0 ? (
            <div className="cp-empty">
              <div className="cp-empty-title">No tienes citas agendadas</div>
              <div className="cp-empty-body">
                Puedes agendar una cita en el formulario de la derecha.
              </div>
            </div>
          ) : (
            <ul className="cp-citas-list">
              {myCitasSorted.map(renderCitaItem)}
            </ul>
          )}
        </section>

        <section className="appointments-card appointments-card--agendar">
          <div className="cp-section-head" id="agendar-cita">
            <h3 className="cp-section-title">Agendar nueva cita</h3>
            <div className="cp-muted cp-small">
              Selecciona un trámite, elige una fecha desde mañana y luego un horario disponible.
            </div>
          </div>

          {renderSuccessMessage()}

          {agendarError ? (
            <div className="cp-alert cp-alert--error" role="alert">
              <div className="cp-alert-title">No se pudo agendar</div>
              <div className="cp-alert-body">{agendarError}</div>
            </div>
          ) : null}

          <form onSubmit={handleAgendarCita}>
            {loadingTramites ? (
              <p className="cp-muted">Cargando trámites...</p>
            ) : (
              <div className="cp-form-row">
                <label className="cp-label">1. Trámite</label>
                <select
                  value={selectedTramiteId}
                  onChange={(e) => {
                    setSelectedTramiteId(e.target.value);
                    setAgendarError(null);
                    setSuccessMessage(null);
                    setSuccessCode('');
                  }}
                  required
                  className="cp-select"
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
                <div className="cp-form-row">
                  <label className="cp-label">2. Fecha</label>
                  <div className="cp-calendar">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      disabled={[finesDeSemana, { before: tomorrow }]}
                      hidden={day => getDay(day) === 0 || getDay(day) === 6}
                      initialFocus
                      footer={
                        selectedDate
                          ? <div className="cp-calendar-footer">Has seleccionado: {format(selectedDate, 'dd/MM/yyyy')}</div>
                          : <div className="cp-calendar-footer">Selecciona un día hábil.</div>
                      }
                    />
                  </div>
                </div>

                {loadingSlots ? (
                  <div className="cp-inline-loading">Buscando horarios disponibles...</div>
                ) : null}

                {filteredSlots.length > 0 && selectedDate && (
                  <div className="cp-form-row">
                    <label className="cp-label">3. Horario</label>
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      required
                      className="cp-select"
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
                  <div className="cp-alert cp-alert--info" role="status">
                    <div className="cp-alert-title">Sin horarios disponibles</div>
                    <div className="cp-alert-body">Prueba con otra fecha o vuelve más tarde.</div>
                  </div>
                )}

                <button
                  type="submit"
                  className="cp-btn cp-btn-primary cp-btn-full"
                  disabled={!selectedSlot || loadingSlots || loadingMyCitas || !currentUser || loading}
                >
                  {loading || loadingSlots ? 'Cargando...' : 'Agendar Cita'}
                </button>

                <div className="cp-footnote">
                  Recomendación: llegue con 10 minutos de anticipación.
                </div>
              </>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}