// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { FieldPath, FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth"); //  NUEVO (Paso 10)
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const {
  normalizeEmailServer,
  isValidEmailServer,
  normalizeSingleLineTextServer,
  normalizeMultilineTextServer,
  normalizeArcoTypeServer,
  normalizeArcoStatusServer,
  isArcoFinalStatus,
  normalizeRequesterDocumentServer,
  isValidRequesterDocumentServer,
} = require("./arcoUtils");
const {
  AUDIT_LOG_RETENTION_DAYS,
  buildAuditLogRetentionFields,
  buildServiceAuditMetadata,
  normalizeAuditExportInput,
  serializeAuditValue,
} = require("./auditPolicy");

const SANTIAGO_REGION = "southamerica-west1";
const CRON_JOB_REGION = "us-central1";
const CHILE_TZ = "America/Santiago";
const TZ_OFFSET = "-03:00";
const TRACKING_PUBLIC_ACTIVE_TURNO_TTL_MS = 24 * 60 * 60 * 1000;
const TRACKING_PUBLIC_ACTIVE_CITA_TTL_MS = 24 * 60 * 60 * 1000;
const TRACKING_PUBLIC_FINALIZED_TTL_MS = 6 * 60 * 60 * 1000;
const TRACKING_PUBLIC_CLEANUP_BATCH_LIMIT = 200;
const TRACKING_PUBLIC_CLEANUP_MAX_BATCHES = 5;
const RATE_LIMIT_COLLECTION = "rateLimits";
const DEFAULT_RATE_LIMIT_MESSAGE = "Demasiadas solicitudes. Intente nuevamente en unos minutos.";
const ACTIVE_RECORD_EXISTS_MESSAGE = "Ya existe un registro activo para este trámite.";
const INVALID_TRAMITE_LOOKUP_MESSAGE = "Faltan datos válidos para consultar horarios.";
const INVALID_KIOSK_INPUT_MESSAGE = "Documento o trámite no válidos.";
const INVALID_APPOINTMENT_INPUT_MESSAGE = "Faltan datos válidos para agendar la cita.";
const INVALID_SLOT_SELECTION_MESSAGE = "El horario seleccionado no es válido.";

const INVALID_ARCO_REQUEST_MESSAGE = "Faltan datos validos para registrar la solicitud.";
const INVALID_ARCO_ADMIN_UPDATE_MESSAGE = "Faltan datos validos para actualizar la solicitud.";

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

function normalizeRateLimitFragment(value, fallback = "anon") {
  const normalized = safeStr(value).trim().toLowerCase();
  return normalized || fallback;
}

function hashRateLimitIdentity(parts) {
  return crypto.createHash("sha256").update(parts.join("||")).digest("hex");
}

function getRequestIp(request) {
  const forwardedFor = safeStr(request?.rawRequest?.headers?.["x-forwarded-for"]);
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  return safeStr(
    request?.rawRequest?.ip ||
    request?.rawRequest?.socket?.remoteAddress ||
    request?.rawRequest?.connection?.remoteAddress ||
    "unknown"
  ).trim();
}

function getRequestAppId(request) {
  return normalizeRateLimitFragment(request?.app?.appId, "no-app");
}

function getAppClientRateLimitKey(request) {
  return [getRequestAppId(request), normalizeRateLimitFragment(getRequestIp(request), "unknown-ip")];
}

async function assertRateLimit({
  endpoint,
  scope,
  keyParts = [],
  limit,
  windowMs,
  message = DEFAULT_RATE_LIMIT_MESSAGE,
}) {
  if (!endpoint || !scope || !Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000) {
    throw new Error(`Invalid rate limit configuration for ${endpoint || "unknown-endpoint"}.`);
  }

  const nowMs = Date.now();
  const windowBucket = Math.floor(nowMs / windowMs);
  const identityHash = hashRateLimitIdentity([
    endpoint,
    scope,
    ...keyParts.map((part) => normalizeRateLimitFragment(part)),
  ]);
  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(`${windowBucket}_${identityHash}`);
  const nowTs = Timestamp.now();
  const expiresAt = Timestamp.fromMillis((windowBucket + 2) * windowMs);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateLimitRef);
    const data = snap.exists ? (snap.data() || {}) : {};
    const currentCount = Number(data.count || 0);

    if (currentCount >= limit) {
      throw new HttpsError("resource-exhausted", message);
    }

    tx.set(
      rateLimitRef,
      {
        endpoint,
        scope,
        count: currentCount + 1,
        limit,
        windowMs,
        windowBucket,
        createdAt: snap.exists ? (data.createdAt || nowTs) : nowTs,
        updatedAt: nowTs,
        expiresAt,
      },
      { merge: true }
    );
  });
}

async function writeAuditLog({
  action,
  entityType,
  entityId,
  actorUid = null,
  actorRole = null,
  source,
  summary,
  metadata = null,
}) {
  const nowTs = Timestamp.now();
  const payload = {
    action: safeStr(action),
    entityType: safeStr(entityType),
    entityId: safeStr(entityId),
    actorUid: actorUid ? safeStr(actorUid) : null,
    actorRole: actorRole ? safeStr(actorRole) : null,
    timestamp: nowTs,
    source: safeStr(source),
    summary: safeStr(summary),
    ...buildAuditLogRetentionFields(nowTs),
  };

  if (metadata && typeof metadata === "object") {
    payload.metadata = metadata;
  }

  await db.collection("auditLogs").add(payload);
}

async function writeAuditLogSafe(entry) {
  try {
    await writeAuditLog(entry);
  } catch (error) {
    console.error("writeAuditLog error:", error);
  }
}

function normalizeCitizenDocServer(raw) {
  return safeStr(raw)
    .trim()
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

function isValidCitizenDocServer(docNorm) {
  return /^[0-9]{6,8}[0-9K]$/.test(safeStr(docNorm));
}

function normalizeTramiteIdServer(raw) {
  return safeStr(raw).trim();
}

function isValidTramiteIdServer(tramiteId) {
  const id = safeStr(tramiteId);
  return !!id && id.length <= 120 && !id.includes("/");
}

function buildKioskTurnoLockId(dniLimpio, tramiteId) {
  const docNorm = normalizeCitizenDocServer(dniLimpio);
  const tramiteNorm = normalizeTramiteIdServer(tramiteId);
  return `${docNorm}__${Buffer.from(tramiteNorm).toString("base64url")}`;
}

function getActiveRecordLockId(data) {
  return safeStr(data?.activeRecordLockId || data?.kioskTurnoLockId).trim();
}

function getActiveRecordLockSource(data) {
  return {
    sourceCollection: safeStr(data?.sourceCollection).trim(),
    sourceId: safeStr(data?.sourceId || data?.turnoId || data?.citaId).trim(),
  };
}

function isBlockingActiveRecordState(sourceCollection, estado) {
  const col = safeStr(sourceCollection).trim();
  const state = safeStr(estado).trim();
  return (col === "turnos" && state === "en-espera") || (col === "citas" && state === "activa");
}

async function assertActiveRecordLockAvailable(tx, lockRef) {
  const lockSnap = await tx.get(lockRef);
  if (!lockSnap.exists) return;

  const lockData = lockSnap.data() || {};
  const { sourceCollection, sourceId } = getActiveRecordLockSource(lockData);

  if (!sourceCollection || !sourceId || !["turnos", "citas"].includes(sourceCollection)) {
    tx.delete(lockRef);
    return;
  }

  const sourceRef = db.collection(sourceCollection).doc(sourceId);
  const sourceSnap = await tx.get(sourceRef);
  if (!sourceSnap.exists) {
    tx.delete(lockRef);
    return;
  }

  const sourceData = sourceSnap.data() || {};
  if (!isBlockingActiveRecordState(sourceCollection, sourceData.estado)) {
    tx.delete(lockRef);
    return;
  }

  throw new HttpsError("already-exists", ACTIVE_RECORD_EXISTS_MESSAGE);
}

function generateTrackingPublicToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function buildTrackingPublicDoc({
  sourceCollection,
  sourceId,
  codigo,
  estado,
  tramiteID,
  modulo = null,
  createdAt,
  updatedAt,
  expiresAt,
}) {
  const created = createdAt || Timestamp.now();
  return {
    sourceCollection: safeStr(sourceCollection),
    sourceId: safeStr(sourceId),
    codigo: safeStr(codigo),
    estado: safeStr(estado),
    tramiteID: safeStr(tramiteID),
    modulo: modulo === undefined || modulo === "" ? null : modulo,
    createdAt: created,
    updatedAt: updatedAt || created,
    expiresAt: expiresAt || created,
  };
}

function addMsToTimestamp(ts, ms) {
  const baseMs = getTsMillis(ts);
  if (baseMs === null) return Timestamp.now();
  return Timestamp.fromMillis(baseMs + ms);
}

function computeTrackingPublicExpiresAt({
  sourceCollection,
  estado,
  createdAt,
  updatedAt,
  scheduledAt,
}) {
  const estadoNorm = safeStr(estado).trim().toLowerCase();
  const isFinalState = ["completado", "cerrado", "cancelado", "expirado"].includes(estadoNorm);

  if (isFinalState) {
    return addMsToTimestamp(updatedAt || createdAt || Timestamp.now(), TRACKING_PUBLIC_FINALIZED_TTL_MS);
  }

  if (sourceCollection === "citas") {
    return addMsToTimestamp(scheduledAt || createdAt || Timestamp.now(), TRACKING_PUBLIC_ACTIVE_CITA_TTL_MS);
  }

  return addMsToTimestamp(createdAt || updatedAt || Timestamp.now(), TRACKING_PUBLIC_ACTIVE_TURNO_TTL_MS);
}

function normalizeTrackingPublicModulo(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

function pickTrackingPublicModulo(sourceCollection, data) {
  if (sourceCollection === "citas") {
    return normalizeTrackingPublicModulo(data?.moduloAsignado ?? data?.modulo);
  }
  return normalizeTrackingPublicModulo(data?.modulo ?? data?.moduloAsignado);
}

async function syncTrackingPublicStatus({
  sourceCollection,
  sourceId,
  beforeData,
  afterData,
}) {
  const trackingToken = safeStr(afterData?.trackingToken || beforeData?.trackingToken).trim();
  if (!trackingToken) return;

  const beforeEstado = safeStr(beforeData?.estado);
  const afterEstado = safeStr(afterData?.estado);
  const beforeModulo = pickTrackingPublicModulo(sourceCollection, beforeData);
  const afterModulo = pickTrackingPublicModulo(sourceCollection, afterData);
  const expiresAt = computeTrackingPublicExpiresAt({
    sourceCollection,
    estado: afterEstado,
    createdAt: afterData?.fechaHoraGenerado || beforeData?.fechaHoraGenerado || Timestamp.now(),
    updatedAt: afterData?.fechaHoraAtencionFin || afterData?.llamadoAt || Timestamp.now(),
    scheduledAt: afterData?.fechaHora || beforeData?.fechaHora || null,
  });

  if (beforeEstado === afterEstado && String(beforeModulo ?? "") === String(afterModulo ?? "")) {
    return;
  }

  await db.collection("trackingPublic").doc(trackingToken).set(
    {
      sourceCollection,
      sourceId,
      estado: afterEstado,
      modulo: afterModulo,
      updatedAt: Timestamp.now(),
      expiresAt,
    },
    { merge: true }
  );
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
  const auditCreatedAt = Timestamp.now();

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

    audit: buildServiceAuditMetadata(auditCreatedAt),
  };

  await auditRef.set(payload, { merge: false });
}

async function deleteCollectionDocsByTimestamp({
  collectionName,
  dateField,
  cutoff,
  batchLimit = TRACKING_PUBLIC_CLEANUP_BATCH_LIMIT,
  maxBatches = TRACKING_PUBLIC_CLEANUP_MAX_BATCHES,
}) {
  let deletedCount = 0;
  let batchesRun = 0;

  while (batchesRun < maxBatches) {
    const snapshot = await db
      .collection(collectionName)
      .where(dateField, "<=", cutoff)
      .orderBy(dateField, "asc")
      .limit(batchLimit)
      .get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    deletedCount += snapshot.size;
    batchesRun++;

    if (snapshot.size < batchLimit) {
      return { deletedCount, batchesRun, hasMore: false };
    }
  }

  return {
    deletedCount,
    batchesRun,
    hasMore: batchesRun === maxBatches,
  };
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
    const trackingToken = safeStr(cita.trackingToken).trim();
    const trackingUrl = trackingToken
      ? `${baseUrl}/qr-seguimiento?t=${trackingToken}`
      : `${baseUrl}/qr-seguimiento?citaId=${citaId}`;

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

exports.checkDniExists = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  const dni = normalizeCitizenDocServer(request.data?.dni);
  if (!isValidCitizenDocServer(dni)) {
    throw new HttpsError("invalid-argument", "El DNI proporcionado no es válido.");
  }

  try {
    await assertRateLimit({
      endpoint: "checkDniExists",
      scope: "app_ip",
      keyParts: getAppClientRateLimitKey(request),
      limit: 20,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas validaciones de documento. Intente nuevamente en unos minutos.",
    });

    const q = db.collection("usuarios").where("dni", "==", dni).limit(1);
    const querySnapshot = await q.get();
    return { exists: !querySnapshot.empty };
  } catch (error) {
    console.error("Error al verificar DNI:", error);
    throw new HttpsError("internal", "Ocurrió un error interno al verificar el DNI.");
  }
});

exports.lookupCitizenUserByDoc = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    await assertRateLimit({
      endpoint: "lookupCitizenUserByDoc",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 30,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas busquedas de ciudadanos. Intente nuevamente en unos minutos.",
    });

    const callerSnap = await db.collection("usuarios").doc(auth.uid).get();
    const caller = callerSnap.exists ? (callerSnap.data() || {}) : null;
    const rol = safeStr(caller?.rol || caller?.role || caller?.tipoUsuario || caller?.perfil)
      .trim()
      .toLowerCase();

    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No autorizado.");
    }

    const docNorm = normalizeCitizenDocServer(data?.doc || data?.docNorm || data?.dni || data?.rut);
    if (!docNorm || docNorm.length < 7) {
      throw new HttpsError("invalid-argument", "Documento no valido.");
    }

    const fields = ["dni", "rut", "docNorm"];

    for (const field of fields) {
      const snap = await db.collection("usuarios").where(field, "==", docNorm).limit(5).get();
      if (snap.empty) continue;

      for (const docSnap of snap.docs) {
        const user = docSnap.data() || {};
        const userRol = safeStr(user.rol || user.role || user.tipoUsuario || user.perfil).trim().toLowerCase();
        if (userRol && userRol !== "ciudadano") continue;

        return {
          found: true,
          user: {
            docNorm,
            docDisplay: safeStr(user.rut || user.dni || user.docNorm || docNorm).trim(),
            tipoDoc: safeStr(user.tipoDoc || "DNI").trim() || "DNI",
            nombre: safeStr(user.nombre || "").trim(),
            nombreCompleto: safeStr(user.nombreCompleto || "").trim(),
            nombres: safeStr(user.nombres || "").trim(),
            apellidos: safeStr(user.apellidos || "").trim(),
            telefono: safeStr(user.telefono || "").trim(),
            email: safeStr(user.email || "").trim(),
          },
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error("lookupCitizenUserByDoc error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Error interno al buscar ciudadano.");
  }
});

exports.createArcoRequest = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const type = normalizeArcoTypeServer(request.data?.type);
    const requesterName = normalizeSingleLineTextServer(request.data?.requesterName, 180);
    const requesterEmail = normalizeEmailServer(request.data?.requesterEmail);
    const requesterDocument = normalizeRequesterDocumentServer(request.data?.requesterDocument);
    const details = normalizeMultilineTextServer(request.data?.details, 4000);
    const privacyAccepted = request.data?.privacyAccepted === true;
    const requesterUid = request.auth?.uid || null;

    if (
      !type ||
      !requesterName ||
      !isValidEmailServer(requesterEmail) ||
      !isValidRequesterDocumentServer(requesterDocument) ||
      details.length < 10 ||
      !privacyAccepted
    ) {
      throw new HttpsError("invalid-argument", INVALID_ARCO_REQUEST_MESSAGE);
    }

    await assertRateLimit({
      endpoint: "createArcoRequest",
      scope: "app_ip",
      keyParts: getAppClientRateLimitKey(request),
      limit: 5,
      windowMs: 15 * 60 * 1000,
      message: "Demasiadas solicitudes ARCO desde este origen. Intente nuevamente mas tarde.",
    });

    const nowTs = Timestamp.now();
    const arcoRef = db.collection("arcoRequests").doc();

    await arcoRef.set({
      type,
      status: "pendiente",
      createdAt: nowTs,
      updatedAt: nowTs,
      requesterName,
      requesterEmail,
      requesterDocument,
      requesterUid,
      details,
      privacyAccepted: true,
      privacyAcceptedAt: nowTs,
      source: "web",
      resolutionNotes: "",
      resolvedAt: null,
      resolvedByUid: null,
    });

    await writeAuditLogSafe({
      action: "create_arco_request",
      entityType: "arcoRequests",
      entityId: arcoRef.id,
      actorUid: requesterUid,
      actorRole: requesterUid ? "ciudadano" : "publico_web",
      source: "callable:createArcoRequest",
      summary: `Solicitud ARCO ${type} registrada.`,
      metadata: {
        type,
        status: "pendiente",
      },
    });

    return { ok: true, requestId: arcoRef.id };
  } catch (error) {
    console.error("createArcoRequest error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Error al registrar la solicitud ARCO.");
  }
});

exports.adminUpdateArcoRequest = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    await requireAdmin(auth.uid);

    const requestId = normalizeSingleLineTextServer(data?.requestId, 120);
    const requestedStatus = data?.status === undefined ? null : normalizeArcoStatusServer(data?.status);
    const resolutionNotes = normalizeMultilineTextServer(data?.resolutionNotes, 4000);

    if (!requestId || (data?.status !== undefined && !requestedStatus)) {
      throw new HttpsError("invalid-argument", INVALID_ARCO_ADMIN_UPDATE_MESSAGE);
    }

    const arcoRef = db.collection("arcoRequests").doc(requestId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(arcoRef);
      if (!snap.exists) throw new HttpsError("not-found", "La solicitud ARCO no existe.");

      const before = snap.data() || {};
      const beforeStatus = normalizeArcoStatusServer(before.status) || "pendiente";
      const nextStatus = requestedStatus || beforeStatus;
      const nowTs = Timestamp.now();
      const becameResolved = !isArcoFinalStatus(beforeStatus) && isArcoFinalStatus(nextStatus);

      const patch = {
        status: nextStatus,
        resolutionNotes,
        updatedAt: nowTs,
      };

      if (isArcoFinalStatus(nextStatus)) {
        patch.resolvedAt = becameResolved ? nowTs : (before.resolvedAt || nowTs);
        patch.resolvedByUid = auth.uid;
      } else {
        patch.resolvedAt = null;
        patch.resolvedByUid = null;
      }

      tx.set(arcoRef, patch, { merge: true });

      return {
        beforeStatus,
        nextStatus,
        becameResolved,
        type: normalizeArcoTypeServer(before.type),
      };
    });

    if (result.beforeStatus !== result.nextStatus) {
      await writeAuditLogSafe({
        action: "update_arco_request_status",
        entityType: "arcoRequests",
        entityId: requestId,
        actorUid: auth.uid,
        actorRole: "admin",
        source: "callable:adminUpdateArcoRequest",
        summary: `Solicitud ARCO cambió de ${result.beforeStatus} a ${result.nextStatus}.`,
        metadata: {
          type: result.type,
          previousStatus: result.beforeStatus,
          newStatus: result.nextStatus,
        },
      });
    }

    if (result.becameResolved) {
      await writeAuditLogSafe({
        action: "resolve_arco_request",
        entityType: "arcoRequests",
        entityId: requestId,
        actorUid: auth.uid,
        actorRole: "admin",
        source: "callable:adminUpdateArcoRequest",
        summary: `Solicitud ARCO marcada como ${result.nextStatus}.`,
        metadata: {
          type: result.type,
          status: result.nextStatus,
        },
      });
    }

    return { ok: true, status: result.nextStatus };
  } catch (error) {
    console.error("adminUpdateArcoRequest error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Error al actualizar la solicitud ARCO.");
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
      await writeAuditLogSafe({
        action: "auto_complete_expired_citas",
        entityType: "citas",
        entityId: getChileDateISO(new Date()),
        actorUid: "system",
        actorRole: "system",
        source: "schedule:marcarCitasAusentes",
        summary: `Cierre automático de ${snapshot.size} cita(s) por ausencia.`,
        metadata: {
          affectedCount: snapshot.size,
          toleranceMinutes: MARGEN_TOLERANCIA_MIN,
        },
      });
      return null;
    } catch (error) {
      console.error("Error en 'marcarCitasAusentes':", error);
      throw new HttpsError("internal", "Error al procesar citas ausentes.");
    }
  }
);

/* =========================
   RETENCION: TRACKING PUBLICO Y AUDIT LOGS
   ========================= */

exports.cleanupTrackingPublic = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "every 30 minutes",
    timeZone: CHILE_TZ,
  },
  async () => {
    const result = await deleteCollectionDocsByTimestamp({
      collectionName: "trackingPublic",
      dateField: "expiresAt",
      cutoff: Timestamp.now(),
    });

    if (result.deletedCount > 0 || result.hasMore) {
      console.info("cleanupTrackingPublic result", result);
    }

    return null;
  }
);

exports.cleanupAuditLogs = onSchedule(
  {
    region: CRON_JOB_REGION,
    schedule: "30 3 * * *",
    timeZone: CHILE_TZ,
  },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await deleteCollectionDocsByTimestamp({
      collectionName: "auditLogs",
      dateField: "timestamp",
      cutoff,
    });

    if (result.deletedCount > 0 || result.hasMore) {
      console.info("cleanupAuditLogs result", result);
    }

    return null;
  }
);

/* =========================
   DISPONIBILIDAD DE HORAS
   ========================= */

exports.getAvailableSlots = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  const { tramiteId, fechaISO } = request.data || {};

  if (!tramiteId || !fechaISO) {
    throw new HttpsError("invalid-argument", INVALID_TRAMITE_LOOKUP_MESSAGE);
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
    await assertRateLimit({
      endpoint: "getAvailableSlots",
      scope: "app_ip",
      keyParts: getAppClientRateLimitKey(request),
      limit: 60,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas consultas de horarios disponibles. Intente nuevamente en unos minutos.",
    });

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

exports.generarTurnoKiosko = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  const dniLimpio = normalizeCitizenDocServer(request.data?.dniLimpio);
  const tramiteId = normalizeTramiteIdServer(request.data?.tramiteId);

  if (!isValidCitizenDocServer(dniLimpio) || !isValidTramiteIdServer(tramiteId)) {
    throw new HttpsError("invalid-argument", INVALID_KIOSK_INPUT_MESSAGE);
  }

  try {
    await assertRateLimit({
      endpoint: "generarTurnoKiosko",
      scope: "document",
      keyParts: [dniLimpio],
      limit: 8,
      windowMs: 10 * 60 * 1000,
      message: "Demasiados intentos para generar turnos con este documento. Intente nuevamente en unos minutos.",
    });

    const qCitas = db
      .collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa")
      .limit(1);

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", ACTIVE_RECORD_EXISTS_MESSAGE);
    }

    const qTurnos = db
      .collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera")
      .limit(1);

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", ACTIVE_RECORD_EXISTS_MESSAGE);
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
    const turnoLockId = buildKioskTurnoLockId(dniLimpio, tramiteId);
    const turnoLockRef = db.collection("kioskTurnoLocks").doc(turnoLockId);
    const trackingToken = generateTrackingPublicToken();
    const trackingRef = db.collection("trackingPublic").doc(trackingToken);

    const nuevoCodigo = await db.runTransaction(async (transaction) => {
      const nowTs = Timestamp.now();
      await assertActiveRecordLockAvailable(transaction, turnoLockRef);

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
        fechaHoraGenerado: nowTs,
        estado: "en-espera",
        trackingToken,
        activeRecordLockId: turnoLockId,
        kioskTurnoLockId: turnoLockId,
      });

      transaction.set(turnoLockRef, {
        dni: dniLimpio,
        tramiteID: tramiteId,
        turnoId: turnoRef.id,
        sourceCollection: "turnos",
        sourceId: turnoRef.id,
        createdAt: nowTs,
      });

      transaction.set(
        trackingRef,
        buildTrackingPublicDoc({
          sourceCollection: "turnos",
          sourceId: turnoRef.id,
          codigo: codigoGenerado,
          estado: "en-espera",
          tramiteID: tramiteId,
          modulo: null,
          createdAt: nowTs,
          updatedAt: nowTs,
          expiresAt: computeTrackingPublicExpiresAt({
            sourceCollection: "turnos",
            estado: "en-espera",
            createdAt: nowTs,
            updatedAt: nowTs,
            scheduledAt: null,
          }),
        })
      );

      return codigoGenerado;
    });

    const response = {
      id: turnoRef.id,
      codigo: nuevoCodigo,
      nombre: tramiteNombre,
      trackingToken,
    };
    await writeAuditLogSafe({
      action: "create_turno_kiosko",
      entityType: "turnos",
      entityId: turnoRef.id,
      actorUid: null,
      actorRole: "kiosko_publico",
      source: "callable:generarTurnoKiosko",
      summary: `Turno kiosko generado para trámite ${tramiteId}.`,
      metadata: {
        tramiteID: tramiteId,
        codigo: nuevoCodigo,
      },
    });
    return response;
  } catch (error) {
    if (error instanceof HttpsError) throw error;

    console.error("Error al generar turno Kiosko:", error);
    throw new HttpsError("internal", "Error al generar su turno. Intente de nuevo.");
  }
});

/* =========================
   CHECK DUPLICADOS
   ========================= */

exports.checkDuplicados = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  const dniLimpio = normalizeCitizenDocServer(request.data?.dniLimpio);
  const tramiteId = normalizeTramiteIdServer(request.data?.tramiteId);

  if (!isValidCitizenDocServer(dniLimpio) || !isValidTramiteIdServer(tramiteId)) {
    throw new HttpsError("invalid-argument", INVALID_KIOSK_INPUT_MESSAGE);
  }

  try {
    await assertRateLimit({
      endpoint: "checkDuplicados",
      scope: "app_ip",
      keyParts: getAppClientRateLimitKey(request),
      limit: 20,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas validaciones de duplicados. Intente nuevamente en unos minutos.",
    });

    const qCitas = db
      .collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa")
      .limit(1);

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", ACTIVE_RECORD_EXISTS_MESSAGE);
    }

    const qTurnos = db
      .collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera")
      .limit(1);

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", ACTIVE_RECORD_EXISTS_MESSAGE);
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
   METRICAS (v2)
   - Mantiene compatibilidad con respuesta anterior (stats.citas/turnos + detalle arrays)
   - Agrega:
     - agrupaciones: byAgente / byModulo / byTramite
     - tiempos: espera (llamadoAt - base) y atención (fechaHoraAtencionFin - llamadoAt)
       * base: WEB usa fechaHora (programada); KIOSKO usa fechaHoraGenerado
   ========================= */

function initTimeStats() {
  return { count: 0, minMs: null, maxMs: null, sumMs: 0, avgMs: 0 };
}

function addTimeSample(obj, ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  obj.count++;
  obj.sumMs += ms;
  obj.minMs = obj.minMs === null ? ms : Math.min(obj.minMs, ms);
  obj.maxMs = obj.maxMs === null ? ms : Math.max(obj.maxMs, ms);
  obj.avgMs = obj.count ? Math.round(obj.sumMs / obj.count) : 0;
}

function msToMinutes(ms) {
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms / 60000) * 10) / 10; // 1 decimal
}

exports.getMetricsData = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  const { auth } = request;
  const { startDateISO, endDateISO, includeDetails = true } = request.data || {};

  if (!auth) {
    throw new HttpsError("unauthenticated", "No autenticado.");
  }

  if (!startDateISO || !endDateISO) {
    throw new HttpsError("invalid-argument", "Fechas son requeridas.");
  }

  try {
    await requireAdmin(auth.uid);

    await assertRateLimit({
      endpoint: "getMetricsData",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 12,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas consultas de metricas. Intente nuevamente en unos minutos.",
    });

    const { start, end } = buildLocalRange(startDateISO, endDateISO);

    const stats = {
      // Compatibilidad (lo que ya consume el front)
      citas: { atendido_total: 0, fallo_accion: 0, no_presento: 0 },
      turnos: { atendido_total: 0, fallo_accion: 0, no_presento: 0 },
      detalleCitas: [],
      detalleTurnos: [],

      // Nuevos
      byAgente: {},   // agenteID -> { total, WEB, KIOSKO, modulos: {m: n}, tramites: {t: n} }
      byModulo: {},   // modulo -> { total, WEB, KIOSKO, agentes: {a: n}, tramites: {t: n} }
      byTramite: {},  // tramiteID -> { total, WEB, KIOSKO, agentes: {a: n}, modulos: {m: n} }

      tiempos: {
        espera: initTimeStats(),
        atencion: initTimeStats()
      },

      // Top (para reportes: mayor/menor)
      topEsperaMin: [],
      topEsperaMax: [],
      topAtencionMin: [],
      topAtencionMax: [],
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

    const toMillisOrNull = (ts) => {
      if (!ts) return null;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      try {
        const d = new Date(ts);
        const m = d.getTime();
        return Number.isFinite(m) ? m : null;
      } catch {
        return null;
      }
    };

    const safeKey = (v) => safeStr(v || "").trim();

    const bumpNested = (obj, key) => {
      if (!key) return;
      obj[key] = (obj[key] || 0) + 1;
    };

    const ensureAgg = (map, key, base) => {
      if (!map[key]) map[key] = JSON.parse(JSON.stringify(base));
      return map[key];
    };

    const pushTop = (arr, item, maxLen = 10) => {
      arr.push(item);
      if (arr.length > maxLen) arr.length = maxLen;
    };

    const sortTopAsc = (arr, field) => arr.sort((a, b) => (a[field] ?? 0) - (b[field] ?? 0));
    const sortTopDesc = (arr, field) => arr.sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0));

    const updateTopLists = ({ esperaMs, atencionMs, baseItem }) => {
      if (Number.isFinite(esperaMs)) {
        // min
        pushTop(stats.topEsperaMin, { ...baseItem, esperaMin: msToMinutes(esperaMs) });
        sortTopAsc(stats.topEsperaMin, "esperaMin");
        // max
        pushTop(stats.topEsperaMax, { ...baseItem, esperaMin: msToMinutes(esperaMs) });
        sortTopDesc(stats.topEsperaMax, "esperaMin");
      }
      if (Number.isFinite(atencionMs)) {
        // min
        pushTop(stats.topAtencionMin, { ...baseItem, atencionMin: msToMinutes(atencionMs) });
        sortTopAsc(stats.topAtencionMin, "atencionMin");
        // max
        pushTop(stats.topAtencionMax, { ...baseItem, atencionMin: msToMinutes(atencionMs) });
        sortTopDesc(stats.topAtencionMax, "atencionMin");
      }

      // recorta para quedar en top 10
      stats.topEsperaMin = stats.topEsperaMin.slice(0, 10);
      stats.topEsperaMax = stats.topEsperaMax.slice(0, 10);
      stats.topAtencionMin = stats.topAtencionMin.slice(0, 10);
      stats.topAtencionMax = stats.topAtencionMax.slice(0, 10);
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

      const modulo = safeKey(data.modulo || data.moduloAsignado);
      const agenteID = safeKey(data.agenteID || data.agenteId || data.agenteUid || data.cerradoPor);
      const tramiteID = safeKey(data.tramiteID || data.tramiteId);
      const origen = coleccion === "citas" ? "WEB" : "KIOSKO";

      // ---------- tiempos ----------
      const finMs = toMillisOrNull(data.fechaHoraAtencionFin);
      const llamadoMs = toMillisOrNull(data.llamadoAt);
      const baseMs = coleccion === "citas"
        ? toMillisOrNull(data.fechaHora)           // programada
        : toMillisOrNull(data.fechaHoraGenerado);  // generado

      const esperaMs = (llamadoMs != null && baseMs != null) ? (llamadoMs - baseMs) : null;
      const atencionMs = (finMs != null && llamadoMs != null) ? (finMs - llamadoMs) : null;

      addTimeSample(stats.tiempos.espera, esperaMs);
      addTimeSample(stats.tiempos.atencion, atencionMs);

      const baseItem = {
        id: docId,
        origen,
        codigo: safeKey(data.codigo),
        dni: safeKey(data.dni),
        tramiteID,
        modulo,
        agenteID
      };
      updateTopLists({ esperaMs, atencionMs, baseItem });

      // ---------- agrupaciones ----------
      const agenteAgg = ensureAgg(stats.byAgente, agenteID || "SIN_AGENTE", {
        total: 0,
        WEB: 0,
        KIOSKO: 0,
        modulos: {},
        tramites: {}
      });
      agenteAgg.total++;
      agenteAgg[origen] = (agenteAgg[origen] || 0) + 1;
      bumpNested(agenteAgg.modulos, modulo || "SIN_MODULO");
      bumpNested(agenteAgg.tramites, tramiteID || "SIN_TRAMITE");

      const moduloAgg = ensureAgg(stats.byModulo, modulo || "SIN_MODULO", {
        total: 0,
        WEB: 0,
        KIOSKO: 0,
        agentes: {},
        tramites: {}
      });
      moduloAgg.total++;
      moduloAgg[origen] = (moduloAgg[origen] || 0) + 1;
      bumpNested(moduloAgg.agentes, agenteID || "SIN_AGENTE");
      bumpNested(moduloAgg.tramites, tramiteID || "SIN_TRAMITE");

      const tramiteAgg = ensureAgg(stats.byTramite, tramiteID || "SIN_TRAMITE", {
        total: 0,
        WEB: 0,
        KIOSKO: 0,
        agentes: {},
        modulos: {}
      });
      tramiteAgg.total++;
      tramiteAgg[origen] = (tramiteAgg[origen] || 0) + 1;
      bumpNested(tramiteAgg.agentes, agenteID || "SIN_AGENTE");
      bumpNested(tramiteAgg.modulos, modulo || "SIN_MODULO");

      // ---------- detalle (compatibilidad) ----------
      if (includeDetails) {
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

          llamadoAt: toIsoOrNull(data.llamadoAt) || null,

          // métricas unitarias (minutos)
          esperaMin: msToMinutes(esperaMs),
          atencionMin: msToMinutes(atencionMs),

          estado: data.estado || "",
          cierreMasivo: !!data.cierreMasivo,
          cierreMotivo: data.cierreMotivo || "",
          cerradoPor: data.cerradoPor || "",
        });
      }
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

    // Devuelve también promedios en minutos (más útil para UI)
    stats.tiempos = {
      espera: {
        ...stats.tiempos.espera,
        minMin: msToMinutes(stats.tiempos.espera.minMs),
        maxMin: msToMinutes(stats.tiempos.espera.maxMs),
        avgMin: msToMinutes(stats.tiempos.espera.avgMs),
      },
      atencion: {
        ...stats.tiempos.atencion,
        minMin: msToMinutes(stats.tiempos.atencion.minMs),
        maxMin: msToMinutes(stats.tiempos.atencion.maxMs),
        avgMin: msToMinutes(stats.tiempos.atencion.avgMs),
      }
    };

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

      const estadoSnap = await estadoColRef
        .where(FieldPath.documentId(), ">=", "tramite_")
        .where(FieldPath.documentId(), "<=", "tramite_\uf8ff")
        .get();
      const batch = db.batch();

      batch.set(llamadaActualRef, {}, { merge: true });
      batch.set(historialRef, { ultimos: [] }, { merge: true });

      estadoSnap.forEach((docSnap) => {
        batch.set(
          docSnap.ref,
          { codigoLlamado: null, modulo: null, timestamp: null },
          { merge: true }
        );
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
    const snap = await db.collection("citas")
      .where("estado", "==", st)
      .where("fechaHora", ">=", start)
      .where("fechaHora", "<=", end)
      .get();

    snap.forEach((docSnap) => {
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
    const snap = await db.collection("turnos")
      .where("estado", "==", st)
      .where("fechaHoraGenerado", ">=", start)
      .where("fechaHoraGenerado", "<=", end)
      .get();

    snap.forEach((docSnap) => {
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
  return {
    ok: true,
    citasCerradas,
    turnosCerrados,
    noop: citasCerradas === 0 && turnosCerrados === 0,
  };
}

exports.cerrarJornadaMasiva = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para cerrar jornada.");
    }

    await assertRateLimit({
      endpoint: "cerrarJornadaMasiva",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 3,
      windowMs: 10 * 60 * 1000,
      message: "Demasiados intentos de cierre masivo. Intente nuevamente en unos minutos.",
    });

    const { dateISO, motivo = "cierre_contingencia" } = data || {};
    if (!dateISO) throw new HttpsError("invalid-argument", "Falta dateISO (YYYY-MM-DD)");

    const result = await cerrarJornadaPorFechaISO({
      dateISO,
      motivo,
      cerradoPorUid: auth.uid,
    });
    if (!result?.noop) {
      await writeAuditLogSafe({
        action: "mass_close_jornada",
        entityType: "jornada",
        entityId: safeStr(dateISO),
        actorUid: auth.uid,
        actorRole: rol,
        source: "callable:cerrarJornadaMasiva",
        summary: `Cierre masivo ejecutado para ${dateISO}.`,
        metadata: {
          motivo: safeStr(motivo),
          citasCerradas: result.citasCerradas || 0,
          turnosCerrados: result.turnosCerrados || 0,
        },
      });
    }
    return result;
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
    const snap = await db.collection("citas")
      .where("estado", "==", st)
      .where("fechaHora", ">=", start)
      .where("fechaHora", "<=", end)
      .get();

    snap.forEach((docSnap) => {
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
  return { ok: true, citasCerradas, noop: citasCerradas === 0 };
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
      const result = await cerrarCitasWebPorFechaISO({
        dateISO,
        motivo: "cierre_diario",
        cerradoPorUid: "sistema",
      });
      if (!result?.noop) {
        await writeAuditLogSafe({
          action: "daily_close_citas_web",
          entityType: "citas",
          entityId: safeStr(dateISO),
          actorUid: "system",
          actorRole: "system",
          source: "schedule:cerrarCitasWebDiarias",
          summary: `Cierre diario automático de citas web para ${dateISO}.`,
          metadata: {
            citasCerradas: result.citasCerradas || 0,
            motivo: "cierre_diario",
          },
        });
      }
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

exports.agendarCitaWebLock = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesión para agendar.");
  }

  const {
    tramiteId,
    fechaISO,
    slot,
    dni,
    userNombre = "",
    userEmail = "",
    privacyConsentAccepted = false,
    privacyConsentVersion = "",
  } = request.data || {};

  if (!tramiteId || !fechaISO || !slot || !dni) {
    throw new HttpsError("invalid-argument", INVALID_APPOINTMENT_INPUT_MESSAGE);
  }

  const slotMatch = String(slot).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!slotMatch) {
    throw new HttpsError("invalid-argument", INVALID_SLOT_SELECTION_MESSAGE);
  }

  if (privacyConsentAccepted !== true) {
    throw new HttpsError("failed-precondition", "Debe aceptar el aviso de privacidad para agendar.");
  }

  const consentVersion = safeStr(privacyConsentVersion).trim();
  if (!consentVersion) {
    throw new HttpsError("invalid-argument", "Falta la versión del aviso de privacidad.");
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
  const activeRecordLockId = buildKioskTurnoLockId(dniStr, tramiteId);
  const activeRecordLockRef = db.collection("kioskTurnoLocks").doc(activeRecordLockId);

  const citaRef = db.collection("citas").doc();
  const trackingToken = generateTrackingPublicToken();
  const trackingRef = db.collection("trackingPublic").doc(trackingToken);
  const uid = request.auth.uid;

  const fechaHoraDate = new Date(`${fechaKey}T${slot}:00.000${TZ_OFFSET}`);
  const fechaHoraTs = Timestamp.fromDate(fechaHoraDate);

  // Contador WEB por tramite + día (Objetivo 8)
  const counterId = buildWebCounterId(tramiteId, fechaKey);
  const counterRef = db.collection("contadoresWeb").doc(counterId);

  try {
    await assertRateLimit({
      endpoint: "agendarCitaWebLock",
      scope: "uid",
      keyParts: [request.auth.uid],
      limit: 6,
      windowMs: 15 * 60 * 1000,
      message: "Demasiados intentos de agendamiento. Intente nuevamente en unos minutos.",
    });

    await assertRateLimit({
      endpoint: "agendarCitaWebLock",
      scope: "document",
      keyParts: [dniStr],
      limit: 4,
      windowMs: 15 * 60 * 1000,
      message: "Demasiados intentos de agendamiento para este documento. Intente nuevamente en unos minutos.",
    });

    const result = await db.runTransaction(async (tx) => {
      const nowTs = Timestamp.now();
      await assertActiveRecordLockAvailable(tx, activeRecordLockRef);

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
        createdAt: nowTs,
      });

      tx.set(userLockRef, {
        tipo: "usuario",
        dni: dniStr,
        fechaISO: fechaKey,
        slot: String(slot),
        citaId: citaRef.id,
        createdAt: nowTs,
      });

      tx.set(activeRecordLockRef, {
        dni: dniStr,
        tramiteID: tramiteId,
        citaId: citaRef.id,
        sourceCollection: "citas",
        sourceId: citaRef.id,
        createdAt: nowTs,
      });

      tx.set(citaRef, {
        userID: uid,
        dni: dniStr,
        userNombre,
        userEmail,
        tramiteID: tramiteId,
        fechaHora: fechaHoraTs,
        fechaHoraGenerado: nowTs,
        codigo,
        estado: "activa",
        slotLockId: lockId,
        userSlotLockId: userLockId,
        activeRecordLockId,
        trackingToken,
        privacyConsentAccepted: true,
        privacyConsentAcceptedAt: nowTs,
        privacyConsentVersion: consentVersion,
        privacyConsentSource: "web",
      });

      tx.set(
        trackingRef,
        buildTrackingPublicDoc({
          sourceCollection: "citas",
          sourceId: citaRef.id,
          codigo,
          estado: "activa",
          tramiteID: tramiteId,
          modulo: null,
          createdAt: nowTs,
          updatedAt: nowTs,
          expiresAt: computeTrackingPublicExpiresAt({
            sourceCollection: "citas",
            estado: "activa",
            createdAt: nowTs,
            updatedAt: nowTs,
            scheduledAt: fechaHoraTs,
          }),
        })
      );

      return { citaId: citaRef.id, codigo, trackingToken };
    });

    await writeAuditLogSafe({
      action: "create_cita_web",
      entityType: "citas",
      entityId: safeStr(result.citaId),
      actorUid: uid,
      actorRole: "ciudadano",
      source: "callable:agendarCitaWebLock",
      summary: `Cita web agendada para trámite ${tramiteId}.`,
      metadata: {
        tramiteID: tramiteId,
        codigo: safeStr(result.codigo),
      },
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
    const activeRecordLockId = getActiveRecordLockId(data);

    try {
      const deletes = [];
      if (lockId) deletes.push(db.collection("slotLocks").doc(lockId).delete());
      if (userLockId) deletes.push(db.collection("slotLocks").doc(userLockId).delete());
      if (activeRecordLockId) deletes.push(db.collection("kioskTurnoLocks").doc(activeRecordLockId).delete());
      if (deletes.length) await Promise.allSettled(deletes);
    } catch (err) {
      console.error("Error liberando slotLocks:", err);
    }
  }
);

exports.releaseActiveRecordLockOnCitaUpdated = onDocumentUpdated(
  { document: "citas/{citaId}", region: SANTIAGO_REGION },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;

    const beforeData = before.data() || {};
    const afterData = after.data() || {};
    const beforeEstado = safeStr(beforeData.estado);
    const afterEstado = safeStr(afterData.estado);

    if (beforeEstado !== "activa" || afterEstado === "activa") return;

    const lockId = getActiveRecordLockId(afterData) || getActiveRecordLockId(beforeData);
    if (!lockId) return;

    try {
      await db.collection("kioskTurnoLocks").doc(lockId).delete();
    } catch (err) {
      console.error("Error liberando activeRecordLock de cita:", err);
    }
  }
);

exports.releaseKioskTurnoLockOnTurnoUpdated = onDocumentUpdated(
  { document: "turnos/{turnoId}", region: SANTIAGO_REGION },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;

    const beforeData = before.data() || {};
    const afterData = after.data() || {};
    const beforeEstado = safeStr(beforeData.estado);
    const afterEstado = safeStr(afterData.estado);

    if (beforeEstado !== "en-espera" || afterEstado === "en-espera") return;

    const lockId = getActiveRecordLockId(afterData) || getActiveRecordLockId(beforeData);
    if (!lockId) return;

    try {
      await db.collection("kioskTurnoLocks").doc(lockId).delete();
    } catch (err) {
      console.error("Error liberando kioskTurnoLock:", err);
    }
  }
);

exports.releaseKioskTurnoLockOnTurnoDeleted = onDocumentDeleted(
  { document: "turnos/{turnoId}", region: SANTIAGO_REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() || {};
    const lockId = getActiveRecordLockId(data);
    if (!lockId) return;

    try {
      await db.collection("kioskTurnoLocks").doc(lockId).delete();
    } catch (err) {
      console.error("Error liberando kioskTurnoLock al borrar turno:", err);
    }
  }
);

// =========================
// Paso 7 (Reabrir / Editar citas cerradas)
// =========================

exports.adminUpdateClosedCita = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";

    //  Permitir admin y agente
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para editar citas cerradas.");
    }

    await assertRateLimit({
      endpoint: "adminUpdateClosedCita",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 20,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas ediciones de citas cerradas. Intente nuevamente en unos minutos.",
    });

    const { citaId, comentariosAgente = "", observacion = "" } = data || {};
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
      comentariosAgente: String(comentariosAgente),
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

exports.adminReopenCita = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? uSnap.data() : null;
    const rol = u?.rol || u?.role || "user";

    //  Permitir admin y agente
    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No tienes permisos para reabrir citas.");
    }

    await assertRateLimit({
      endpoint: "adminReopenCita",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 10,
      windowMs: 5 * 60 * 1000,
      message: "Demasiadas reaperturas de citas. Intente nuevamente en unos minutos.",
    });

    const { citaId } = data || {};
    if (!citaId) throw new HttpsError("invalid-argument", "Falta citaId.");

    const ref = db.collection("citas").doc(String(citaId));
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "La cita no existe.");

      const cita = snap.data() || {};

      // Solo reabrir si está cerrada
      if (cita.estado !== "completado") {
        throw new HttpsError("failed-precondition", "Solo se pueden reabrir citas en estado 'completado'.");
      }

      tx.update(ref, {
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

      return { reopened: true };
    });

    if (result?.reopened) {
      await writeAuditLogSafe({
        action: "reopen_cita",
        entityType: "citas",
        entityId: safeStr(citaId),
        actorUid: auth.uid,
        actorRole: rol,
        source: "callable:adminReopenCita",
        summary: `Cita reabierta y devuelta a estado activa.`,
        metadata: {
          previousEstado: "completado",
          newEstado: "activa",
        },
      });
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("adminReopenCita error:", err);
    throw new HttpsError("internal", "Error al reabrir la cita.");
  }
});

/* =========================
   PASO 10: ADMIN EDITA AGENTES (datos + email + contraseña)
   ========================= */

exports.adminUpdateAgente = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    await requireAdmin(auth.uid);

    await assertRateLimit({
      endpoint: "adminUpdateAgente",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 12,
      windowMs: 10 * 60 * 1000,
      message: "Demasiadas actualizaciones de agentes. Intente nuevamente en unos minutos.",
    });

    const {
      uid,                 // uid del agente a editar
      updates = {},        // campos a actualizar en Firestore usuarios/{uid}
      newPassword = "",    // opcional: set password en Auth
    } = data || {};

    const targetUid = safeStr(uid).trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "Falta uid del agente.");

    // Validaciones básicas (sin ser restrictivo)
    const allowed = [
      "nombre",
      "name",
      "email",
      "rol",
      "role",
      "modulo",
      "moduloAsignado",
      "activo",
      "telefono",
      "cargo",
    ];

    const clean = {};
    for (const k of Object.keys(updates || {})) {
      if (allowed.includes(k)) clean[k] = updates[k];
    }

    // Normalizar roles si te llegan en "role"
    if (clean.role && !clean.rol) clean.rol = clean.role;
    delete clean.role;

    // Normalizar nombre si te llega en "name"
    if (clean.name && !clean.nombre) clean.nombre = clean.name;
    delete clean.name;

    // Si llega email, normalizar
    if (clean.email) clean.email = safeStr(clean.email).trim().toLowerCase();

    // Si llega activo, convertir a boolean
    if (clean.activo !== undefined) clean.activo = !!clean.activo;

    const userRef = db.collection("usuarios").doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "El usuario/agente no existe en Firestore.");

    //  Update Auth (email / password) si corresponde
    const authUpdates = {};
    if (clean.email) authUpdates.email = clean.email;

    const pwd = safeStr(newPassword).trim();
    if (pwd) {
      if (pwd.length < 6) throw new HttpsError("invalid-argument", "La contraseña debe tener mínimo 6 caracteres.");
      authUpdates.password = pwd;
    }

    if (Object.keys(authUpdates).length) {
      await getAuth().updateUser(targetUid, authUpdates);
    }

    //  Update Firestore usuarios/{uid}
    const patch = {
      ...clean,
      updatedAt: Timestamp.now(),
      updatedBy: auth.uid,
    };

    await userRef.set(patch, { merge: true });

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("adminUpdateAgente error:", err);
    throw new HttpsError("internal", "Error al actualizar el agente.");
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

    await syncTrackingPublicStatus({
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

    await syncTrackingPublicStatus({
      sourceCollection: "turnos",
      sourceId,
      beforeData,
      afterData,
    });
  }
);

/* =========================
   OBJETIVO A: LLAMADO SIMPLE (1 BOTÓN)
   - Agente presiona "Llamar siguiente"
   - Cloud Function decide si corresponde KIOSKO o CITA WEB (hoy)
   - Actualiza:
     - /turnos o /citas => estado "llamado" + modulo/agente
     - /estadoSistema/llamadaActual
     - /estadoSistema/tramite_{tramiteId}
   ========================= */

function normalizeModuloServer(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : s; // si no es numérico, devuelve string (por si usan "AP")
}

function sameModulo(a, b) {
  const na = normalizeModuloServer(a);
  const nb = normalizeModuloServer(b);
  if (na === null || nb === null) return false;
  return String(na) === String(nb);
}

async function pickNextCandidate({ nowTs, dateISO, allowedTramites }) {
  const allowedSet =
    allowedTramites && typeof allowedTramites.has === "function"
      ? allowedTramites
      : null;

  const isAllowed = (docSnap) => {
    if (!allowedSet) return true;
    const d = docSnap.data() || {};
    const tid = String(d.tramiteID || d.tramiteId || "").trim();
    return !!tid && allowedSet.has(tid);
  };

  // 1) Citas WEB con hora cumplida (solo hoy) -> prioridad absoluta
  const { start, end } = buildLocalRange(dateISO, dateISO);

  const citasQ = db
    .collection("citas")
    .where("estado", "==", "activa")
    .where("fechaHora", ">=", start)
    .where("fechaHora", "<=", end)
    .where("fechaHora", "<=", nowTs)
    .orderBy("fechaHora", "asc")
    .limit(25);

  // 2) Turnos KIOSKO en-espera (por antigüedad)
  const turnosQ = db
    .collection("turnos")
    .where("estado", "==", "en-espera")
    .orderBy("fechaHoraGenerado", "asc")
    .limit(25);

  const [citasSnap, turnosSnap] = await Promise.all([citasQ.get(), turnosQ.get()]);

  const citaDoc = !citasSnap.empty ? citasSnap.docs.find(isAllowed) : null;
  if (citaDoc) return { type: "citas", doc: citaDoc };

  const turnoDoc = !turnosSnap.empty ? turnosSnap.docs.find(isAllowed) : null;
  if (turnoDoc) return { type: "turnos", doc: turnoDoc };

  return null;
}
exports.agentCallNext = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");

    const uSnap = await db.collection("usuarios").doc(auth.uid).get();
    const u = uSnap.exists ? (uSnap.data() || {}) : null;
    const rol = u?.rol || u?.role || "user";

    if (!["admin", "agente"].includes(rol)) {
      throw new HttpsError("permission-denied", "No autorizado.");
    }

    await assertRateLimit({
      endpoint: "agentCallNext",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 30,
      windowMs: 60 * 1000,
      message: "Demasiados llamados consecutivos. Espere un momento e intente nuevamente.",
    });
let modulo = null;

// Para agente: el módulo sale del perfil (no se recibe del cliente).
// Para admin: se permite indicar el módulo a llamar.
if (rol === "agente") {
  const moduloAsignado = normalizeModuloServer(u?.moduloAsignado);
  if (!moduloAsignado) {
    throw new HttpsError("failed-precondition", "Este agente no tiene módulo asignado.");
  }
  modulo = moduloAsignado;
} else {
  const moduloReq = data?.modulo;
  modulo = normalizeModuloServer(moduloReq);
  if (!modulo) throw new HttpsError("invalid-argument", "Falta modulo.");
}
    const now = Timestamp.now();
    const dateISO = getChileDateISO(new Date());
    // Habilidades (tramites permitidos) para agentes
    let allowedTramites = null;
    if (rol === "agente") {
      const habs = Array.isArray(u?.habilidades) ? u.habilidades : [];
      const normalized = habs.map((x) => String(x || "").trim()).filter(Boolean);
      if (!normalized.length) {
        throw new HttpsError(
          "failed-precondition",
          "Este agente no tiene habilidades asignadas. Asigne trámites permitidos antes de llamar."
        );
      }
      allowedTramites = new Set(normalized);
    }


    // Evita doble llamado: si YA existe llamadaActual reciente, no llames otro
    const llamadaRef = db.collection("estadoSistema").doc("llamadaActual");
    const llamadaSnap = await llamadaRef.get();
    if (llamadaSnap.exists) {
      const d = llamadaSnap.data() || {};
      const ts = d.timestamp?.toMillis ? d.timestamp.toMillis() : 0;
      const ageMs = Date.now() - ts;

      // Anti doble-click: SOLO si el mismo agente llama demasiado rápido (1.5s)
      const sameAgent = d.agenteID && d.agenteID === auth.uid;
      if (sameAgent && d.codigoLlamado && ageMs >= 0 && ageMs < 1500) {
        return { called: false, message: "Acción muy rápida. Intenta nuevamente." };
      }
    }

    // Selecciona candidato
    const candidate = await pickNextCandidate({ nowTs: now, dateISO, allowedTramites });
    if (!candidate) return { called: false, message: "No hay pendientes para llamar." };

    const sourceCol = candidate.type; // "turnos" o "citas"
    const docSnap = candidate.doc;
    const ref = docSnap.ref;

    // Transacción: asegura que nadie lo tomó antes
    const result = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) throw new HttpsError("not-found", "El registro ya no existe.");

      const d = fresh.data() || {};
      const estado = String(d.estado || "");

      if (rol === "agente") {
        const tidCheck = String(d.tramiteID || d.tramiteId || "").trim();
        if (!allowedTramites || !tidCheck || !allowedTramites.has(tidCheck)) {
          return { called: false, message: "Este agente no tiene habilidad para este trámite." };
        }
      }

      if (sourceCol === "turnos" && estado !== "en-espera") {
        return { called: false, message: "Ese turno ya fue tomado por otro agente." };
      }
      if (sourceCol === "citas" && estado !== "activa") {
        return { called: false, message: "Esa cita ya fue tomada por otro agente." };
      }

      const codigo = String(d.codigo || d.codigoTurno || "");
      const tramiteID = String(d.tramiteID || "");
      // Marca como llamado (manteniendo compatibilidad con tu UI actual)
      if (sourceCol === "turnos") {
        tx.update(ref, {
          estado: "llamado",
          modulo: modulo,
          agenteID: auth.uid,
          llamadoAt: now,
        });
      } else {
        tx.update(ref, {
          estado: "llamado",
          moduloAsignado: modulo,
          agenteID: auth.uid,
          llamadoAt: now,
        });
      }

      // estadoSistema/llamadaActual para TV (MonitorScreen)
      tx.set(llamadaRef, {
        codigoLlamado: codigo,
        codigo, // fallback
        modulo: modulo,
        tipo: sourceCol === "turnos" ? "KIOSKO" : "WEB",
        tramiteID: tramiteID,
        estado: "llamado",
        timestamp: now,
        updatedAt: now,
        dni: FieldValue.delete(),
        userNombre: FieldValue.delete(),
        agenteID: FieldValue.delete(),
        sourceId: FieldValue.delete(),
        sourceCollection: FieldValue.delete(),
      }, { merge: true });

      // estadoSistema/tramite_{tramiteId} (panel lateral por trámite)
      if (tramiteID) {
        const tramiteEstadoRef = db.collection("estadoSistema").doc(`tramite_${tramiteID}`);
        tx.set(tramiteEstadoRef, {
          codigoLlamado: codigo,
          modulo: modulo,
          tramiteID: tramiteID,
          estado: "llamado",
          timestamp: now,
          updatedAt: now,
        }, { merge: true });
      }

      return {
        called: true,
        source: sourceCol,
        id: fresh.id,
        codigo,
        tramiteID,
        modulo
      };
    });

    if (result?.called) {
      await writeAuditLogSafe({
        action: "call_next",
        entityType: safeStr(result.source),
        entityId: safeStr(result.id),
        actorUid: auth.uid,
        actorRole: rol,
        source: "callable:agentCallNext",
        summary: `Se llamó ${safeStr(result.codigo)} para trámite ${safeStr(result.tramiteID)}.`,
        metadata: {
          tramiteID: safeStr(result.tramiteID),
          codigo: safeStr(result.codigo),
          modulo: result.modulo ?? null,
        },
      });
    }

    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("agentCallNext error:", err);
    throw new HttpsError("internal", "Error al llamar siguiente.");
  }
});

/* =========================
   OBJETIVO 10: ADMIN GESTIÓN DE AGENTES
   - Admin puede editar datos del agente en /usuarios/{uid}
   - Admin puede enviar enlace de recuperación de contraseña al correo del agente
   ========================= */

function pickAllowed(obj, allowedKeys) {
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

async function requireAdmin(uid) {
  const uSnap = await db.collection("usuarios").doc(uid).get();
  const u = uSnap.exists ? (uSnap.data() || {}) : null;
  const rol = u?.rol || u?.role || "user";
  if (rol !== "admin") throw new HttpsError("permission-denied", "Solo admin.");
  return u;
}

exports.adminExportAuditRecords = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");
    await requireAdmin(auth.uid);

    await assertRateLimit({
      endpoint: "adminExportAuditRecords",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 6,
      windowMs: 10 * 60 * 1000,
      message: "Demasiados exportes de auditoria. Intente nuevamente en unos minutos.",
    });

    let exportInput;
    try {
      exportInput = normalizeAuditExportInput(data || {}, new Date());
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message || "Parametros de export no validos.");
    }

    const { collectionName, policy, startDateISO, endDateISO, rangeDays, limit } = exportInput;
    const { start, end } = buildLocalRange(startDateISO, endDateISO);

    const snapshot = await db
      .collection(collectionName)
      .where(policy.dateField, ">=", start)
      .where(policy.dateField, "<=", end)
      .orderBy(policy.dateField, "desc")
      .limit(limit)
      .get();

    const records = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...serializeAuditValue(docSnap.data() || {}),
    }));

    await writeAuditLogSafe({
      action: "export_audit_records",
      entityType: collectionName,
      entityId: `${collectionName}_${startDateISO}_${endDateISO}`,
      actorUid: auth.uid,
      actorRole: "admin",
      source: "callable:adminExportAuditRecords",
      summary: `Export de ${snapshot.size} registro(s) desde ${collectionName}.`,
      metadata: {
        collectionName,
        startDateISO,
        endDateISO,
        rangeDays,
        limit,
        returnedCount: snapshot.size,
        truncated: snapshot.size === limit,
        policyName: policy.policyName,
      },
    });

    return {
      ok: true,
      collectionName,
      startDateISO,
      endDateISO,
      rangeDays,
      count: snapshot.size,
      limit,
      truncated: snapshot.size === limit,
      fileName: `${collectionName}_${startDateISO}_${endDateISO}.json`,
      policy: {
        policyName: policy.policyName,
        retentionDays: policy.retentionDays,
        exportScope: policy.exportScope,
        exportFormats: policy.exportFormats,
        autoCleanup: policy.autoCleanup,
      },
      records,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("adminExportAuditRecords error:", error);
    throw new HttpsError("internal", "Error al exportar auditoria.");
  }
});

// LEGACY / compatibilidad:
// El frontend actual usa `adminUpdateAgente`.
// Mantener este callable mientras no se confirme que no hay consumidores externos.
exports.adminUpdateAgent = onCall({ region: SANTIAGO_REGION, enforceAppCheck: true }, async (request) => {
  try {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");
    await requireAdmin(auth.uid);

    await assertRateLimit({
      endpoint: "adminUpdateAgent",
      scope: "uid",
      keyParts: [auth.uid],
      limit: 12,
      windowMs: 10 * 60 * 1000,
      message: "Demasiadas actualizaciones de agentes. Intente nuevamente en unos minutos.",
    });

    const agentUid = String(data?.agentUid || "").trim();
    if (!agentUid) throw new HttpsError("invalid-argument", "Falta agentUid.");

    // Campos permitidos a editar (Firestore)
    const allowed = [
      "nombre",
      "email",
      "dni",
      "rol",
      "moduloAsignado",
      "activo",
    ];

    const patch = pickAllowed(data || {}, allowed);

    // Validaciones mínimas
    if (patch.rol && !["admin", "agente", "pantalla"].includes(String(patch.rol))) {
      throw new HttpsError("invalid-argument", "Rol inválido.");
    }

    if (patch.email) patch.email = String(patch.email).trim().toLowerCase();
    if (patch.nombre) patch.nombre = String(patch.nombre).trim();
    if (patch.dni) patch.dni = String(patch.dni).trim();
    if (patch.moduloAsignado !== undefined) {
      patch.moduloAsignado = String(patch.moduloAsignado).trim(); // puede ser "AP" o "1"
    }
    if (patch.activo !== undefined) patch.activo = !!patch.activo;

    // 1) Update Firestore
    const ref = db.collection("usuarios").doc(agentUid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Agente no existe en usuarios.");

    await ref.set(
      {
        ...patch,
        updatedAt: Timestamp.now(),
        updatedBy: auth.uid,
      },
      { merge: true }
    );

    // 2) (Opcional) Si cambiaron el email, reflejarlo también en Firebase Auth
    if (patch.email) {
      try {
        await getAuth().updateUser(agentUid, { email: patch.email });
      } catch (e) {
        console.error("Auth updateUser(email) failed:", e);
        // No rompemos: Firestore queda actualizado, pero notificamos
        return { ok: true, warning: "Actualizado en Firestore, pero no se pudo actualizar email en Auth." };
      }
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("adminUpdateAgent error:", err);
    throw new HttpsError("internal", "Error al actualizar agente.");
  }
});

exports.adminSendPasswordReset = onCall(
  {
    region: SANTIAGO_REGION,
    enforceAppCheck: true,
    secrets: [SMTP_USER, SMTP_PASS, MAIL_FROM, APP_PUBLIC_URL],
  },
  async (request) => {
    try {
      const { auth, data } = request;
      if (!auth) throw new HttpsError("unauthenticated", "No autenticado.");
      await requireAdmin(auth.uid);

      await assertRateLimit({
        endpoint: "adminSendPasswordReset",
        scope: "uid",
        keyParts: [auth.uid],
        limit: 6,
        windowMs: 10 * 60 * 1000,
        message: "Demasiados envios de recuperacion de contrasena. Intente nuevamente en unos minutos.",
      });

      const agentUid = String(data?.agentUid || "").trim();
      if (!agentUid) throw new HttpsError("invalid-argument", "Falta agentUid.");

      // Tomamos el email del usuario (preferimos Auth, fallback Firestore)
      let email = "";
      try {
        const userAuth = await getAuth().getUser(agentUid);
        email = String(userAuth.email || "").trim().toLowerCase();
      } catch (e) {
        console.error("getUser failed:", e);
      }

      if (!email) {
        const snap = await db.collection("usuarios").doc(agentUid).get();
        const u = snap.exists ? (snap.data() || {}) : null;
        email = String(u?.email || "").trim().toLowerCase();
      }

      if (!email) throw new HttpsError("failed-precondition", "El agente no tiene email registrado.");

      const baseUrl = (APP_PUBLIC_URL.value() || "").replace(/\/+$/, "");
      const continueUrl = `${baseUrl}/login`;

      const resetLink = await getAuth().generatePasswordResetLink(email, { url: continueUrl });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
      });

      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
          <h2 style="margin:0 0 12px;">Restablecimiento de contraseña</h2>
          <p style="margin:0 0 12px;">
            Se solicitó un restablecimiento de contraseña para su cuenta del Sistema de Citas.
          </p>
          <p style="margin:0 0 12px;">
            Haga clic en el siguiente enlace para crear una nueva contraseña:
          </p>
          <p style="margin:0 0 12px;">
            <a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a>
          </p>
          <p style="margin:0; color:#666; font-size:12px;">
            Si usted no solicitó esto, puede ignorar este correo.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: MAIL_FROM.value(),
        to: email,
        subject: "Restablecer contraseña - Sistema de Citas",
        html,
      });

      return { ok: true, sentTo: email };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("adminSendPasswordReset error:", err);
      throw new HttpsError("internal", "Error al enviar recuperación de contraseña.");
    }
  }
);
