// src/components/agent/FinishServiceModal.jsx
import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebase';
import { CLASSIFICATION_OPTIONS } from '../../constants/classifications';

const styles = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 14
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    width: '100%',
    maxWidth: 520,
    border: '1px solid #e5e7eb',
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)'
  },
  title: { margin: 0, fontSize: 16, fontWeight: 900, color: '#111' },
  code: { margin: '8px 0 0', fontSize: 28, fontWeight: 900, color: '#0b3d91' },
  label: { fontWeight: 900, display: 'block', marginBottom: 6, fontSize: 12, color: '#111' },
  input: {
    width: '100%',
    padding: '10px 12px',
    margin: '0 0 14px 0',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxSizing: 'border-box',
    fontWeight: 800,
    fontSize: 13,
    outline: 'none'
  },
  hint: { margin: '-6px 0 12px', fontSize: 12, fontWeight: 700, color: '#666' },
  error: { margin: '8px 0 0', color: '#b00020', fontWeight: 800, fontSize: 12 },

  buttonGroup: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  btn: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12
  },
  cancelButton: { background: '#fff', color: '#111' },
  saveButton: { background: '#16a34a', border: '1px solid #16a34a', color: '#fff' },
  disabled: { opacity: 0.7, cursor: 'not-allowed' }
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
        <h2 style={styles.title}>Finalizar atención — {tipo}</h2>
        <p style={styles.code}>{codigo}</p>

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
          <label style={styles.label}>Comentarios adicionales (opcional)</label>
          <textarea
            style={{ ...styles.input, resize: 'vertical', height: 110 }}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            disabled={loading}
            placeholder="Escribe una observación breve si aplica…"
          />
          <p style={styles.hint}>Esto quedará registrado en la atención (auditoría).</p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.btn, ...styles.cancelButton, ...(loading ? styles.disabled : {}) }}
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            style={{
              ...styles.btn,
              ...styles.saveButton,
              ...((loading || !clasificacion) ? styles.disabled : {})
            }}
            onClick={handleFinalizar}
            disabled={loading || !clasificacion}
          >
            {loading ? 'Guardando…' : 'Guardar y finalizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
