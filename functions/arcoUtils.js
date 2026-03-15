const ARCO_TYPES = ["acceso", "rectificacion", "cancelacion", "oposicion"];
const ARCO_STATUSES = ["pendiente", "en_revision", "resuelta", "rechazada"];

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeEmailServer(raw) {
  return safeStr(raw).trim().toLowerCase();
}

function isValidEmailServer(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeStr(email));
}

function normalizeSingleLineTextServer(raw, maxLen = 160) {
  return safeStr(raw).replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeMultilineTextServer(raw, maxLen = 4000) {
  return safeStr(raw).replace(/\r\n/g, "\n").trim().slice(0, maxLen);
}

function normalizeArcoTypeServer(raw) {
  const value = safeStr(raw).trim().toLowerCase();
  return ARCO_TYPES.includes(value) ? value : "";
}

function normalizeArcoStatusServer(raw) {
  const value = safeStr(raw).trim().toLowerCase();
  return ARCO_STATUSES.includes(value) ? value : "";
}

function isArcoFinalStatus(status) {
  return ["resuelta", "rechazada"].includes(normalizeArcoStatusServer(status));
}

function normalizeRequesterDocumentServer(raw) {
  return safeStr(raw).trim().toUpperCase().replace(/\s+/g, " ").slice(0, 40);
}

function isValidRequesterDocumentServer(value) {
  return /^[A-Z0-9.\- ]{6,40}$/.test(safeStr(value));
}

module.exports = {
  ARCO_TYPES,
  ARCO_STATUSES,
  normalizeEmailServer,
  isValidEmailServer,
  normalizeSingleLineTextServer,
  normalizeMultilineTextServer,
  normalizeArcoTypeServer,
  normalizeArcoStatusServer,
  isArcoFinalStatus,
  normalizeRequesterDocumentServer,
  isValidRequesterDocumentServer,
};
