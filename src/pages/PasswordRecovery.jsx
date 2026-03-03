// src/pages/PasswordRecovery.jsx
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";

// ✅ Fondo consulado (mismo que Login/Registro)
import bgConsulado from "../assets/bg-consulado.png";

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    // 👇 para no pelear con el navbar
    minHeight: "calc(100vh - 72px)",
    padding: "28px 16px",

    backgroundImage: `linear-gradient(rgba(11,18,32,0.68), rgba(11,18,32,0.68)), url(${bgConsulado})`,
    backgroundSize: "cover",
    backgroundPosition: "center 35%",
    backgroundRepeat: "no-repeat",
  },

  formCard: {
    width: "100%",
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",

    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: "16px",
    padding: "26px 24px",
    boxShadow: "0 18px 55px rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.55)",
    backdropFilter: "blur(6px)",
  },

  headerBlock: {
    textAlign: "center",
    marginBottom: "2px",
  },
  title: {
    color: "#111827",
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    fontSize: "13px",
    color: "#6B7280",
    fontWeight: 600,
    lineHeight: 1.45,
  },

  inputGroup: {
    position: "relative",
    marginBottom: "2px",
  },
  label: {
    fontSize: "14px",
    color: "#243447",
    marginBottom: "6px",
    display: "block",
    fontWeight: 700,
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #D1D5DB",
    borderRadius: "12px",
    padding: "0 15px",
    backgroundColor: "#F9FAFB",
    height: "50px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
  },
  input: {
    border: "none",
    outline: "none",
    flex: 1,
    width: "100%",
    fontSize: "16px",
    color: "#111827",
    backgroundColor: "transparent",
    height: "100%",
  },

  submitButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#E5E7EB",
    color: "#4B5563",
    border: "1px solid #D1D5DB",
    borderRadius: "25px",
    fontSize: "18px",
    fontWeight: 900,
    cursor: "not-allowed",
    marginTop: "6px",
    transition: "all 0.25s",
  },
  submitButtonActive: {
    backgroundColor: "#C8102E",
    border: "1px solid #C8102E",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(200,16,46,0.35)",
  },

  errorText: {
    color: "#DC2626",
    fontSize: "12px",
    marginTop: "6px",
    marginLeft: "5px",
    fontWeight: 700,
  },

  // ✅ Mensaje éxito sobrio
  successBox: {
    border: "1px solid rgba(16,185,129,0.35)",
    background: "rgba(16,185,129,0.08)",
    color: "#065F46",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 800,
    fontSize: "13px",
    lineHeight: 1.4,
  },

  footer: {
    textAlign: "center",
    marginTop: "10px",
    fontSize: "14px",
    color: "#4B5563",
    fontWeight: 600,
  },

  // ✅ Camino alternativo: gris (no rojo)
  backLink: {
    color: "#374151",
    textDecoration: "none",
    fontWeight: 900,
  },
  backArrow: {
    marginRight: 6,
    fontWeight: 900,
  },
};

export default function PasswordRecovery() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm({ mode: "onChange" });

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const emailValue = watch("email");

  useEffect(() => {
    if (serverError) setServerError("");
    if (successMsg) setSuccessMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailValue]);

  const onSubmit = async ({ email }) => {
    setLoading(true);
    setServerError("");
    setSuccessMsg("");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg(
        "Listo. Si el correo existe, te llegará un enlace para restablecer tu contraseña. Revisa bandeja principal y spam."
      );
    } catch (error) {
      console.error("Password reset error:", error);

      // Mensajes sobrios (no revelar demasiado)
      if (error.code === "auth/invalid-email") {
        setServerError("El correo no es válido.");
      } else if (error.code === "auth/too-many-requests") {
        setServerError("Demasiados intentos. Intenta más tarde.");
      } else {
        setServerError("No se pudo enviar el enlace. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>
        <div style={styles.headerBlock}>
          <h2 style={styles.title}>Recuperar contraseña</h2>
          <p style={styles.subtitle}>
            Ingresa tu correo electrónico y te enviaremos un enlace para
            restablecer tu contraseña.
          </p>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Correo electrónico</label>
          <div style={styles.inputContainer}>
            <input
              type="email"
              style={styles.input}
              placeholder="ejemplo@correo.com"
              {...register("email", {
                required: "El correo es obligatorio",
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: "Formato de correo inválido",
                },
              })}
            />
          </div>
          {errors.email && <p style={styles.errorText}>{errors.email.message}</p>}
        </div>

        {successMsg ? <div style={styles.successBox}>{successMsg}</div> : null}

        {serverError && !errors.email ? (
          <p style={{ ...styles.errorText, textAlign: "center", fontSize: "14px" }}>
            {serverError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            ...styles.submitButton,
            ...(isValid && !loading ? styles.submitButtonActive : {}),
          }}
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>

        <div style={styles.footer}>
          <Link to="/ingreso" style={styles.backLink}>
            <span style={styles.backArrow}>←</span>
            Volver a iniciar sesión
          </Link>
        </div>
      </form>
    </div>
  );
}