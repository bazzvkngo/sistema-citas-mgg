import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const confirmCitizenPendingEmailChange = httpsCallable(
  functions,
  "confirmCitizenPendingEmailChange"
);

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, rgba(200, 16, 46, 0.08), transparent 28%), linear-gradient(180deg, #f8f4ef 0%, #f4f6fa 100%)",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    borderRadius: "24px",
    padding: "28px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.1)",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#c8102e",
  },
  title: {
    margin: "12px 0 0",
    fontSize: "30px",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  body: {
    margin: "12px 0 0",
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#475569",
    fontWeight: 700,
  },
  statusBox: (tone) => ({
    marginTop: "18px",
    padding: "16px",
    borderRadius: "16px",
    border:
      tone === "success"
        ? "1px solid rgba(22, 163, 74, 0.2)"
        : tone === "warning"
          ? "1px solid rgba(245, 158, 11, 0.24)"
          : tone === "loading"
            ? "1px solid rgba(59, 130, 246, 0.18)"
          : "1px solid rgba(239, 68, 68, 0.18)",
    background:
      tone === "success"
        ? "#ecfdf5"
        : tone === "warning"
          ? "#fffaf0"
          : tone === "loading"
            ? "#eff6ff"
          : "#fff1f2",
    color:
      tone === "success"
        ? "#166534"
        : tone === "warning"
          ? "#92400e"
          : tone === "loading"
            ? "#1d4ed8"
          : "#9f1239",
    fontWeight: 800,
    lineHeight: 1.5,
  }),
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "20px",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: "13px",
  },
  buttonGhost: {
    background: "#f8fafc",
    color: "#0f172a",
  },
};

function getErrorMessage(error) {
  const detailsMessage = error?.details?.message;
  const rawMessage = error?.message;
  if (detailsMessage) return String(detailsMessage).replace(/^functions\//, "");
  if (rawMessage) return String(rawMessage).replace(/^functions\//, "");
  return "No se pudo confirmar el cambio de correo.";
}

export default function ConfirmCitizenEmailChange() {
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("t") || "").trim();
  const [state, setState] = useState({
    status: "loading",
    message: "Estamos validando el enlace de confirmacion.",
  });
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;

    if (!token) {
      setState({
        status: "error",
        message: "El enlace de confirmacion no es valido.",
      });
      return;
    }

    let cancelled = false;

    async function confirmEmailChange() {
      try {
        const result = await confirmCitizenPendingEmailChange({ token });
        if (cancelled) return;

        const payload = result?.data || {};
        setState({
          status: payload?.alreadyConfirmed ? "warning" : "success",
          message: String(
            payload?.message ||
              (payload?.alreadyConfirmed
                ? "El cambio de correo ya habia sido confirmado."
                : "El nuevo correo fue confirmado correctamente.")
          ),
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: getErrorMessage(error),
        });
      }
    }

    confirmEmailChange();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const tone =
    state.status === "success"
      ? "success"
      : state.status === "warning"
        ? "warning"
        : state.status === "loading"
          ? "loading"
          : "error";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Sistema de Citas</p>
        <h1 style={styles.title}>Confirmacion de cambio de correo</h1>
        <p style={styles.body}>
          Esta pagina confirma el nuevo correo asociado a una cuenta ciudadana cuando el cambio fue
          solicitado desde ventanilla por personal autorizado.
        </p>

        <div style={styles.statusBox(tone)}>{state.message}</div>

        <div style={styles.actions}>
          <Link to="/ingreso" style={styles.button}>
            Ir a ingreso
          </Link>
          <Link to="/" style={{ ...styles.button, ...styles.buttonGhost }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
