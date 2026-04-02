// src/components/admin/AdminServices.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../../firebase';
import './AdminTheme.css';

// ... (Iconos SVG sin cambios) ...
const PencilIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const PlusIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);

const UI = {
  ink: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  border: 'var(--border-soft)',
  borderStrong: 'var(--border-strong)',
  panel: 'var(--surface-card)',
  bg: 'var(--surface-subcard)',
  bgPage: 'var(--surface-page)',
  row: 'var(--surface-row)',
  rowAlt: 'var(--surface-row-alt)',
  blue: 'var(--brand-primary)',
  success: 'var(--success-strong)',
  danger: 'var(--danger-strong)',
  shadow: 'var(--shadow-card)'
};

// --- Estilos ---
const styles = {
  module: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  card: {
    background:
      'linear-gradient(180deg, rgba(41, 79, 118, 0.03), rgba(41, 79, 118, 0)) top / 100% 110px no-repeat, var(--surface-card)',
    borderRadius: '18px',
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    padding: '18px 20px',
  },
  toolbarCard: {
    padding: '14px 16px',
    background: UI.bg
  },
  toolbarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '10px'
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: UI.ink,
    margin: 0
  },
  formSubtitle: {
    fontSize: '12px',
    color: UI.muted,
    margin: '3px 0 0',
    lineHeight: 1.3
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: UI.bg,
    color: UI.blue,
    border: `1px solid ${UI.border}`,
    fontSize: '11px',
    fontWeight: '600'
  },
  meta: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: UI.bg,
    color: UI.muted,
    border: `1px solid ${UI.border}`,
    fontSize: '11px',
    fontWeight: '700'
  },
  form: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'flex-end'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 240px',
    minWidth: '210px'
  },
  compactInputGroup: {
    flex: '0 1 120px',
    minWidth: '108px'
  },
  label: {
    fontSize: '12px',
    color: UI.muted,
    marginBottom: '4px',
    fontWeight: '600'
  },
  input: {
    border: `1px solid ${UI.border}`,
    borderRadius: '8px',
    padding: '0 10px',
    height: '38px',
    fontSize: '14px',
    color: UI.ink,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    width: '100%',
    background: UI.panel
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    marginLeft: 'auto',
    flexWrap: 'wrap',
    flex: '0 0 auto'
  },
  button: {
    height: '38px',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '7px',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  submitButton: { backgroundColor: UI.blue, color: 'white' },
  cancelButton: { backgroundColor: UI.muted, color: 'white' },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  tableContainer: {
    width: '100%',
    overflowX: 'auto',
    border: `1px solid ${UI.border}`,
    borderRadius: '16px',
    background: UI.bgPage
  },
  tableScroll: {
    overflowX: 'auto',
    padding: '8px',
    background: UI.bgPage
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' },
  th: { padding: '8px 12px', textAlign: 'left', color: UI.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.45px', borderBottom: `1px solid ${UI.border}`, background: UI.bg },
  tr: { backgroundColor: UI.row, borderRadius: '10px' },
  td: { padding: '10px 12px', verticalAlign: 'middle', color: UI.ink, fontSize: '13px', lineHeight: 1.3, borderTop: `1px solid ${UI.border}`, borderBottom: `1px solid ${UI.border}` },
  tdFirst: { borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', borderLeft: `1px solid ${UI.border}` },
  tdLast: { borderTopRightRadius: '10px', borderBottomRightRadius: '10px', borderRight: `1px solid ${UI.border}`, textAlign: 'right' },
  actionButton: { background: UI.bg, border: `1px solid ${UI.border}`, padding: '6px', borderRadius: '8px', cursor: 'pointer', marginLeft: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
  editButton: { color: UI.blue },
  deleteButton: { color: UI.danger },
  loading: { color: UI.muted, fontSize: '13px', fontWeight: '700', padding: '6px 0' }
};
// --- FIN DE ESTILOS ---

export default function AdminServices() {
  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ CAMBIO: Añadir estado para 'prefijo'
  const [nombre, setNombre] = useState('');
  const [prefijo, setPrefijo] = useState('');
  const [duracion, setDuracion] = useState(15);
  
  const [isEditing, setIsEditing] = useState(false);
  const [currentTramiteId, setCurrentTramiteId] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "tramites"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tramitesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTramites(tramitesData);
      setLoading(false);
    }, (error) => {
      console.error("Error al escuchar trámites: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // ✅ CAMBIO: Validar 'prefijo'
    if (nombre === '' || duracion <= 0 || prefijo === '') {
      alert("Por favor, complete todos los campos (Nombre, Prefijo, Duración).");
      return;
    }
    
    setIsSubmitting(true);
    const prefijoUpper = prefijo.toUpperCase(); // Guardar en mayúsculas

    try {
      if (isEditing) {
        const tramiteDoc = doc(db, "tramites", currentTramiteId);
        await updateDoc(tramiteDoc, {
          nombre: nombre,
          prefijo: prefijoUpper,
          duracionMin: Number(duracion)
        });
      } else {
        await addDoc(collection(db, "tramites"), {
          nombre: nombre,
          prefijo: prefijoUpper,
          duracionMin: Number(duracion)
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error al guardar trámite: ", error);
      alert("Error al guardar. Revisa la consola (F12).");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de que desea eliminar este trámite?")) return;
    try {
      const tramiteDoc = doc(db, "tramites", id);
      await deleteDoc(tramiteDoc);
    } catch (error) {
      console.error("Error al eliminar trámite: ", error);
      alert("Error al eliminar. Revisa la consola (F12).");
    }
  };

  const handleEdit = (tramite) => {
    setIsEditing(true);
    setCurrentTramiteId(tramite.id);
    setNombre(tramite.nombre);
    setPrefijo(tramite.prefijo || ''); // Cargar prefijo
    setDuracion(tramite.duracionMin);
  };
  
  const resetForm = () => {
    setIsEditing(false);
    setCurrentTramiteId(null);
    setNombre('');
    setPrefijo('');
    setDuracion(15);
  };

  return (
    <div className="admin-theme-shell" style={styles.module}>
      <div style={{ ...styles.card, ...styles.toolbarCard }}>
        <div style={styles.toolbarHeader}>
          <div>
            <h3 style={styles.formTitle}>Servicios y tiempos</h3>
            <p style={styles.formSubtitle}>
              Administra el catálogo visible para citas y turnos.
            </p>
          </div>
          {isEditing && <span style={styles.statusBadge}>Editando servicio</span>}
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nombre del servicio</label>
            <input
              type="text"
              className="admin-theme-control"
              style={styles.input}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Certificado de Antecedentes"
            />
          </div>

          {/* ✅ CAMBIO: Nuevo campo 'Prefijo' */}
          <div style={{ ...styles.inputGroup, ...styles.compactInputGroup }}>
            <label style={styles.label}>Prefijo (2 Letras)</label>
            <input
              type="text"
              className="admin-theme-control"
              style={styles.input}
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Ej. AN"
              maxLength={2}
            />
          </div>

          <div style={{ ...styles.inputGroup, ...styles.compactInputGroup }}>
            <label style={styles.label}>Duración (min)</label>
            <input
              type="number"
              className="admin-theme-control"
              style={styles.input}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />
          </div>

          <div style={styles.buttonGroup}>
            <button 
              type="submit" 
              style={{ ...styles.button, ...styles.submitButton }}
              disabled={isSubmitting}
            >
              {isEditing ? 'Actualizar' : <><PlusIcon />Guardar</>}
            </button>
            {isEditing && (
              <button 
                type="button" 
                onClick={resetForm} 
                style={{ ...styles.button, ...styles.cancelButton }}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.listHeader}>
          <h3 style={styles.formTitle}>Servicios habilitados</h3>
          <span style={styles.meta}>{tramites.length} registros</span>
        </div>
        {loading ? (
          <p style={styles.loading}>Cargando servicios...</p>
        ) : (
          <div style={styles.tableContainer}>
            <div className="admin-theme-scroll" style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Prefijo</th>
                  <th style={styles.th}>Duración (min)</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tramites.map(tramite => (
                  <tr key={tramite.id} style={styles.tr}>
                    <td style={{...styles.td, ...styles.tdFirst}}>
                      {tramite.nombre}
                    </td>
                    <td style={styles.td}>
                      {/* ✅ CAMBIO: Mostrar Prefijo */}
                      <strong>{tramite.prefijo || 'N/A'}</strong>
                    </td>
                    <td style={styles.td}>
                      {tramite.duracionMin} min
                    </td>
                    <td style={{...styles.td, ...styles.tdLast}}>
                      <button
                        title="Editar servicio"
                        style={{ ...styles.actionButton, ...styles.editButton }}
                        onClick={() => handleEdit(tramite)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        title="Eliminar servicio"
                        style={{ ...styles.actionButton, ...styles.deleteButton }}
                        onClick={() => handleDelete(tramite.id)}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
