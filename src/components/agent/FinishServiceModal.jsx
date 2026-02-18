// src/components/agent/FinishServiceModal.jsx
import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebase';
import { CLASSIFICATION_OPTIONS } from '../../constants/classifications';

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
  },
  input: {
    width: '100%',
    padding: '10px',
    margin: '8px 0 15px 0',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box'
  },
  label: { fontWeight: 'bold', display: 'block', marginBottom: '5px' },
  buttonGroup: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
  saveButton: {
    padding: '10px 15px',
    backgroundColor: 'green',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 15px',
    backgroundColor: 'gray',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  }
};

export default function FinishServiceModal({ turnoEnAtencion, onClose, onFinalizarExito }) {
  const [clasificacion, setClasificacion] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!turnoEnAtencion) return null;

  const { id, tipo, codigo } = turnoEnAtencion;
  const esCita = tipo === 'Cita';
  const coleccion = esCita ? 'citas' : 'turnos';

  const handleFinalizar = async () => {
    if (!clasificacion) {
      setError('Debe seleccionar una clasificación.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, coleccion, id);
      const uid = getAuth().currentUser?.uid || '';

      // ✅ módulo correcto según tipo
      const moduloTurno = turnoEnAtencion?.modulo ?? null;
      const moduloCita = turnoEnAtencion?.moduloAsignado ?? null;

      const updateData = {
        estado: 'completado',
        fechaHoraAtencionFin: Timestamp.now(),
        clasificacion,
        comentariosAgente: comentarios,
        agenteID: uid
      };

      // ✅ Guardar el campo correcto
      if (esCita) {
        updateData.moduloAsignado = moduloCita ?? '';
      } else {
        updateData.modulo = moduloTurno ?? '';
      }

      await updateDoc(docRef, updateData);

      onFinalizarExito(tipo, codigo);
    } catch (err) {
      console.error(`Error al finalizar ${tipo} en DB:`, err);
      setError('Error al guardar la clasificación. Revise la consola.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2>Finalizar Atención de {tipo}</h2>
        <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{codigo}</p>

        <div>
          <label style={styles.label}>Clasificación *</label>
          <select
            style={styles.input}
            value={clasificacion}
            onChange={(e) => {
              setClasificacion(e.target.value);
              setError(null);
            }}
            disabled={loading}
          >
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={option.value === ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.label}>Comentarios Adicionales (Opcional)</label>
          <textarea
            style={{ ...styles.input, resize: 'vertical', height: '100px' }}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={styles.buttonGroup}>
          <button style={styles.cancelButton} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button style={styles.saveButton} onClick={handleFinalizar} disabled={loading || !clasificacion}>
            {loading ? 'Guardando...' : 'Guardar y Finalizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
