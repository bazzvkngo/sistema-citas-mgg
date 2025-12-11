// src/pages/Register.jsx
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db, app } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

// --- ESTILOS (coherentes con Login versión Consulado) ---
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#F4F5F7", // mismo fondo que Login
    padding: "20px",
  },
  formCard: {
    width: "100%",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "26px 24px",
    boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
  },
  inputGroup: {
    position: "relative",
    marginBottom: "5px",
  },
  label: {
    fontSize: "14px",
    color: "#243447",
    marginBottom: "5px",
    display: "block",
    fontWeight: 600,
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #D1D5DB",
    borderRadius: "12px",
    padding: "0 15px",
    backgroundColor: "#F9FAFB",
    height: "48px",
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
    color: "#9CA3AF", // gris suave, igual que Login
    padding: 0,
    display: "flex",
    alignItems: "center",
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
  },
  submitButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#E5E7EB", // gris cuando está desactivado
    color: "#9CA3AF",
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
    backgroundColor: "#C8102E", // rojo Consulado
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(200,16,46,0.35)",
  },
  errorText: {
    color: "#DC2626",
    fontSize: "12px",
    marginTop: "4px",
    marginLeft: "5px",
  },
  footerText: {
    textAlign: "center",
    marginTop: "18px",
    fontSize: "14px",
    color: "#4B5563",
  },
  // mismo color que los links de Login
  link: {
    color: "#007BFF",
    textDecoration: "none",
    fontWeight: "bold",
  },
  successTitle: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#16A34A",
    marginBottom: "8px",
  },
};

// --- ICONOS SVG ---
const EyeIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9CA3AF" // gris, igual al botón
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9CA3AF"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.4 18.4 0 0 1 5.06-5.94" />
    <path d="M10.58 10.58A3 3 0 0 0 13.42 13.4" />
    <path d="M9.88 4.12A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.46 18.46 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm({ mode: "onChange" });

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registroError, setRegistroError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Estados visuales
  const [rutVisual, setRutVisual] = useState("");
  const [telefonoVisual, setTelefonoVisual] = useState("");

  // Functions (región Santiago)
  const functions = getFunctions(app, "southamerica-west1");

  // Registrar campos "ocultos"
  useEffect(() => {
    register("dniLimpio", {
      required: "El RUT es obligatorio",
      minLength: { value: 8, message: "RUT incompleto" },
    });
    register("telefono", {
      required: "El teléfono es obligatorio",
      minLength: { value: 9, message: "Debe tener 9 dígitos" },
      maxLength: { value: 9, message: "Debe tener 9 dígitos" },
    });
  }, [register]);

  // Manejador RUT (visual + campo limpio)
  const handleRutChange = (e) => {
    let valor = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase();
    if (valor.length > 9) valor = valor.slice(0, 9);

    setValue("dniLimpio", valor, { shouldValidate: true });

    let formateado = valor;
    if (valor.length > 1) {
      const cuerpo = valor.slice(0, -1);
      const dv = valor.slice(-1);
      formateado =
        cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
    }
    setRutVisual(formateado);
  };

  // Manejador Teléfono (solo números, 9 dígitos)
  const handleTelefonoChange = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 9) valor = valor.slice(0, 9);
    setTelefonoVisual(valor);
    setValue("telefono", valor, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setRegistroError(null);

    try {
      // 1. Verificar RUT en backend
      const checkDniExists = httpsCallable(functions, "checkDniExists");
      const result = await checkDniExists({ dni: data.dniLimpio });

      if (result.data && result.data.exists) {
        setRegistroError("Este RUT ya está registrado.");
        setLoading(false);
        return;
      }

      // 2. Crear usuario en Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const user = userCredential.user;

      // 3. Actualizar perfil
      await updateProfile(user, { displayName: data.nombre });

      // 4. Guardar datos en Firestore
      await setDoc(doc(db, "usuarios", user.uid), {
        email: data.email,
        nombre: data.nombre,
        dni: data.dniLimpio,
        telefono: `+56${data.telefono}`,
        rol: "ciudadano",
        habilidades: [],
      });

      // 5. Intentar enviar verificación (si falla, no rompemos todo)
      try {
        await sendEmailVerification(user);
      } catch (e) {
        console.error("Error al enviar verificación de correo:", e);
      }

      setSuccessMessage(
        "¡Cuenta creada! Revisa tu correo electrónico para activarla."
      );
      setTimeout(() => navigate("/ingreso"), 3000);
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        setRegistroError("El correo ya está en uso.");
      } else {
        setRegistroError("Error al registrar: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de éxito simple
  if (successMessage) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.formCard, maxWidth: 420, textAlign: "center" }}>
          <h2 style={styles.successTitle}>¡Registro exitoso!</h2>
          <p>{successMessage}</p>
          <Link to="/ingreso" style={styles.link}>
            Ir a Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>
        <h2
          style={{
            textAlign: "center",
            color: "#243447",
            marginBottom: "4px",
          }}
        >
          Crear cuenta
        </h2>

        {/* Nombre completo */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Nombre completo</label>
          <div style={styles.inputContainer}>
            <input
              type="text"
              style={styles.input}
              placeholder="Ej. Juan Pérez"
              {...register("nombre", {
                required: "El nombre es obligatorio",
              })}
            />
          </div>
          {errors.nombre && (
            <p style={styles.errorText}>{errors.nombre.message}</p>
          )}
        </div>

        {/* RUT / DNI */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>RUT/DNI</label>
          <div style={styles.inputContainer}>
            <input
              type="text"
              style={styles.input}
              placeholder="12.345.678-K"
              value={rutVisual}
              onChange={handleRutChange}
              maxLength={12}
            />
          </div>
          {errors.dniLimpio && (
            <p style={styles.errorText}>{errors.dniLimpio.message}</p>
          )}
        </div>

        {/* Teléfono */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Número de teléfono</label>
          <div style={styles.inputContainer}>
            <input
              type="tel"
              style={styles.input}
              placeholder="9 1234 5678"
              value={telefonoVisual}
              onChange={handleTelefonoChange}
              inputMode="numeric"
            />
          </div>
          {errors.telefono && (
            <p style={styles.errorText}>{errors.telefono.message}</p>
          )}
        </div>

        {/* Correo */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Correo electrónico</label>
          <div style={styles.inputContainer}>
            <input
              type="email"
              style={styles.input}
              {...register("email", {
                required: "El correo es obligatorio",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Correo no válido",
                },
              })}
            />
          </div>
          {errors.email && (
            <p style={styles.errorText}>{errors.email.message}</p>
          )}
        </div>

        {/* Contraseña */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Contraseña</label>
          <div style={styles.inputContainer}>
            <input
              type={showPassword ? "text" : "password"}
              style={styles.input}
              {...register("password", {
                required: "La contraseña es obligatoria",
                minLength: {
                  value: 6,
                  message: "Mínimo 6 caracteres",
                },
              })}
            />
            <button
              type="button"
              style={styles.iconButton}
              onClick={() => setShowPassword(!showPassword)}
            >
              {/* ⬇️ mismo arreglo que en Login: icono coherente con estado */}
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          {errors.password && (
            <p style={styles.errorText}>{errors.password.message}</p>
          )}
        </div>

        {/* Error general */}
        {registroError && (
          <p
            style={{
              ...styles.errorText,
              textAlign: "center",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {registroError}
          </p>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            ...styles.submitButton,
            ...(isValid && !loading ? styles.submitButtonActive : {}),
          }}
        >
          {loading ? "Registrando..." : "Regístrate"}
        </button>

        {/* Enlace a login */}
        <div style={styles.footerText}>
          ¿Tienes una cuenta?{" "}
          <Link to="/ingreso" style={styles.link}>
            Iniciar sesión
          </Link>
        </div>
      </form>
    </div>
  );
}
