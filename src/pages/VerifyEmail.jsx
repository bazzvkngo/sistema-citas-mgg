import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80vh',
    backgroundColor: '#f8f9fa',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  title: {
    color: '#333',
    marginBottom: '15px',
    fontSize: '24px'
  },
  text: {
    color: '#666',
    lineHeight: '1.5',
    marginBottom: '30px',
    fontSize: '16px'
  },
  emailHighlight: {
    color: '#007bff',
    fontWeight: 'bold'
  },
  button: {
    padding: '12px 25px',
    fontSize: '16px',
    borderRadius: '25px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%',
    marginBottom: '10px',
    transition: 'background-color 0.3s'
  },
  btnPrimary: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  btnSecondary: {
    backgroundColor: '#6c757d',
    color: 'white',
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    textDecoration: 'underline',
    cursor: 'pointer',
    marginTop: '15px',
    fontSize: '14px'
  },
  message: {
    marginBottom: '20px',
    fontWeight: 'bold',
    fontSize: '14px'
  }
};

export default function VerifyEmail() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser?.emailVerified) {
      navigate('/inicio');
    }
  }, [currentUser, navigate]);

  const handleResendEmail = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('Correo de verificación reenviado.');
    } catch (error) {
      console.error(error);
      setError('Error al reenviar (espera unos minutos).');
    }
    setLoading(false);
  };

  const handleReload = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await auth.currentUser.reload();
      
      if (auth.currentUser.emailVerified) {
        window.location.reload(); 
      } else {
        setError('Aún no detectamos la verificación.');
      }
    } catch (error) {
      console.error(error);
      setError('Error al recargar el estado.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/ingreso');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>✉️</div>
        <h2 style={styles.title}>Verifica tu correo electrónico</h2>
        
        <p style={styles.text}>
          Hemos enviado un enlace de confirmación a:<br/>
          <span style={styles.emailHighlight}>{currentUser?.email}</span>
        </p>
        
        <p style={styles.text}>
          Por favor, revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.
        </p>

        {message && <p style={{...styles.message, color: 'green'}}>{message}</p>}
        {error && <p style={{...styles.message, color: 'red'}}>{error}</p>}

        <button 
          style={{...styles.button, ...styles.btnPrimary}} 
          onClick={handleReload}
          disabled={loading}
        >
          {loading ? 'Verificando...' : 'Ya verifiqué mi correo'}
        </button>

        <button 
          style={{...styles.button, ...styles.btnSecondary}} 
          onClick={handleResendEmail}
          disabled={loading}
        >
          Reenviar correo
        </button>

        <button style={styles.btnLink} onClick={handleLogout}>
          Cerrar sesión / Usar otro correo
        </button>
      </div>
    </div>
  );
}