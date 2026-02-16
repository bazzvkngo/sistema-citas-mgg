// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

const SANTIAGO_REGION = "southamerica-west1";
const CRON_JOB_REGION = "us-central1";
const CHILE_TZ = "America/Santiago";
const TZ_OFFSET = "-03:00";

initializeApp();
const db = getFirestore();

/* =========================
   OBJETIVO 15: COPIA DE ATENCIÓN (BITÁCORA / AUDITORÍA)
   - Generada por Cloud Function (trigger) al pasar a estado "completado"
   - Guarda 1 registro por cierre en /serviceAudit
   - ID incluye fechaHoraAtencionFin para permitir re-cierres (reapertura + cierre)
   ========================= */

function getTsMillis(ts) {
  try {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  } catch {
    return null;
  }
}

function getTsDate(ts) {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function resolveTramiteNombre(tramiteID, fallback = "") {
  const base = fallback ? safeStr(fallback) : "";
  const id = safeStr(tramiteID).trim();
  if (!id) return base;

  try {
    const snap = await db.collection("tramites").doc(id).get();
    if (!snap.exists) return base;
    const d = snap.data() || {};
    return safeStr(d.nombre || base);
  } catch {
    return base;
  }
}

async function resolveAgenteEmail(agenteID) {
  const id = safeStr(agenteID).trim();
  if (!id) return "";
  try {
    const snap = await db.collection("usuarios").doc(id).get();
    if (!snap.exists) return "";
    const d = snap.data() || {};
    return safeStr(d.email || "");
  } catch {
    return "";
  }
}

async function writeServiceAuditIfNeeded({ sourceCollection, sourceId, beforeData, afterData }) {
  const beforeEstado = safeStr(beforeData?.estado);
  const afterEstado = safeStr(afterData?.estado);

  // Solo cuando cambia a "completado"
  if (afterEstado !== "completado" || beforeEstado === "completado") return;

  const finTs = afterData?.fechaHoraAtencionFin || Timestamp.now();
  const finMillis = getTsMillis(finTs) || Date.now();

  // Permite múltiples cierres (si reabren y vuelven a cerrar), pero evita duplicar el mismo cierre
  const auditDocId = `${sourceCollection}_${sourceId}_${finMillis}`;
  const auditRef = db.collection("serviceAudit").doc(auditDocId);

  const existsSnap = await auditRef.get();
  if (existsSnap.exists) return;

  const finDate = getTsDate(finTs) || new Date();
  const dayKey = getChileDateISO(finDate);
  const monthKey = dayKey.slice(0, 7);

  const tramiteID = safeStr(afterData?.tramiteID || afterData?.tramiteId);
  const tramiteNombre = await resolveTramiteNombre(tramiteID, afterData?.tramiteNombre || "");

  const agenteID =
    safeStr(afterData?.agenteID || afterData?.agenteId || afterData?.agenteUid) ||
    safeStr(afterData?.cerradoPor) ||
    "";

  const agenteEmail = await resolveAgenteEmail(agenteID);

  const modulo = safeStr(afterData?.modulo || afterData?.moduloAsignado);

  const payload = {
    sourceCollection,
    sourceId: safeStr(sourceId),
    sourceType: sourceCollection === "citas" ? "WEB" : "KIOSKO",

    codigo: safeStr(afterData?.codigo || ""),
    dni: safeStr(afterData?.dni || ""),

    tramiteID,
    tramiteNombre,

    modulo,

    agenteID,
    agenteEmail,

    estado: afterEstado,
    clasificacion: safeStr(afterData?.clasificacion || "SIN_CLASIFICAR"),
    comentariosAgente: safeStr(afterData?.comentariosAgente || ""),
    observacion: safeStr(afterData?.observacion || ""),

    // timestamps (mantiene compatibilidad con lo que ya exportas)
    fechaHoraProgramada: sourceCollection === "citas" ? (afterData?.fechaHora || null) : null,
    fechaHoraGenerado: afterData?.fechaHoraGenerado || null,
    fechaHoraAtencionFin: finTs,

    cierreMasivo: !!afterData?.cierreMasivo,
    cierreMotivo: safeStr(afterData?.cierreMotivo || ""),
    cerradoPor: safeStr(afterData?.cerradoPor || ""),
    cerradoAt: afterData?.cerradoAt || null,

    dayKey,
    monthKey,

    audit: {
      version: 1,
      createdAt: Timestamp.now(),
      createdBy: "CF_TRIGGER",
    },
  };

  await auditRef.set(payload, { merge: false });
}


function buildLocalRange(startDateISO, endDateISO) {
  const startDate = new Date(`${startDateISO}T00:00:00.000${TZ_OFFSET}`);
  const endDate = new Date(`${endDateISO}T23:59:59.999${TZ_OFFSET}`);

  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

function getChileDateISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHILE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysISOChile(baseISO, days) {
  const base = new Date(`${baseISO}T00:00:00.000${TZ_OFFSET}`);
  const moved = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return getChileDateISO(moved);
}

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_FROM = defineSecret("MAIL_FROM");
const APP_PUBLIC_URL = defineSecret("APP_PUBLIC_URL");

function formatFechaChile(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: CHILE_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "Fecha no disponible";
  }
}

function buildHtml({ nombre, codigo, tramiteNombre, fechaStr, trackingUrl }) {
  const safeNombre = nombre || "ciudadano/a";
  const safeCodigo = codigo || "Sin código";
  const safeTramite = tramiteNombre || "Trámite";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 12px;">Confirmación de cita</h2>
      <p style="margin: 0 0 12px;">Hola ${safeNombre},</p>
      <p style="margin: 0 0 12px;">Su cita fue agendada correctamente.</p>

      <div style="border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin: 14px 0;">
        <p style="margin: 0 0 6px;"><strong>Trámite:</strong> ${safeTramite}</p>
        <p style="margin: 0 0 6px;"><strong>Código:</strong> ${safeCodigo}</p>
        <p style="margin: 0;"><strong>Fecha y hora:</strong> ${fechaStr}</p>
      </div>

      <p style="margin: 0 0 12px;">
        Puede seguir el estado de su turno aquí:
        <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer">${trackingUrl}</a>
      </p>

      <p style="margin: 0;">Por favor, llegue 10 minutos antes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
      <p style="margin: 0; color: #666; font-size: 12px;">
        Este correo fue enviado automáticamente. No responda a este mensaje.
      </p>
    </div>
  `;
}

/* =========================
   EMAIL AL CREAR CITA
   ========================= */

exports.emailOnCitaCreated = onDocumentCreated(
  {
    document: "citas/{citaId}",
    region: SANTIAGO_REGION,
    secrets: [SMTP_USER, SMTP_PASS, MAIL_FROM, APP_PUBLIC_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const cita = snap.data() || {};
    const citaId = event.params.citaId;

    const to = (cita.userEmail || "").trim();
    if (!to) return;

    let tramiteNombre = cita.tramiteID || "Trámite";
    if (cita.tramiteID) {
      try {
        const tSnap = await db.collection("tramites").doc(cita.tramiteID).get();
        if (tSnap.exists) {
          const tData = tSnap.data() || {};
          tramiteNombre = tData.nombre || tramiteNombre;
        }
      } catch (_) {}
    }

    const baseUrl = (APP_PUBLIC_URL.value() || "").replace(/\/+$/, "");
    const trackingUrl = `${baseUrl}/qr-seguimiento?citaId=${citaId}`;

    const fechaStr = cita.fechaHora ? formatFechaChile(cita.fechaHora) : "Fecha no disponible";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_USER.value(),
        pass: SMTP_PASS.value(),
      },
    });

    const subject = `Cita confirmada: ${cita.codigo || "Sin código"} - ${tramiteNombre}`;

    await transporter.sendMail({
      from: MAIL_FROM.value(),
      to,
      subject,
      html: buildHtml({
        nombre: cita.userNombre,
        codigo: cita.codigo,
        tramiteNombre,
        fechaStr,
        trackingUrl,
      }),
    });
  }
);

/* =========================
   UTILIDAD: DNI EXISTE
   ========================= */

exports.checkDniExists = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const dni = request.data?.dni;
  if (!dni || String(dni).length < 7) {
    throw new HttpsError("invalid-argument", "El DNI proporcionado no es válido.");
  }

  try {
    const q = db.collection("usuarios").where("dni", "==", dni).limit(1);
    const querySnapshot = await q.get();
    return { exists: !querySnapshot.empty };
  } catch (error) {
    console.error("Error al verificar DNI:", error);
    throw new HttpsError("internal", "Ocurrió un error interno al verificar el DNI.");
  }
});

/* =========================
   CRON: MARCAR CITAS AUSENTES
   ========================= */

exports.marcarCitasAusentes = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "every 5 minutes",
    timeZone: CHILE_TZ,
  },
  async () => {
    const MARGEN_TOLERANCIA_MIN = 15;

    const now = Timestamp.now();
    const cutoffMillis = now.toMillis() - MARGEN_TOLERANCIA_MIN * 60 * 1000;
    const cutoffTime = Timestamp.fromMillis(cutoffMillis);

    const q = db
      .collection("citas")
      .where("estado", "==", "activa")
      .where("fechaHora", "<", cutoffTime);

    try {
      const snapshot = await q.get();
      if (snapshot.empty) return null;

      const batch = db.batch();

      snapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          estado: "completado",
          clasificacion: "NO_SE_PRESENTO",
          comentariosAgente: `Sistema automático: Cita expiró tras ${MARGEN_TOLERANCIA_MIN} min.`,
          fechaHoraAtencionFin: now,
        });
      });

      await batch.commit();
      return null;
    } catch (error) {
      console.error("Error en 'marcarCitasAusentes':", error);
      throw new HttpsError("internal", "Error al procesar citas ausentes.");
    }
  }
);

/* =========================
   DISPONIBILIDAD DE HORAS
   ========================= */

exports.getAvailableSlots = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { tramiteId, fechaISO } = request.data || {};

  if (!tramiteId || !fechaISO) {
    throw new HttpsError("invalid-argument", "tramiteId y fechaISO son requeridos.");
  }

  const formatHoraChile = (dateObj) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: CHILE_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(dateObj);

    const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hh}:${mm}`;
  };

  const getDayInChile = (dateObj) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CHILE_TZ,
      weekday: "short",
    }).formatToParts(dateObj);
    const w = parts.find((p) => p.type === "weekday")?.value || "";
    return w;
  };

  try {
    const baseDate = new Date(fechaISO);
    const fechaKey = getChileDateISO(baseDate);

    const weekday = getDayInChile(baseDate).toLowerCase();
    if (weekday.startsWith("sat") || weekday.startsWith("sun")) {
      return { slots: [] };
    }

    const feriadosSnap = await db
      .collection("feriados")
      .where("fechaISO", "==", fechaKey)
      .where("activo", "==", true)
      .get();

    if (!feriadosSnap.empty) {
      return { slots: [], motivo: "feriado" };
    }

    const tramiteDoc = await db.collection("tramites").doc(tramiteId).get();
    if (!tramiteDoc.exists) {
      throw new HttpsError("not-found", "El trámite no existe.");
    }

    const tramiteData = tramiteDoc.data() || {};
    const duracion = tramiteData.duracionMin || 15;

    const inicioDiaChile = Timestamp.fromDate(new Date(`${fechaKey}T00:00:00.000${TZ_OFFSET}`));
    const finDiaChile = Timestamp.fromDate(new Date(`${fechaKey}T23:59:59.999${TZ_OFFSET}`));

    const q = db
      .collection("citas")
      .where("tramiteID", "==", tramiteId)
      .orderBy("fechaHora")
      .startAt(inicioDiaChile)
      .endAt(finDiaChile);

    const citasSnapshot = await q.get();

    const bookedSlots = new Set(
      citasSnapshot.docs
        .map((d) => d.data()?.fechaHora)
        .filter(Boolean)
        .map((ts) => formatHoraChile(ts.toDate()))
    );

    const startTime = new Date(`${fechaKey}T09:00:00.000${TZ_OFFSET}`);
    const endTime = new Date(`${fechaKey}T12:30:00.000${TZ_OFFSET}`);

    const allSlots = [];
    let currentTime = new Date(startTime.getTime());

    while (currentTime < endTime) {
      allSlots.push(new Date(currentTime.getTime()));
      currentTime.setMinutes(currentTime.getMinutes() + duracion);
    }

    const available = allSlots
      .map((slotDate) => formatHoraChile(slotDate))
      .filter((hhmm) => !bookedSlots.has(hhmm));

    return { slots: available };
  } catch (error) {
    console.error("Error en getAvailableSlots:", error);
    throw new HttpsError("internal", "Error al buscar horarios.");
  }
});

/* =========================
   TURNO KIOSKO (PRESENCIAL)
   ========================= */

exports.generarTurnoKiosko = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { dniLimpio, tramiteId } = request.data || {};

  if (!dniLimpio || !tramiteId) {
    throw new HttpsError("invalid-argument", "dniLimpio y tramiteId son requeridos.");
  }

  try {
    const qCitas = db
      .collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa");

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene una CITA activa para este trámite.");
    }

    const qTurnos = db
      .collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera");

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene un TURNO en espera para este trámite.");
    }

    const tramiteDoc = await db.collection("tramites").doc(tramiteId).get();
    if (!tramiteDoc.exists) throw new HttpsError("not-found", "El trámite no existe.");

    const tramiteData = tramiteDoc.data() || {};
    const tramiteNombre = tramiteData.nombre;
    const prefijo = tramiteData.prefijo;

    if (!prefijo) {
      throw new HttpsError(
        "failed-precondition",
        `El trámite '${tramiteNombre}' no tiene un prefijo configurado.`
      );
    }

    const contadorRef = db.collection("contadores").doc(tramiteId);
    const turnoRef = db.collection("turnos").doc();

    const nuevoCodigo = await db.runTransaction(async (transaction) => {
      const contadorDoc = await transaction.get(contadorRef);

      let nuevoValor = 1;
      if (contadorDoc.exists) {
        nuevoValor = (contadorDoc.data().valor || 0) + 1;
      }

      const codigoGenerado = `${prefijo}-${String(nuevoValor).padStart(3, "0")}`;

      transaction.set(contadorRef, { valor: nuevoValor }, { merge: true });

      transaction.set(turnoRef, {
        dni: dniLimpio,
        tramiteID: tramiteId,
        codigo: codigoGenerado,
        fechaHoraGenerado: Timestamp.now(),
        estado: "en-espera",
      });

      return codigoGenerado;
    });

    return {
      id: turnoRef.id,
      codigo: nuevoCodigo,
      nombre: tramiteNombre,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;

    console.error("Error al generar turno Kiosko:", error);
    throw new HttpsError("internal", "Error al generar su turno. Intente de nuevo.");
  }
});

/* =========================
   CHECK DUPLICADOS
   ========================= */

exports.checkDuplicados = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { dniLimpio, tramiteId } = request.data || {};

  if (!dniLimpio || !tramiteId) {
    throw new HttpsError("invalid-argument", "dniLimpio y tramiteId son requeridos.");
  }

  try {
    const qCitas = db
      .collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa");

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene una CITA activa.");
    }

    const qTurnos = db
      .collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera");

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene un TURNO en espera.");
    }

    return { exists: false };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error en checkDuplicados:", error);
    throw new HttpsError("internal", "Error al verificar duplicados.");
  }
});

/* =========================
   RESET CONTADORES (KIOSKO) DIARIO
   ========================= */

exports.resetContadoresDiarios = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "0 22 * * *",
    timeZone: CHILE_TZ,
  },
  async () => {
    try {
      const contadoresSnapshot = await db.collection("contadores").get();
      if (contadoresSnapshot.empty) return null;

      const batch = db.batch();
      contadoresSnapshot.forEach((docSnap) => batch.update(docSnap.ref, { valor: 0 }));

      await batch.commit();
      return null;
    } catch (error) {
      console.error("Error en 'resetContadoresDiarios':", error);
      throw new HttpsError("internal", "Error al resetear los contadores.");
    }
  }
);

/* =========================
   METRICAS
   ========================= */

exports.getMetricsData = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { startDateISO, endDateISO } = request.data || {};

  if (!startDateISO || !endDateISO) {
    throw new HttpsError("invalid-argument", "Fechas son requeridas.");
  }

  try {
    const { start, end } = buildLocalRange(startDateISO, endDateISO);

    const stats = {
      citas: { atendido_total: 0, fallo_accion: 0, no_presento: 0 },
      turnos: { atendido_total: 0, fallo_accion: 0, no_presento: 0 },
      detalleCitas: [],
      detalleTurnos: [],
    };

    const toIsoOrNull = (ts) => {
      if (!ts) return null;
      if (typeof ts.toDate === "function") return ts.toDate().toISOString();
      try {
        return new Date(ts).toISOString();
      } catch {
        return null;
      }
    };

    const acumularDocumento = (coleccion, docId, data) => {
      const targetStats = coleccion === "citas" ? stats.citas : stats.turnos;
      const detalleArr = coleccion === "citas" ? stats.detalleCitas : stats.detalleTurnos;

      const clasificacion = data.clasificacion || "SIN_CLASIFICAR";

      switch (clasificacion) {
        case "ATENDIDO_OK":
        case "ATENDIDO":
        case "TRAMITE_OK":
        case "CONSULTA_RESUELTA":
        case "ENTREGA_OK":
        case "OTRO":
          targetStats.atendido_total++;
          break;

        case "FALLO_ACCION":
        case "RECHAZADO":
        case "FALTAN_DOCUMENTOS":
        case "DERIVADO_INTERNO":
          targetStats.fallo_accion++;
          break;

        case "NO_SE_PRESENTO":
          targetStats.no_presento++;
          break;

        default:
          break;
      }

      const fechaHoraAtencionFin = toIsoOrNull(data.fechaHoraAtencionFin);
      const fechaHoraGenerado = toIsoOrNull(data.fechaHoraGenerado);

      const fechaHoraProgramada = coleccion === "citas" ? toIsoOrNull(data.fechaHora) : null;

      detalleArr.push({
        id: docId,
        codigo: data.codigo || "",
        dni: data.dni || "",
        tramiteID: data.tramiteID || "",
        clasificacion,
        comentario: data.comentariosAgente || "",
        modulo: data.modulo || data.moduloAsignado || "",

        agenteID: data.agenteID || "",
        fechaHoraProgramada,
        fechaHoraGenerado,
        fechaHoraAtencionFin,

        estado: data.estado || "",
        cierreMasivo: !!data.cierreMasivo,
        cierreMotivo: data.cierreMotivo || "",
        cerradoPor: data.cerradoPor || "",
      });
    };

    for (const collectionName of ["citas", "turnos"]) {
      const q = db
        .collection(collectionName)
        .where("estado", "==", "completado")
        .where("fechaHoraAtencionFin", ">=", start)
        .where("fechaHoraAtencionFin", "<=", end);

      const snapshot = await q.get();
      snapshot.forEach((docSnap) => acumularDocumento(collectionName, docSnap.id, docSnap.data()));
    }

    return stats;
  } catch (error) {
    console.error("Error en getMetricsData:", error);
    throw new HttpsError("internal", "Error al procesar métricas. Revisa los índices.");
  }
});

/* =========================
   RESET PANTALLA TV
   ========================= */

exports.resetPantallaTvDiaria = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "0 22 * * *",
    timeZone: CHILE_TZ,
  },
  async () => {
    try {
      const estadoColRef = db.collection("estadoSistema");

      const llamadaActualRef = estadoColRef.doc("llamadaActual");
      const historialRef = estadoColRef.doc("historialLlamadas");

      const estadoSnap = await estadoColRef.get();
      const batch = db.batch();

      batch.set(llamadaActualRef, {}, { merge: true });
      batch.set(historialRef, { ultimos: [] }, { merge: true });

      estadoSnap.forEach((docSnap) => {
        const docId = docSnap.id;
        if (docId.startsWith("tramite_")) {
          batch.set(
            docSnap.ref,
            { codigoLlamado: null, modulo: null, timestamp: null },
            { merge: true }
          );
        }
      });

      await batch.commit();
      return null;
    } catch (error) {
      console.error("Error en 'resetPantallaTvDiaria':", error);
      throw new HttpsError("internal", "Error al resetear la Pantalla TV.");
    }
  }
);

/* =========================
   CIERRE MASIVO MANUAL
   ========================= */

async function cerrarJornadaPorFechaISO({ dateISO, motivo, cerradoPorUid = "sistema" }) {
  const { start, end } = buildLocalRange(dateISO, dateISO);
  const now = Timestamp.now();

  const estadosCitas = ["activa", "llamado"];
  const estadosTurnos = ["en-espera", "llamado"];

  const writer = db.bulkWriter();

  let citasCerradas = 0;
  for (const st of estadosCitas) {
    const snap = await db.collection("citas").where("estado", "==", st).get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const ts = data.fechaHora;
      if (!ts || typeof ts.toMillis !== "function") return;

      const ms = ts.toMillis();
      if (ms < start.toMillis() || ms > end.toMillis()) return;

      citasCerradas++;
      writer.update(docSnap.ref, {
        estado: "completado",
        clasificacion: "NO_SE_PRESENTO",
        comentariosAgente: `Cierre masivo (${motivo}).`,
        fechaHoraAtencionFin: now,
        cierreMasivo: true,
        cierreMotivo: motivo,
        cerradoPor: cerradoPorUid,
        cerradoAt: now,
      });
    });
  }

  let turnosCerrados = 0;
  for (const st of estadosTurnos) {
    const snap = await db.collection("turnos").where("estado", "==", st).get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const ts = data.fechaHoraGenerado;
      if (!ts || typeof ts.toMillis !== "function") return;

      const ms = ts.toMillis();
      if (ms < start.toMillis() || ms > end.toMillis()) return;

      turnosCerrados++;
      writer.update(docSnap.ref, {
        estado: "completado",
        clasificacion: "NO_SE_PRESENTO",
        comentariosAgente: `Cierre masivo (${motivo}).`,
        fechaHoraAtencionFin: now,
        cierreMasivo: true,
        cierreMotivo: motivo,
        cerradoPor: cerradoPorUid,
        cerradoAt: now,
      });
    });
  }

  await writer.close();
  return { ok: true, citasCerradas, turnosCerrados };
}

exports.cerrarJornadaMasiva = onCall({ region: SANTIAGO_REGION }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para cerrar jornada.");
    }

    const { dateISO, motivo = "cierre_contingencia" } = data || {};
    if (!dateISO) throw new HttpsError("invalid-argument", "Falta dateISO (YYYY-MM-DD)");

    return await cerrarJornadaPorFechaISO({
      dateISO,
      motivo,
      cerradoPorUid: auth.uid,
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("cerrarJornadaMasiva error:", err);
    throw new HttpsError("internal", "Error al cerrar jornada masiva.");
  }
});

/* =========================
   OBJETIVO 8:
   - CODIGO WEB CORRELATIVO POR DIA: C{PREFIJO}-001
   - CIERRE DIARIO DE CITAS WEB
   ========================= */

function buildWebCounterId(tramiteId, fechaKey) {
  return `${tramiteId}_${fechaKey}`;
}

async function cerrarCitasWebPorFechaISO({ dateISO, motivo, cerradoPorUid = "sistema" }) {
  const { start, end } = buildLocalRange(dateISO, dateISO);
  const now = Timestamp.now();

  const estadosCitas = ["activa", "llamado"];
  const writer = db.bulkWriter();

  let citasCerradas = 0;
  for (const st of estadosCitas) {
    const snap = await db.collection("citas").where("estado", "==", st).get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const ts = data.fechaHora;
      if (!ts || typeof ts.toMillis !== "function") return;

      // Solo citas WEB: tienen fechaHora (programada). (Turnos kiosko usan fechaHoraGenerado)
      const ms = ts.toMillis();
      if (ms < start.toMillis() || ms > end.toMillis()) return;

      citasCerradas++;
      writer.update(docSnap.ref, {
        estado: "completado",
        clasificacion: "NO_SE_PRESENTO",
        comentariosAgente: `Cierre diario (${motivo}).`,
        fechaHoraAtencionFin: now,
        cierreMasivo: true,
        cierreMotivo: motivo,
        cerradoPor: cerradoPorUid,
        cerradoAt: now,
      });
    });
  }

  await writer.close();
  return { ok: true, citasCerradas };
}

// Cierra citas web automáticamente cada día a las 22:00 Chile
exports.cerrarCitasWebDiarias = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "0 22 * * *",
    timeZone: CHILE_TZ,
  },
  async () => {
    try {
      const dateISO = getChileDateISO(new Date());
      await cerrarCitasWebPorFechaISO({
        dateISO,
        motivo: "cierre_diario",
        cerradoPorUid: "sistema",
      });
      return null;
    } catch (error) {
      console.error("Error en 'cerrarCitasWebDiarias':", error);
      throw new HttpsError("internal", "Error al cerrar citas web diarias.");
    }
  }
);

/* =========================
   OBJETIVO 3 y 4:
   - 1 cita por turno por trámite
   - Un ciudadano no puede tener 2 citas en la misma hora (aunque sea otro trámite)
   + OBJETIVO 8:
   - codigo web correlativo por dia
   ========================= */

exports.agendarCitaWebLock = onCall({ region: SANTIAGO_REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesión para agendar.");
  }

  const { tramiteId, fechaISO, slot, dni, userNombre = "", userEmail = "" } = request.data || {};

  if (!tramiteId || !fechaISO || !slot || !dni) {
    throw new HttpsError("invalid-argument", "tramiteId, fechaISO, slot y dni son requeridos.");
  }

  const slotMatch = String(slot).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!slotMatch) {
    throw new HttpsError("invalid-argument", "El horario (slot) no es válido.");
  }

  const fechaKey = getChileDateISO(new Date(fechaISO));
  const hhmmCompact = String(slot).replace(":", "");

  // Lock por trámite+fecha+hora (Objetivo 3)
  const lockId = `t_${tramiteId}_${fechaKey}_${hhmmCompact}`;
  const lockRef = db.collection("slotLocks").doc(lockId);

  // Lock por usuario(DNI)+fecha+hora (Objetivo 4)
  const dniStr = String(dni).trim();
  const userLockId = `u_${dniStr}_${fechaKey}_${hhmmCompact}`;
  const userLockRef = db.collection("slotLocks").doc(userLockId);

  const citaRef = db.collection("citas").doc();
  const uid = request.auth.uid;

  const fechaHoraDate = new Date(`${fechaKey}T${slot}:00.000${TZ_OFFSET}`);
  const fechaHoraTs = Timestamp.fromDate(fechaHoraDate);

  // Contador WEB por tramite + día (Objetivo 8)
  const counterId = buildWebCounterId(tramiteId, fechaKey);
  const counterRef = db.collection("contadoresWeb").doc(counterId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        throw new HttpsError("already-exists", "Ese horario ya fue tomado para este trámite. Seleccione otro.");
      }

      const userLockSnap = await tx.get(userLockRef);
      if (userLockSnap.exists) {
        throw new HttpsError("already-exists", "Usted ya tiene una cita en ese horario. Seleccione otro.");
      }

      const tramiteDoc = await tx.get(db.collection("tramites").doc(tramiteId));
      if (!tramiteDoc.exists) {
        throw new HttpsError("not-found", "El trámite no existe.");
      }
      const tramiteData = tramiteDoc.data() || {};
      const prefijo = (tramiteData.prefijo || "").trim();

      if (!prefijo) {
        throw new HttpsError("failed-precondition", "El trámite no tiene prefijo configurado.");
      }

      const counterSnap = await tx.get(counterRef);
      let nuevoValor = 1;
      if (counterSnap.exists) {
        nuevoValor = (counterSnap.data().valor || 0) + 1;
      }

      tx.set(counterRef, { valor: nuevoValor, tramiteID: tramiteId, fechaISO: fechaKey }, { merge: true });

      const codigo = `C${prefijo}-${String(nuevoValor).padStart(3, "0")}`;

      tx.set(lockRef, {
        tipo: "tramite",
        tramiteID: tramiteId,
        fechaISO: fechaKey,
        slot: String(slot),
        citaId: citaRef.id,
        createdAt: Timestamp.now(),
      });

      tx.set(userLockRef, {
        tipo: "usuario",
        dni: dniStr,
        fechaISO: fechaKey,
        slot: String(slot),
        citaId: citaRef.id,
        createdAt: Timestamp.now(),
      });

      tx.set(citaRef, {
        userID: uid,
        dni: dniStr,
        userNombre,
        userEmail,
        tramiteID: tramiteId,
        fechaHora: fechaHoraTs,
        fechaHoraGenerado: Timestamp.now(),
        codigo,
        estado: "activa",
        slotLockId: lockId,
        userSlotLockId: userLockId,
      });

      return { citaId: citaRef.id, codigo };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error en agendarCitaWebLock:", error);
    throw new HttpsError("internal", "No se pudo agendar la cita. Intente de nuevo.");
  }
});

exports.releaseSlotLockOnCitaDeleted = onDocumentDeleted(
  { document: "citas/{citaId}", region: SANTIAGO_REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() || {};
    const lockId = data.slotLockId;
    const userLockId = data.userSlotLockId;

    try {
      const deletes = [];
      if (lockId) deletes.push(db.collection("slotLocks").doc(lockId).delete());
      if (userLockId) deletes.push(db.collection("slotLocks").doc(userLockId).delete());
      if (deletes.length) await Promise.allSettled(deletes);
    } catch (err) {
      console.error("Error liberando slotLocks:", err);
    }
  }
);

// =========================
// Paso 7 (Reabrir / Editar citas cerradas)
// =========================

exports.adminUpdateClosedCita = onCall({ region: SANTIAGO_REGION }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";

    // ✅ Permitir admin y agente
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para editar citas cerradas.");
    }

    const { citaId, observacion = "" } = data || {};
    if (!citaId) throw new HttpsError("invalid-argument", "Falta citaId.");

    const ref = db.collection("citas").doc(String(citaId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "La cita no existe.");

    // Solo permitir editar si ya está cerrada
    const cita = snap.data() || {};
    if (cita.estado !== "completado") {
      throw new HttpsError("failed-precondition", "Solo se pueden editar citas en estado 'completado'.");
    }

    await ref.update({
      observacion: String(observacion),
      updatedAt: Timestamp.now(),
      updatedBy: auth.uid,
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("adminUpdateClosedCita error:", err);
    throw new HttpsError("internal", "Error al editar la cita cerrada.");
  }
});

exports.adminReopenCita = onCall({ region: SANTIAGO_REGION }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";

    // ✅ Permitir admin y agente
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para reabrir citas.");
    }

    const { citaId } = data || {};
    if (!citaId) throw new HttpsError("invalid-argument", "Falta citaId.");

    const ref = db.collection("citas").doc(String(citaId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "La cita no existe.");

    const cita = snap.data() || {};

    // Solo reabrir si está cerrada
    if (cita.estado !== "completado") {
      throw new HttpsError("failed-precondition", "Solo se pueden reabrir citas en estado 'completado'.");
    }

    await ref.update({
      estado: "activa",
      clasificacion: null,
      comentariosAgente: null,
      fechaHoraAtencionFin: null,
      cierreMasivo: false,
      cierreMotivo: null,
      cerradoPor: null,
      cerradoAt: null,
      reopenedAt: Timestamp.now(),
      reopenedBy: auth.uid,
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("adminReopenCita error:", err);
    throw new HttpsError("internal", "Error al reabrir la cita.");
  }
});


/* =========================
   OBJETIVO 15: TRIGGERS AUDITORÍA
   ========================= */

exports.auditCitasCompletadas = onDocumentUpdated(
  { document: "citas/{citaId}", region: SANTIAGO_REGION },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;

    const beforeData = before.data() || {};
    const afterData = after.data() || {};
    const sourceId = event.params?.citaId || after.id;

    await writeServiceAuditIfNeeded({
      sourceCollection: "citas",
      sourceId,
      beforeData,
      afterData,
    });
  }
);

exports.auditTurnosCompletados = onDocumentUpdated(
  { document: "turnos/{turnoId}", region: SANTIAGO_REGION },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;

    const beforeData = before.data() || {};
    const afterData = after.data() || {};
    const sourceId = event.params?.turnoId || after.id;

    await writeServiceAuditIfNeeded({
      sourceCollection: "turnos",
      sourceId,
      beforeData,
      afterData,
    });
  }
);

