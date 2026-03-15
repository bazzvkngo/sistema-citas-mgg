import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../context/AuthContext";

const createArcoRequest = httpsCallable(functions, "createArcoRequest");

const styles = {
  page: {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "24px 16px 40px",
    color: "#10233d",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(320px, 0.8fr)",
    gap: "18px",
    alignItems: "start",
  },
  card: {
    borderRadius: "24px",
    padding: "24px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,249,252,0.98) 100%)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 18px 38px rgba(15, 23, 42, 0.08)",
  },
  eyebrow: {
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#c8102e",
  },
  title: {
    margin: "8px 0 10px",
    fontSize: "32px",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: "0 0 18px",
    color: "#41536b",
    lineHeight: 1.6,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 900,
  },
  sectionBody: {
    margin: 0,
    lineHeight: 1.7,
    color: "#334155",
  },
  list: {
    margin: "0 0 0 18px",
    padding: 0,
    color: "#334155",
    lineHeight: 1.7,
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  row: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#10233d",
  },
  input: {
    width: "100%",
    minHeight: "46px",
    padding: "11px 13px",
    borderRadius: "14px",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    boxSizing: "border-box",
    outline: "none",
    fontSize: "14px",
    color: "#10233d",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    minHeight: "130px",
    padding: "12px 13px",
    borderRadius: "14px",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    boxSizing: "border-box",
    outline: "none",
    fontSize: "14px",
    color: "#10233d",
    resize: "vertical",
    background: "#fff",
  },
  consentBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    background: "#f8fafc",
  },
  button: {
    minHeight: "48px",
    padding: "12px 18px",
    borderRadius: "14px",
    border: "none",
    background: "#c8102e",
    color: "#fff",
    fontWeight: 900,
    fontSize: "14px",
    cursor: "pointer",
  },
  alertSuccess: {
    borderRadius: "16px",
    padding: "14px 16px",
    background: "#ecfdf3",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 700,
  },
  alertError: {
    borderRadius: "16px",
    padding: "14px 16px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: 700,
  },
  small: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#475569",
  },
  link: {
    color: "#c8102e",
    fontWeight: 800,
  },
};

function buildInitialForm(user) {
  return {
    type: "acceso",
    requesterName: user?.nombre || user?.displayName || "",
    requesterEmail: user?.email || "",
    requesterDocument: user?.dni || "",
    details: "",
    privacyAccepted: false,
  };
}

function getCallableErrorMessage(error, fallback) {
  const raw = error?.details || error?.message || "";
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  return cleaned || fallback;
}

export default function ArcoRequests() {
  const { currentUser } = useAuth();
  const [form, setForm] = useState(() => buildInitialForm(currentUser));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      requesterName: prev.requesterName || currentUser?.nombre || currentUser?.displayName || "",
      requesterEmail: prev.requesterEmail || currentUser?.email || "",
      requesterDocument: prev.requesterDocument || currentUser?.dni || "",
    }));
  }, [currentUser]);

  const canSubmit = useMemo(() => {
    return (
      !!form.type &&
      !!form.requesterName.trim() &&
      !!form.requesterEmail.trim() &&
      !!form.requesterDocument.trim() &&
      !!form.details.trim() &&
      form.privacyAccepted &&
      !loading
    );
  }, [form, loading]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await createArcoRequest({
        type: form.type,
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        requesterDocument: form.requesterDocument,
        details: form.details,
        privacyAccepted: form.privacyAccepted,
      });

      setSuccess(
        "Tu solicitud fue registrada correctamente. El equipo revisará el caso y responderá por los canales internos definidos."
      );
      setForm(buildInitialForm(currentUser));
    } catch (err) {
      console.error("Error al registrar solicitud ARCO:", err);
      setError(getCallableErrorMessage(err, "No se pudo registrar la solicitud. Intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.eyebrow}>Privacidad</div>
          <h1 style={styles.title}>Derechos ARCO</h1>
          <p style={styles.subtitle}>
            Puedes usar este canal para solicitar acceso, rectificación, cancelación u oposición
            respecto del tratamiento de tus datos personales en el sistema.
          </p>

          <section style={{ marginBottom: "16px" }}>
            <h2 style={styles.sectionTitle}>¿Qué puedes solicitar?</h2>
            <ul style={styles.list}>
              <li>Acceso a la información personal registrada.</li>
              <li>Rectificación de datos incorrectos o incompletos.</li>
              <li>Cancelación cuando corresponda según la normativa aplicable.</li>
              <li>Oposición al tratamiento en casos permitidos.</li>
            </ul>
          </section>

          <section>
            <h2 style={styles.sectionTitle}>Antes de enviar</h2>
            <p style={styles.sectionBody}>
              Describe tu solicitud con la mayor claridad posible. Si necesitas revisar antes el
              tratamiento de tus datos, puedes consultar la{" "}
              <a href="/privacidad" style={styles.link}>
                política de privacidad
              </a>.
            </p>
          </section>
        </div>

        <div style={styles.card}>
          <div style={styles.eyebrow}>Formulario</div>
          <h2 style={{ ...styles.title, fontSize: "28px" }}>Ingresar solicitud</h2>

          {success ? <div style={styles.alertSuccess}>{success}</div> : null}
          {error ? <div style={{ ...styles.alertError, marginTop: success ? "12px" : 0 }}>{error}</div> : null}

          <form style={{ ...styles.form, marginTop: "16px" }} onSubmit={handleSubmit}>
            <div style={styles.row}>
              <label style={styles.label} htmlFor="arco-type">
                Tipo de solicitud
              </label>
              <select
                id="arco-type"
                style={styles.input}
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
              >
                <option value="acceso">Acceso</option>
                <option value="rectificacion">Rectificación</option>
                <option value="cancelacion">Cancelación</option>
                <option value="oposicion">Oposición</option>
              </select>
            </div>

            <div style={styles.row}>
              <label style={styles.label} htmlFor="arco-name">
                Nombre completo
              </label>
              <input
                id="arco-name"
                style={styles.input}
                value={form.requesterName}
                onChange={(e) => updateField("requesterName", e.target.value)}
                placeholder="Nombre y apellidos"
              />
            </div>

            <div style={styles.row}>
              <label style={styles.label} htmlFor="arco-email">
                Correo electrónico
              </label>
              <input
                id="arco-email"
                type="email"
                style={styles.input}
                value={form.requesterEmail}
                onChange={(e) => updateField("requesterEmail", e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div style={styles.row}>
              <label style={styles.label} htmlFor="arco-document">
                Documento
              </label>
              <input
                id="arco-document"
                style={styles.input}
                value={form.requesterDocument}
                onChange={(e) => updateField("requesterDocument", e.target.value)}
                placeholder="Documento de identidad"
              />
            </div>

            <div style={styles.row}>
              <label style={styles.label} htmlFor="arco-details">
                Detalle de la solicitud
              </label>
              <textarea
                id="arco-details"
                style={styles.textarea}
                value={form.details}
                onChange={(e) => updateField("details", e.target.value)}
                placeholder="Explica qué dato deseas revisar, corregir, cancelar u objetar."
              />
            </div>

            <label style={styles.consentBox} htmlFor="arco-privacy">
              <input
                id="arco-privacy"
                type="checkbox"
                checked={form.privacyAccepted}
                onChange={(e) => updateField("privacyAccepted", e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <span style={styles.small}>
                Acepto el tratamiento de estos datos para gestionar mi solicitud ARCO y las
                comunicaciones asociadas. Puedes revisar la{" "}
                <a href="/privacidad" style={styles.link}>
                  política de privacidad
                </a>.
              </span>
            </label>

            <button type="submit" style={{ ...styles.button, opacity: canSubmit ? 1 : 0.7 }} disabled={!canSubmit}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
