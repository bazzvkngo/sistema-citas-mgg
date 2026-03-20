import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

const adminResetDemoData = httpsCallable(functions, "adminResetDemoData");
const CONFIRMATION_TEXT = "ELIMINAR TODO";
const DEFAULT_SCOPE = "operational_demo";

const styles = {
  wrap: { padding: 10, maxWidth: 840 },
  title: { margin: "0 0 12px", fontSize: 18, fontWeight: 900 },
  subtitle: { margin: "0 0 16px", color: "#555", lineHeight: 1.6 },
  warning: {
    marginBottom: 16,
    padding: "14px 16px",
    borderRadius: 12,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  infoCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  },
  sectionTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 900, color: "#111827" },
  list: { margin: 0, paddingLeft: 18, color: "#374151", lineHeight: 1.7 },
  label: { display: "block", marginBottom: 8, fontSize: 13, fontWeight: 900, color: "#111827" },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  },
  btn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    background: "#991b1b",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  error: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: 700,
  },
  success: {
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#ecfdf3",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  code: {
    fontFamily: "Consolas, monospace",
    fontSize: 13,
    background: "#111827",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 6,
  },
};

function getCallableErrorMessage(error, fallback) {
  const raw = error?.details || error?.message || "";
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  return cleaned || fallback;
}

export default function AdminDemoReset() {
  const [confirmationText, setConfirmationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const isConfirmationValid = confirmationText.trim() === CONFIRMATION_TEXT;

  const handleSubmit = async () => {
    if (!isConfirmationValid || submitting) return;

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await adminResetDemoData({
        scope: DEFAULT_SCOPE,
        confirmationText: confirmationText.trim(),
      });
      setResult(response?.data || null);
      setConfirmationText("");
    } catch (err) {
      console.error("Error al limpiar demo:", err);
      setError(getCallableErrorMessage(err, "No se pudo limpiar la demo."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>Limpieza Segura de Demo</h3>
      <p style={styles.subtitle}>
        Esta acción elimina solo datos operativos de la demo. No borra usuarios, roles, trámites ni
        configuraciones base.
      </p>

      <div style={styles.warning}>
        Acción restringida a superadmin. El modo activo es limpieza operativa segura. El wipe total
        permanece deshabilitado en backend hasta que se habilite explícitamente.
      </div>

      <div style={styles.infoCard}>
        <div style={styles.sectionTitle}>Colecciones afectadas por defecto</div>
        <ul style={styles.list}>
          <li>citas</li>
          <li>turnos</li>
          <li>trackingPublic</li>
          <li>slotLocks</li>
          <li>kioskTurnoLocks</li>
          <li>contadores</li>
          <li>contadoresWeb</li>
          <li>estadoSistema/llamadaActual</li>
          <li>estadoSistema/tramite_*</li>
        </ul>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <label style={styles.label} htmlFor="demo-reset-confirmation">
        Escriba <span style={styles.code}>{CONFIRMATION_TEXT}</span> para confirmar
      </label>
      <input
        id="demo-reset-confirmation"
        style={styles.input}
        value={confirmationText}
        onChange={(event) => setConfirmationText(event.target.value)}
        placeholder={CONFIRMATION_TEXT}
        autoComplete="off"
      />

      <button
        type="button"
        style={{
          ...styles.btn,
          ...((!isConfirmationValid || submitting) ? styles.btnDisabled : {}),
        }}
        disabled={!isConfirmationValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Limpiando..." : "Ejecutar limpieza operativa"}
      </button>

      {result ? (
        <div style={styles.success}>
          Limpieza completada. Total eliminado: {result.totalDeleted || 0}. Alcance: {result.scope}.
        </div>
      ) : null}
    </div>
  );
}
