import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { buildCitaTrackingUrl, resolvePublicAppUrl } from '../utils/tracking';

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

  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

function capitalizeText(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getCallableErrorMessage(error, fallback) {
  const raw = error?.details || error?.message || '';
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
  return cleaned || fallback;
}

const PRIVACY_CONSENT_VERSION = '2026-03-15';

export default function Appointments() {
  const { currentUser } = useAuth();
  const agendarInFlightRef = useRef(false);
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
  const [successTrackingUrl, setSuccessTrackingUrl] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [copied, setCopied] = useState(false);

  const tomorrow = addDays(new Date(), 1);

  useEffect(() => {
    const fetchTramites = async () => {
      setLoadingTramites(true);
      try {
        const tramitesSnapshot = await getDocs(collection(db, 'tramites'));
        const tramitesList = tramitesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTramites(tramitesList);
      } catch (error) {
        console.error('Error al cargar tramites: ', error);
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
        const citasList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  const selectedTramite = useMemo(() => {
    if (!selectedTramiteId) return null;
    return tramites.find((t) => t.id === selectedTramiteId) || null;
  }, [tramites, selectedTramiteId]);

  const step = useMemo(() => {
    if (!selectedTramiteId) return 1;
    if (!selectedDate) return 2;
    if (!selectedSlot) return 3;
    return 4;
  }, [selectedTramiteId, selectedDate, selectedSlot]);

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
      setSelectedSlot('');
      return;
    }

    const day = getDay(selectedDate);
    if (day === 0 || day === 6) {
      setAvailableSlots([]);
      setSelectedSlot('');
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
          fechaISO: getChileDateISO(selectedDate)
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
    return availableSlots.filter((s) => !userTakenSlotsOnSelectedDate.has(s));
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
    if (loading || agendarInFlightRef.current) return;
    setAgendarError(null);
    setSuccessMessage(null);
    setSuccessCode('');
    setSuccessTrackingUrl('');
    setCopied(false);

    if (!selectedSlot) {
      setAgendarError('Por favor, seleccione un horario.');
      return;
    }

    if (!currentUser || !currentUser.dni) {
      setAgendarError('Error: No se pudieron cargar sus datos de usuario (DNI).');
      return;
    }

    if (!privacyAccepted) {
      setAgendarError('Debe aceptar el aviso de privacidad antes de confirmar la cita.');
      return;
    }

    const auth = getAuth(app);
    const uid = auth.currentUser?.uid || currentUser?.uid;

    if (!uid) {
      setAgendarError('Sesion no valida.');
      return;
    }

    agendarInFlightRef.current = true;
    setLoading(true);

    try {
      await checkDuplicados({
        dniLimpio: currentUser.dni,
        tramiteId: selectedTramiteId
      });

      const resp = await agendarCitaWebLock({
        tramiteId: selectedTramiteId,
        fechaISO: getChileDateISO(selectedDate),
        slot: selectedSlot,
        dni: currentUser.dni,
        userNombre: currentUser.nombre || currentUser.displayName || '',
        userEmail: currentUser.email || '',
        privacyConsentAccepted: true,
        privacyConsentVersion: PRIVACY_CONSENT_VERSION
      });

      const citaId = resp?.data?.citaId || '';
      const codigo = resp?.data?.codigo || '';
      const trackingToken = resp?.data?.trackingToken || '';
      const mensajeFinal = 'Cita agendada con exito.\nRecuerde estar 10 minutos antes.';
      setSuccessMessage(mensajeFinal);
      setSuccessCode(codigo);
      setSuccessTrackingUrl(citaId ? buildCitaTrackingUrl(resolvePublicAppUrl(), citaId, trackingToken) : '');

      setSelectedTramiteId('');
      setSelectedDate(undefined);
      setAvailableSlots([]);
      setSelectedSlot('');
      setPrivacyAccepted(false);
    } catch (error) {
      console.error('Error al agendar la cita: ', error);
      setAgendarError(getCallableErrorMessage(error, 'No se pudo agendar. Intente nuevamente.'));
    } finally {
      agendarInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleCancelCita = async (citaId) => {
    if (!window.confirm('Esta seguro de que desea cancelar esta cita?')) return;

    try {
      const citaDocRef = doc(db, 'citas', citaId);
      await deleteDoc(citaDocRef);
    } catch (error) {
      console.error('Error al cancelar la cita: ', error);
      alert('Hubo un error al cancelar la cita.');
    }
  };

  const handleCopyCode = async () => {
    if (!successCode) return;
    try {
      await navigator.clipboard.writeText(successCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const el = document.createElement('textarea');
      el.value = successCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const renderSuccessMessage = () => {
    if (!successMessage) return null;
    return (
      <div className="cp-alert cp-alert--success" role="status" aria-live="polite">
        <div className="cp-alert-title">Cita confirmada</div>

        {successCode ? (
          <div className="cp-code-row">
            <span className="cp-muted">Codigo:</span>
            <span className="cp-code-pill">{successCode}</span>
            <button type="button" className="cp-btn cp-btn-ghost" onClick={handleCopyCode}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : null}

        <div className="cp-alert-body">{successMessage}</div>
        {successTrackingUrl ? (
          <div className="cp-alert-body">
            <a className="cp-link" href={successTrackingUrl} target="_blank" rel="noopener noreferrer">
              Ver mi turno en tiempo real
            </a>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCitaItem = (cita) => {
    const tramite = tramites.find((t) => t.id === cita.tramiteID);
    const link = tramite?.enlaceInfo;
    const nombreTramite = tramite?.nombre || cita.tramiteID;
    const citaDate = cita.fechaHora?.toDate ? cita.fechaHora.toDate() : null;
    const moduloTexto = cita.moduloAsignado || cita.modulo || 'Por confirmar';

    const esLlamada = cita.estado === 'llamado';
    const estadoTexto = esLlamada
      ? 'Llamada (el consulado ya esta listo para atenderle)'
      : 'En espera (su cita sigue registrada y en espera)';

    const qrUrl = buildCitaTrackingUrl(resolvePublicAppUrl(), cita.id, cita.trackingToken || '');
    const fechaTexto = citaDate ? format(citaDate, 'dd/MM/yyyy HH:mm') : 'Fecha no disponible';
    const fechaDiaTexto = citaDate
      ? capitalizeText(format(citaDate, "EEEE d 'de' MMMM", { locale: es }))
      : 'Fecha no disponible';
    const fechaHoraTexto = citaDate ? format(citaDate, 'HH:mm') : '--:--';

    const badgeClass = esLlamada ? 'cp-badge cp-badge--green' : 'cp-badge cp-badge--amber';
    const badgeText = esLlamada ? 'Llamado' : 'En espera';

    return (
      <li key={cita.id} className="cp-cita-item">
        <div className="cp-cita-top">
          <div className="cp-cita-heading">
            <div className="cp-cita-kicker">Cita registrada</div>
            <div className="cp-cita-title">{nombreTramite}</div>
          </div>
          <span className={badgeClass}>{badgeText}</span>
        </div>

        <div className="cp-cita-highlight">
          <div className="cp-cita-dateCard">
            <div className="cp-cita-dateLabel">Fecha y hora</div>
            <div className="cp-cita-dateDay">{fechaDiaTexto}</div>
            <div className="cp-cita-dateHour">{fechaHoraTexto}</div>
          </div>

          <div className="cp-cita-codeCard">
            <div className="cp-muted">Codigo</div>
            <div className="cp-cita-codeValue">{cita.codigo || '---'}</div>
          </div>
        </div>

        <div className="cp-cita-grid">
          <div className="cp-cita-detail">
            <div className="cp-muted">Fecha completa</div>
            <div className="cp-strong">{fechaTexto}</div>
          </div>
          <div className="cp-cita-detail">
            <div className="cp-muted">Modulo o sucursal</div>
            <div className="cp-strong">{moduloTexto}</div>
          </div>
        </div>

        <div className="cp-cita-note">{estadoTexto}</div>

        <div className="cp-cita-links">
          {link ? (
            <a className="cp-link" href={link} target="_blank" rel="noopener noreferrer">
              Ver requisitos del tramite
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

  const summaryDate = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : '--';
  const summaryTramite = selectedTramite?.nombre || '--';
  const summarySlot = selectedSlot || '--';
  const activeAppointmentsCount = myCitasSorted.length;

  return (
    <div className="appointments-page">
      <header className="appointments-header appointments-header--hero">
        <div className="appointments-hero-copy">
          <div className="appointments-kicker">Mis citas</div>
          <h2 className="appointments-title">Agenda y revisa tus citas en un solo lugar</h2>
          <p className="appointments-subtitle">
            Agenda una nueva cita con claridad y revisa debajo el estado de tus citas activas.
          </p>
        </div>

        <div className="appointments-hero-panel">
          <div className="appointments-hero-stat">
            <span className="appointments-hero-statLabel">Citas activas</span>
            <strong className="appointments-hero-statValue">{activeAppointmentsCount}</strong>
          </div>

          <a className="appointments-hero-link" href="#agendar-cita">
            Ir a agendar nueva cita
          </a>
        </div>
      </header>

      <div className="appointments-grid">
        <section className="appointments-card appointments-card--agendar">
          <div className="cp-section-head" id="agendar-cita">
            <div className="cp-section-kicker">Nuevo agendamiento</div>
            <h3 className="cp-section-title">Agendar nueva cita</h3>
            <div className="cp-muted cp-small">
              Elige tramite, fecha y horario disponible. Solo dias habiles desde manana.
            </div>
          </div>

          <div className="cp-stepper" aria-label="Pasos para agendar">
            <div className={`cp-step ${step > 1 ? 'cp-step--done' : ''} ${step === 1 ? 'cp-step--active' : ''}`}>
              <span className="cp-step-dot" />
              <span className="cp-step-text">Tramite</span>
            </div>
            <div className={`cp-step ${step > 2 ? 'cp-step--done' : ''} ${step === 2 ? 'cp-step--active' : ''}`}>
              <span className="cp-step-dot" />
              <span className="cp-step-text">Fecha</span>
            </div>
            <div className={`cp-step ${step > 3 ? 'cp-step--done' : ''} ${step === 3 ? 'cp-step--active' : ''}`}>
              <span className="cp-step-dot" />
              <span className="cp-step-text">Horario</span>
            </div>
            <div className={`cp-step ${step === 4 ? 'cp-step--active' : ''}`}>
              <span className="cp-step-dot" />
              <span className="cp-step-text">Confirmar</span>
            </div>
          </div>

          <div className="cp-summary" aria-label="Resumen de seleccion">
            <div className="cp-summary-row">
              <span className="cp-muted">Tramite</span>
              <span className="cp-strong">{summaryTramite}</span>
            </div>
            <div className="cp-summary-row">
              <span className="cp-muted">Fecha</span>
              <span className="cp-strong">{summaryDate}</span>
            </div>
            <div className="cp-summary-row">
              <span className="cp-muted">Horario</span>
              <span className="cp-strong">{summarySlot}</span>
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
              <p className="cp-muted">Cargando tramites...</p>
            ) : (
              <div className="cp-form-row">
                <label className="cp-label">1. Tramite</label>
                <select
                  value={selectedTramiteId}
                  onChange={(e) => {
                    setSelectedTramiteId(e.target.value);
                    setSelectedDate(undefined);
                    setAvailableSlots([]);
                    setSelectedSlot('');
                    setAgendarError(null);
                    setSuccessMessage(null);
                    setSuccessCode('');
                    setSuccessTrackingUrl('');
                    setPrivacyAccepted(false);
                    setCopied(false);
                  }}
                  required
                  className="cp-select"
                >
                  <option value="">-- Por favor seleccione --</option>
                  {tramites.map((tramite) => (
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
                      onSelect={(d) => {
                        setSelectedDate(d);
                        setAgendarError(null);
                        setSuccessMessage(null);
                        setSuccessCode('');
                        setSuccessTrackingUrl('');
                        setPrivacyAccepted(false);
                        setCopied(false);
                      }}
                      locale={es}
                      disabled={[finesDeSemana, { before: tomorrow }]}
                      hidden={(day) => getDay(day) === 0 || getDay(day) === 6}
                      initialFocus
                      footer={
                        selectedDate
                          ? <div className="cp-calendar-footer">Has seleccionado: {format(selectedDate, 'dd/MM/yyyy')}</div>
                          : <div className="cp-calendar-footer">Selecciona un dia habil.</div>
                      }
                    />
                  </div>
                </div>

                {selectedDate && userTakenSlotsOnSelectedDate.size > 0 ? (
                  <div className="cp-alert cp-alert--info" role="status">
                    <div className="cp-alert-title">Atencion</div>
                    <div className="cp-alert-body">
                      Ya tienes un horario reservado ese dia. Los horarios tomados se ocultan automaticamente.
                    </div>
                  </div>
                ) : null}

                {loadingSlots ? (
                  <div className="cp-inline-loading">Buscando horarios disponibles...</div>
                ) : null}

                {selectedDate && !loadingSlots && filteredSlots.length > 0 ? (
                  <div className="cp-form-row">
                    <label className="cp-label">3. Horario</label>
                    <div className="cp-slots" role="list">
                      {filteredSlots.map((slotString) => {
                        const isSelected = selectedSlot === slotString;
                        return (
                          <button
                            key={slotString}
                            type="button"
                            className={`cp-slot ${isSelected ? 'cp-slot--selected' : ''}`}
                            onClick={() => setSelectedSlot(slotString)}
                            aria-pressed={isSelected}
                          >
                            {slotString}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {filteredSlots.length === 0 && !loadingSlots && selectedDate ? (
                  <div className="cp-alert cp-alert--info" role="status">
                    <div className="cp-alert-title">Sin horarios disponibles</div>
                    <div className="cp-alert-body">Prueba con otra fecha o vuelve mas tarde.</div>
                  </div>
                ) : null}

                <div className="cp-form-row">
                  <label className="cp-label" htmlFor="privacy-consent">
                    4. Privacidad
                  </label>
                  <label
                    htmlFor="privacy-consent"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(15, 23, 42, 0.14)',
                      background: '#f8fafc'
                    }}
                  >
                    <input
                      id="privacy-consent"
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <span className="cp-small" style={{ color: 'var(--appt-text)' }}>
                      He leido y acepto el aviso de privacidad para usar mis datos en la gestion de la
                      cita, su confirmacion y su seguimiento operativo.{' '}
                      <a
                        className="cp-link"
                        href="/privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver politica de privacidad
                      </a>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="cp-btn cp-btn-primary cp-btn-full"
                  disabled={!selectedSlot || !privacyAccepted || loadingSlots || loadingMyCitas || !currentUser || loading}
                >
                  {loading || loadingSlots ? 'Cargando...' : 'Confirmar cita'}
                </button>

                <div className="cp-footnote">
                  Recomendacion: llegue con 10 minutos de anticipacion. La aceptacion queda registrada al confirmar la cita.
                </div>
              </>
            )}
          </form>
        </section>

        <section className="appointments-card appointments-card--mine">
          <div className="cp-section-head">
            <div className="cp-section-kicker">Tus registros</div>
            <div className="cp-section-titleRow">
              <h3 className="cp-section-title">Mis citas activas y registradas</h3>
              <span className="cp-count-pill">{activeAppointmentsCount}</span>
            </div>
            <div className="cp-muted cp-small">
              Revisa aqui tus citas en espera o si tu turno ya fue llamado.
            </div>
          </div>

          {loadingMyCitas ? (
            <p className="cp-muted">Cargando citas...</p>
          ) : myCitas.length === 0 ? (
            <div className="cp-empty">
              <div className="cp-empty-title">Aun no tienes citas registradas</div>
              <div className="cp-empty-body">
                Cuando agendes una cita, la veras aqui con su fecha, estado y acceso al seguimiento.
              </div>
              <a className="cp-btn cp-btn-primary cp-empty-cta" href="#agendar-cita">
                Agendar mi primera cita
              </a>
            </div>
          ) : (
            <ul className="cp-citas-list">
              {myCitasSorted.map(renderCitaItem)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
