// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ✅ Fondo consulado
import bgConsulado from "../assets/bg-consulado.png";

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    // Ajuste por navbar (si tu navbar es más alto, cambia 72px -> 80px)
    minHeight: "calc(100vh - 72px)",
    padding: "28px 16px",

    // ✅ Más sobrio: overlay más fuerte para que el fondo no compita
    backgroundImage: `linear-gradient(rgba(11,18,32,0.68), rgba(11,18,32,0.68)), url(${bgConsulado})`,
    backgroundSize: "cover",
    backgroundPosition: "center 35%",
    backgroundRepeat: "no-repeat",
  },

  formCard: {
    width: "100%",
    maxWidth: "460px", // ✅ un poco más compacto
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
    marginBottom: "6px",
  },
  title: {
    color: "#111827",
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "13px",
    color: "#6B7280",
    fontWeight: 600,
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
  iconButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9CA3AF",
    padding: 0,
    display: "flex",
    alignItems: "center",
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
  },

  // ✅ Disabled más “presentable”
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

  linksContainer: {
    marginTop: "6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#4B5563",
    textAlign: "center",
  },
  linksRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
  },

  link: {
    color: "#C8102E",
    textDecoration: "none",
    fontWeight: 900,
  },
  secondaryLink: {
  color: "#374151",          
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
  opacity: 0.95,
},
};

const EyeIcon = () => (
  <svg
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm({ mode: "onChange" });

  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const emailValue = watch("email");
  const passValue = watch("password");

  useEffect(() => {
    if (currentUser) navigate("/inicio");
  }, [currentUser, navigate]);

  useEffect(() => {
    if (loginError) setLoginError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailValue, passValue]);

  const onSubmit = async (data) => {
    setLoading(true);
    setLoginError(null);

    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      setLoading(false);
      navigate("/inicio");
    } catch (error) {
      setLoading(false);
      console.error("Error al iniciar sesión:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setLoginError("Correo o contraseña incorrectos.");
      } else if (error.code === "auth/too-many-requests") {
        setLoginError("Demasiados intentos fallidos. Intente más tarde.");
      } else {
        setLoginError("Error al ingresar. Intente nuevamente.");
      }
    }
  };

  if (currentUser) return null;

  const hasFieldErrors = Boolean(errors.email || errors.password);

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>
        <div style={styles.headerBlock}>
          <h2 style={styles.title}>Iniciar sesión</h2>
          <p style={styles.subtitle}>
            Acceso para ciudadanos y personal del consulado
          </p>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Correo electrónico</label>
          <div style={styles.inputContainer}>
            <input
              type="email"
              style={styles.input}
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

        <div style={styles.inputGroup}>
          <label style={styles.label}>Contraseña</label>
          <div style={styles.inputContainer}>
            <input
              type={showPassword ? "text" : "password"}
              style={styles.input}
              {...register("password", { required: "La contraseña es obligatoria" })}
            />
            <button
              type="button"
              style={styles.iconButton}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          {errors.password && (
            <p style={styles.errorText}>{errors.password.message}</p>
          )}
        </div>

        {loginError && !hasFieldErrors && (
          <p style={{ ...styles.errorText, textAlign: "center", fontSize: "14px" }}>
            {loginError}
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
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <div style={styles.linksContainer}>
          <div style={styles.linksRow}>
            <span>¿No tienes cuenta?</span>
            <Link to="/registro" style={styles.link}>
              Regístrate
            </Link>
          </div>

          <div>
            <Link to="/recuperar-contrasena" style={styles.secondaryLink}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}