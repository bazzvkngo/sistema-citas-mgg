// src/pages/Login.jsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// --- ESTILOS (Coherentes con el Registro) ---
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  formCard: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '26px 24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
  },
  inputGroup: {
    position: 'relative',
    marginBottom: '5px'
  },
  label: {
    fontSize: '14px',
    color: '#555',
    marginBottom: '5px',
    display: 'block',
    fontWeight: '500'
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ccc',
    borderRadius: '12px',
    padding: '0 15px',
    backgroundColor: 'white',
    height: '50px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden'
  },
  input: {
    border: 'none',
    outline: 'none',
    flex: 1,
    width: '100%',
    fontSize: '16px',
    color: '#333',
    backgroundColor: 'transparent',
    height: '100%'
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#007bff',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    right: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 10
  },
  submitButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#e4e6eb',
    color: '#888',
    border: 'none',
    borderRadius: '25px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'not-allowed',
    marginTop: '10px',
    transition: 'all 0.3s'
  },
  submitButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(0, 123, 255, 0.3)'
  },
  errorText: {
    color: 'red',
    fontSize: '12px',
    marginTop: '4px',
    marginLeft: '5px'
  },
  linksContainer: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#555',
    textAlign: 'center'
  },
  // fila para "¿No tienes cuenta? Regístrate"
  linksRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px'
  },
  link: {
    color: '#bda700',
    textDecoration: 'none',
    fontWeight: 'bold'
  },
  secondaryLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '13px'
  }
};

// --- ICONOS SVG ---
const EyeIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const { register, handleSubmit, formState: { errors, isValid } } = useForm({ mode: 'onChange' });
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Si ya está logueado, redirigir a /inicio
  useEffect(() => {
    if (currentUser) {
      navigate('/inicio');
    }
  }, [currentUser, navigate]);

  const onSubmit = async (data) => {
    setLoading(true);
    setLoginError(null);

    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      navigate('/inicio');
    } catch (error) {
      setLoading(false);
      console.error('Error al iniciar sesión:', error);
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password'
      ) {
        setLoginError('Correo o contraseña incorrectos.');
      } else if (error.code === 'auth/too-many-requests') {
        setLoginError('Demasiados intentos fallidos. Intente más tarde.');
      } else {
        setLoginError('Error al ingresar. Intente nuevamente.');
      }
    }
  };

  if (currentUser) return null; // Evita parpadeo antes de redirigir

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>

        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '10px' }}>
          Iniciar Sesión
        </h2>

        {/* Email */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Correo electrónico</label>
          <div style={styles.inputContainer}>
            <input
              type="email"
              style={styles.input}
              {...register('email', {
                required: 'El correo es obligatorio',
                pattern: { value: /^\S+@\S+$/i, message: 'Formato de correo inválido' }
              })}
            />
          </div>
          {errors.email && <p style={styles.errorText}>{errors.email.message}</p>}
        </div>

        {/* Contraseña */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Contraseña</label>
          <div style={styles.inputContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              style={styles.input}
              {...register('password', { required: 'La contraseña es obligatoria' })}
            />
            <button
              type="button"
              style={styles.iconButton}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <p style={styles.errorText}>{errors.password.message}</p>}
        </div>

        {/* Mensaje de Error General */}
        {loginError && (
          <p
            style={{
              ...styles.errorText,
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loginError}
          </p>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            ...styles.submitButton,
            ...(isValid && !loading ? styles.submitButtonActive : {})
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        {/* Enlaces */}
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
