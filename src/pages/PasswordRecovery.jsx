// src/pages/PasswordRecovery.jsx
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";

// --- ESTILOS (coherentes con el resto del sistema) ---
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "20px",
  },
  formCard: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "26px 24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "10px",
    fontSize: "24px",
    fontWeight: "bold",
  },
  text: {
    textAlign: "center",
    color: "#666",
    fontSize: "14px",
    marginBottom: "10px",
    lineHeight: "1.5",
  },
  inputGroup: {
    position: "relative",
    marginBottom: "5px",
  },
  label: {
    fontSize: "14px",
    color: "#555",
    marginBottom: "5px",
    display: "block",
    fontWeight: "500",
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #ccc",
    borderRadius: "12px",
    padding: "0 15px",
    backgroundColor: "white",
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
    color: "#333",
    backgroundColor: "transparent",
    height: "100%",
  },
  submitButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#e4e6eb",
    color: "#888",
    border: "none",
    borderRadius: "25px",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "not-allowed",
    marginTop: "10px",
    transition: "all 0.3s",
    textAlign: "center",
  },
  submitButtonActive: {
    backgroundColor: "#007bff",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0, 123, 255, 0.3)",
  },
  errorText: {
    color: "red",
    fontSize: "12px",
    marginTop: "4px",
    marginLeft: "5px",
  },
  // Tarjeta de éxito tipo la del pantallazo
  successCard: {
    backgroundColor: "#f1f8e9",
    borderRadius: "16px",
    padding: "24px 20px",
    border: "1px solid #c5e1a5",
  },
  successTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  successIcon: {
    fontSize: "20px",
  },
  successTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#c62828", // rojo título "Correo Enviado"
  },
  successText: {
    fontSize: "14px",
    color: "#33691e",
    textAlign: "center",
    marginTop: "10px",
    lineHeight: "1.5",
  },
  divider: {
    marginTop: "8px",
    marginBottom: "8px",
    border: "none",
    borderTop: "1px solid rgba(0,0,0,0.06)",
  },
  footerText: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "14px",
    color: "#555",
  },
  linkPrimary: {
    color: "#bda700",
    textDecoration: "none",
    fontWeight: "bold",
  },
  backLink: {
    textAlign: "center",
    marginTop: "12px",
    fontSize: "14px",
    color: "#bda700",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

export default function PasswordRecovery() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({ mode: "onChange" });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");   // éxito
  const [errorMsg, setErrorMsg] = useState(""); // error visible

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, data.email.trim());
      // Si no lanza error → mostramos éxito
      setMessage(
        "¡Listo! Hemos enviado un enlace de recuperación a tu correo."
      );
    } catch (error) {
      console.error("Error al enviar correo de recuperación:", error);

      // Códigos típicos de Firebase
      if (error.code === "auth/user-not-found") {
        setErrorMsg("No existe una cuenta registrada con este correo.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("El formato del correo no es válido.");
      } else {
        setErrorMsg("Ocurrió un error al enviar el correo. Inténtalo más tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 📩 Vista de éxito (como en tu captura)
  if (message) {
    return (
      <div style={styles.container}>
        <div style={styles.formCard}>
          <div style={styles.successCard}>
            <div style={styles.successTitleRow}>
              <span style={styles.successIcon}>✅</span>
              <span style={styles.successTitle}>Correo Enviado</span>
            </div>

            <hr style={styles.divider} />

            <p style={styles.successText}>{message}</p>
          </div>

          <div style={styles.footerText}>
            <Link to="/ingreso" style={styles.backLink}>
              Volver a Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 📝 Vista del formulario
  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>
        <h2 style={styles.title}>Recuperar Contraseña</h2>
        <p style={styles.text}>
          Ingresa tu correo electrónico y te enviaremos un enlace para que
          puedas restablecer tu contraseña.
        </p>

        {/* Email */}
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
                  message: "Correo inválido",
                },
              })}
            />
          </div>
          {errors.email && (
            <p style={styles.errorText}>{errors.email.message}</p>
          )}
        </div>

        {/* Mensaje de error general */}
        {errorMsg && (
          <p
            style={{
              ...styles.errorText,
              textAlign: "center",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {errorMsg}
          </p>
        )}

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

        <div style={styles.footerText}>
          <Link to="/ingreso" style={styles.linkPrimary}>
            ← Volver a Iniciar Sesión
          </Link>
        </div>
      </form>
    </div>
  );
}
