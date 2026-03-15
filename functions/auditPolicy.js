const { Timestamp } = require("firebase-admin/firestore");

const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIT_LOG_RETENTION_DAYS = 180;
const SERVICE_AUDIT_RETENTION_DAYS = 365;
const AUDIT_EXPORT_DEFAULT_LIMIT = 200;
const AUDIT_EXPORT_MAX_LIMIT = 1000;
const AUDIT_EXPORT_MAX_RANGE_DAYS = 31;
const AUDIT_EXPORT_FORMATS = ["json"];

const AUDIT_COLLECTION_POLICIES = Object.freeze({
  auditLogs: Object.freeze({
    collectionName: "auditLogs",
    dateField: "timestamp",
    retentionDays: AUDIT_LOG_RETENTION_DAYS,
    exportScope: "admin",
    exportFormats: AUDIT_EXPORT_FORMATS,
    autoCleanup: true,
    policyName: "auditLogs_v1",
  }),
  serviceAudit: Object.freeze({
    collectionName: "serviceAudit",
    dateField: "fechaHoraAtencionFin",
    retentionDays: SERVICE_AUDIT_RETENTION_DAYS,
    exportScope: "admin",
    exportFormats: AUDIT_EXPORT_FORMATS,
    autoCleanup: false,
    policyName: "serviceAudit_v1",
  }),
});

function safeStr(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function addDaysToTimestamp(ts, days) {
  const base = typeof ts?.toMillis === "function" ? ts.toMillis() : Date.now();
  return Timestamp.fromMillis(base + days * DAY_MS);
}

function buildAuditLogRetentionFields(nowTs = Timestamp.now()) {
  return {
    retentionPolicy: AUDIT_COLLECTION_POLICIES.auditLogs.policyName,
    retentionDays: AUDIT_COLLECTION_POLICIES.auditLogs.retentionDays,
    purgeAfter: addDaysToTimestamp(nowTs, AUDIT_COLLECTION_POLICIES.auditLogs.retentionDays),
    exportable: true,
    exportScope: AUDIT_COLLECTION_POLICIES.auditLogs.exportScope,
    exportFormats: [...AUDIT_COLLECTION_POLICIES.auditLogs.exportFormats],
  };
}

function buildServiceAuditMetadata(nowTs = Timestamp.now()) {
  return {
    version: 1,
    createdAt: nowTs,
    createdBy: "CF_TRIGGER",
    retentionPolicy: AUDIT_COLLECTION_POLICIES.serviceAudit.policyName,
    retentionDays: AUDIT_COLLECTION_POLICIES.serviceAudit.retentionDays,
    retentionUntil: addDaysToTimestamp(nowTs, AUDIT_COLLECTION_POLICIES.serviceAudit.retentionDays),
    exportable: true,
    exportScope: AUDIT_COLLECTION_POLICIES.serviceAudit.exportScope,
    exportFormats: [...AUDIT_COLLECTION_POLICIES.serviceAudit.exportFormats],
  };
}

function getAuditCollectionPolicy(collectionName) {
  return AUDIT_COLLECTION_POLICIES[safeStr(collectionName).trim()] || null;
}

function isDateISO(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(safeStr(value).trim());
}

function parseDateOnly(dateISO) {
  if (!isDateISO(dateISO)) return null;
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDateISO(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function shiftDateISO(dateISO, days) {
  const base = parseDateOnly(dateISO);
  if (!base) return "";
  return formatDateISO(base.getTime() + days * DAY_MS);
}

function clampPositiveInt(rawValue, fallback, max) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeAuditExportInput(data = {}, now = new Date()) {
  const collectionName = safeStr(data.collectionName || data.collection).trim();
  const policy = getAuditCollectionPolicy(collectionName);
  if (!policy) {
    throw new Error("Coleccion de auditoria no soportada.");
  }

  const endDateISO = safeStr(data.endDateISO).trim() || formatDateISO(now);
  if (!isDateISO(endDateISO)) {
    throw new Error("endDateISO debe usar formato YYYY-MM-DD.");
  }

  const defaultWindowDays = Math.min(policy.retentionDays, AUDIT_EXPORT_MAX_RANGE_DAYS);
  const startDateISO =
    safeStr(data.startDateISO).trim() || shiftDateISO(endDateISO, -(defaultWindowDays - 1));

  if (!isDateISO(startDateISO)) {
    throw new Error("startDateISO debe usar formato YYYY-MM-DD.");
  }

  const startDate = parseDateOnly(startDateISO);
  const endDate = parseDateOnly(endDateISO);
  if (!startDate || !endDate) {
    throw new Error("Las fechas del export no son validas.");
  }

  const rangeDays = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  if (rangeDays < 1) {
    throw new Error("startDateISO no puede ser posterior a endDateISO.");
  }

  if (rangeDays > AUDIT_EXPORT_MAX_RANGE_DAYS) {
    throw new Error(`El rango maximo de export es de ${AUDIT_EXPORT_MAX_RANGE_DAYS} dias.`);
  }

  return {
    collectionName,
    policy,
    startDateISO,
    endDateISO,
    rangeDays,
    limit: clampPositiveInt(data.limit, AUDIT_EXPORT_DEFAULT_LIMIT, AUDIT_EXPORT_MAX_LIMIT),
  };
}

function serializeAuditValue(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => serializeAuditValue(item));
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = serializeAuditValue(nestedValue);
    }
    return output;
  }

  return value;
}

module.exports = {
  AUDIT_LOG_RETENTION_DAYS,
  SERVICE_AUDIT_RETENTION_DAYS,
  AUDIT_EXPORT_DEFAULT_LIMIT,
  AUDIT_EXPORT_MAX_LIMIT,
  AUDIT_EXPORT_MAX_RANGE_DAYS,
  buildAuditLogRetentionFields,
  buildServiceAuditMetadata,
  getAuditCollectionPolicy,
  normalizeAuditExportInput,
  serializeAuditValue,
};
