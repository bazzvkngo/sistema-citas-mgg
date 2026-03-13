export function normalizeCitizenDoc(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

export function splitCitizenFullName(full) {
  const text = String(full || "").trim();
  if (!text) return { nombres: "", apellidos: "" };

  const parts = text.split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };

  return {
    nombres: parts.slice(0, -1).join(" "),
    apellidos: parts.slice(-1).join(" "),
  };
}

export function buildCitizenFullName({ nombres = "", apellidos = "", nombreCompleto = "" }) {
  const full = String(nombreCompleto || "").trim();
  if (full) return full;

  const firstNames = String(nombres || "").trim();
  const lastNames = String(apellidos || "").trim();
  return [firstNames, lastNames].filter(Boolean).join(" ").trim();
}

export function mapCitizenDocToForm(docNorm, data = {}) {
  return {
    docIdInput: String(data.docDisplay || docNorm || "").trim(),
    tipoDoc: String(data.tipoDoc || "DNI").trim(),
    nombres: String(data.nombres || "").trim(),
    apellidos: String(data.apellidos || "").trim(),
    nombreCompleto: String(data.nombreCompleto || "").trim(),
    telefono: String(data.telefono || "").trim(),
    email: String(data.email || "").trim(),
    exists: true,
    source: "ciudadanos",
  };
}

export function mapUserBootstrapToForm(docNorm, data = {}) {
  const fullName = String(data.nombreCompleto || data.nombre || "").trim();
  const parts = splitCitizenFullName(fullName);

  return {
    docIdInput: String(docNorm || "").trim(),
    tipoDoc: String(data.tipoDoc || "DNI").trim(),
    nombres: String(data.nombres || parts.nombres || "").trim(),
    apellidos: String(data.apellidos || parts.apellidos || "").trim(),
    nombreCompleto: fullName,
    telefono: String(data.telefono || "").trim(),
    email: String(data.email || "").trim(),
    exists: false,
    source: "usuarios",
  };
}

export function buildCitizenPayload({
  docNorm,
  docDisplay,
  tipoDoc,
  nombres,
  apellidos,
  nombreCompleto,
  telefono,
  email,
}) {
  const normalizedDoc = normalizeCitizenDoc(docNorm);
  const fullName = buildCitizenFullName({ nombres, apellidos, nombreCompleto });

  return {
    docNorm: normalizedDoc,
    docDisplay: String(docDisplay || normalizedDoc || "").trim(),
    // Compatibilidad temporal con registros/consultas legacy
    dni: normalizedDoc,
    tipoDoc: String(tipoDoc || "DNI").trim(),
    nombres: String(nombres || "").trim(),
    apellidos: String(apellidos || "").trim(),
    nombreCompleto: String(fullName || "").trim(),
    telefono: String(telefono || "").trim(),
    email: String(email || "").trim(),
  };
}
