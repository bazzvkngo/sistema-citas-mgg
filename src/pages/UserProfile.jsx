// src/pages/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { updatePassword, signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const styles = {
  container: {
    backgroundColor: '#f3f4f6',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '600px',
    marginBottom: '20px',
    position: 'relative'
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '10px',
    fontSize: '24px',
    color: '#007bff',
    position: 'absolute',
    left: 0
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333'
  },
  actionButton: {
    position: 'absolute',
    right: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: '16px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    width: '100%',
    maxWidth: '600px',
    overflow: 'hidden'
  },
  row: {
    padding: '15px 25px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '75px',
    width: '100%',
    boxSizing: 'border-box'
  },
  rowLabel: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '6px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  rowValue: {
    fontSize: '17px',
    color: '#333',
    fontWeight: '500',
    width: '100%',
    textAlign: 'left'
  },
  readOnlyValue: {
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left'
  },
  editInput: {
    fontSize: '16px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #007bff',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: '#f9fbfd'
  },
  bottomCard: {
    marginTop: '15px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    width: '100%',
    maxWidth: '600px',
    padding: '20px 25px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  bottomIcon: {
    marginRight: '15px',
    color: '#007bff',
    display: 'flex',
    alignItems: 'center'
  },
  bottomText: {
    flex: 1,
    fontSize: '16px',
    color: '#333',
    fontWeight: '500'
  },
  arrowIcon: { color: '#ccc' },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#333'
  },
  inputGroup: { marginBottom: '15px' },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 15px',
    backgroundColor: 'white',
    height: '45px',
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
  modalActions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    marginTop: '20px'
  },
  btnCancel: {
    flex: 1,
    padding: '12px',
    background: '#f0f0f0',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#333',
    fontWeight: '500'
  },
  btnSave: {
    flex: 1,
    padding: '12px',
    background: '#007bff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'white',
    fontWeight: 'bold'
  }
};

const ChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const SmallLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function UserProfile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.nombre || currentUser.displayName || '');
      const rawPhone = currentUser.telefono ? currentUser.telefono.replace('+56', '') : '';
      setEditPhone(rawPhone);
    }
  }, [currentUser, isEditing]);

  if (!currentUser) return <div style={styles.container}>Cargando...</div>;

  const closeModal = () => {
    setShowPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordText(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      alert('El nombre y teléfono son obligatorios.');
      return;
    }
    setLoadingProfile(true);
    try {
      const userDocRef = doc(db, 'usuarios', currentUser.uid);
      await updateDoc(userDocRef, {
        nombre: editName,
        telefono: `+56${editPhone}`
      });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: editName });
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      alert('Error al guardar los cambios.');
    }
    setLoadingProfile(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert('Por favor, completa ambos campos.');
      return;
    }
    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    setLoadingPass(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert('Contraseña actualizada con éxito.');
      closeModal();
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Por seguridad, debes cerrar sesión e ingresar nuevamente para cambiar tu contraseña.');
        await signOut(auth);
        navigate('/ingreso');
      } else {
        alert('Error al actualizar la contraseña: ' + error.message);
      }
    }
    setLoadingPass(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/inicio')}>
          <ChevronLeft />
        </button>
        <span style={styles.title}>Datos personales</span>

        {!isEditing ? (
          <button style={styles.actionButton} onClick={() => setIsEditing(true)}>
            Editar
          </button>
        ) : (
          <button style={styles.actionButton} onClick={handleSaveProfile} disabled={loadingProfile}>
            {loadingProfile ? '...' : 'Guardar'}
          </button>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>Nombre Completo</span>
          {isEditing ? (
            <input
              type="text"
              style={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          ) : (
            <span style={styles.rowValue}>{currentUser.nombre || currentUser.displayName}</span>
          )}
        </div>

        <div style={styles.row}>
          <span style={styles.rowLabel}>Teléfono</span>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
              <span style={{ fontWeight: 'bold', color: '#333', fontSize: '16px' }}>+56</span>
              <input
                type="tel"
                style={styles.editInput}
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="9 1234 5678"
              />
            </div>
          ) : (
            <span style={styles.rowValue}>{currentUser.telefono || 'No registrado'}</span>
          )}
        </div>

        <div style={styles.row}>
          <span style={styles.rowLabel}>RUT / DNI</span>
          <span style={styles.readOnlyValue}>
            {currentUser.dni || 'No registrado'} <SmallLock />
          </span>
        </div>

        <div style={{ ...styles.row, borderBottom: 'none' }}>
          <span style={styles.rowLabel}>Correo electrónico</span>
          <span style={styles.readOnlyValue}>
            {currentUser.email} <SmallLock />
          </span>
        </div>
      </div>

      {!isEditing && (
        <div style={styles.bottomCard} onClick={() => setShowPasswordModal(true)}>
          <div style={styles.bottomIcon}>
            <LockIcon />
          </div>
          <span style={styles.bottomText}>Cambiar contraseña</span>
          <div style={styles.arrowIcon}>
            <ChevronRight />
          </div>
        </div>
      )}

      {isEditing && (
        <div
          style={{ ...styles.bottomCard, marginTop: '15px', justifyContent: 'center' }}
          onClick={() => setIsEditing(false)}
        >
          <span style={{ color: '#D32F2F', fontWeight: 'bold' }}>Cancelar Edición</span>
        </div>
      )}

      {showPasswordModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Nueva Contraseña</h3>

            <div style={styles.inputGroup}>
              <div style={styles.inputContainer}>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  placeholder="Nueva contraseña"
                  style={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  style={styles.iconButton}
                  onClick={() => setShowPasswordText((v) => !v)}
                >
                  {/* ✅ cambio: invertimos los íconos porque en tu UI estaban “cruzados” */}
                  {showPasswordText ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.inputContainer}>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  placeholder="Repetir contraseña"
                  style={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.btnCancel} onClick={closeModal} disabled={loadingPass}>
                Cancelar
              </button>
              <button style={styles.btnSave} onClick={handleUpdatePassword} disabled={loadingPass}>
                {loadingPass ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
