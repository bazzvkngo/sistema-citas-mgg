// src/pages/PasswordRecovery.jsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5F7',
    padding: '20px'
  },
  formCard: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '26px 24px',
    boxShadow: '0 4px 12px rgba(15,23,42,0.12)'
  },
  title: {
    textAlign: 'center',
    color: '#243447',
    marginBottom: '10px',
    fontSize: '24px',
    fontWeight: 'bold'
  },
  text: {
    textAlign: 'center',
    color: '#4B5563',
    fontSize: '14px',
    marginBottom: '10px',
    lineHeight: '1.5'
  },
  inputGroup: {
    position: 'relative',
    marginBottom: '5px'
  },
  label: {
    fontSize: '14px',
    color: '#243447',
    marginBottom: '5px',
    display: 'block',
    fontWeight: 600
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #D1D5DB',
    borderRadius: '12px',
    padding: '0 15px',
    backgroundColor: '#F9FAFB',
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
    color: '#111827',
    backgroundColor: 'transparent',
    height: '100%'
  },
  submitButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#E5E7EB',
    color: '#9CA3AF',
    border: 'none',
    borderRadius: '25px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'not-allowed',
    marginTop: '10px',
    transition: 'all 0.3s',
    textAlign: 'center'
  },
  submitButtonActive: {
    backgroundColor: '#C8102E',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(200,16,46,0.35)'
  },
  errorText: {
    color: '#DC2626',
    fontSize: '12px',
    marginTop: '4px',
    marginLeft: '5px'
  },
  successCard: {
    backgroundColor: '#f1f8e9',
    borderRadius: '16px',
    padding: '24px 20px',
    border: '1px solid #c5e1a5'
  },
  successTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#C8102E'
  },
  successText: {
    fontSize: '14px',
    color: '#33691e',
    textAlign: 'center',
    marginTop: '10px',
    lineHeight: '1.5'
  },
  divider: {
    marginTop: '8px',
    marginBottom: '8px',
    border: 'none',
    borderTop: '1px solid rgba(0,0,0,0.06)'
  },
  footerText: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: '#4B5563'
  },
  linkPrimary: {
    color: '#007BFF',
    textDecoration: 'none',
    fontWeight: 'bold'
  }
};

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 6L9 17l-5-5"
      stroke="#16A34A"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function PasswordRecovery() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm({ mode: 'onChange' });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const emailValue = watch('email');
  const hasFieldErrors = Boolean(errors.email);

  useEffect(() => {
    if (errorMsg) setErrorMsg('');
  }, [emailValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, data.email.trim());
      setMessage('Hemos enviado un enlace de recuperación a tu correo.');
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);

      if (error.code === 'auth/user-not-found') {
        setErrorMsg('No existe una cuenta registrada con este correo.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('El formato del correo no es válido.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMsg('Demasiados intentos. Intente más tarde.');
      } else {
        setErrorMsg('Ocurrió un error al enviar el correo. Inténtelo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div style={styles.container}>
        <div style={styles.formCard}>
          <div style={styles.successCard}>
            <div style={styles.successTitleRow}>
              <CheckIcon />
              <span style={styles.successTitle}>Correo enviado</span>
            </div>

            <hr style={styles.divider} />
            <p style={styles.successText}>{message}</p>
          </div>

          <div style={styles.footerText}>
            <Link to="/ingreso" style={styles.linkPrimary}>
              Volver a Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.formCard}>
        <h2 style={styles.title}>Recuperar Contraseña</h2>
        <p style={styles.text}>
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Correo electrónico</label>
          <div style={styles.inputContainer}>
            <input
              type="email"
              style={styles.input}
              placeholder="ejemplo@correo.com"
              {...register('email', {
                required: 'El correo es obligatorio',
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: 'Correo inválido'
                }
              })}
            />
          </div>
          {errors.email && <p style={styles.errorText}>{errors.email.message}</p>}
        </div>

        {errorMsg && !hasFieldErrors && (
          <p style={{ ...styles.errorText, textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            ...styles.submitButton,
            ...(isValid && !loading ? styles.submitButtonActive : {})
          }}
        >
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </button>

        <div style={styles.footerText}>
          <Link to="/ingreso" style={styles.linkPrimary}>
            ← Volver a Iniciar sesión
          </Link>
        </div>
      </form>
    </div>
  );
}
