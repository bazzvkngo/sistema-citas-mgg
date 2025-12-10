// src/components/admin/AdminServices.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../../firebase';

// ... (Iconos SVG sin cambios) ...
const PencilIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const PlusIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);

// --- Estilos ---
const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    padding: '25px',
    marginBottom: '30px'
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '20px'
  },
  form: {
    display: 'grid',
    // ✅ CAMBIO: 3 columnas (Nombre, Prefijo, Duración) + Botones
    gridTemplateColumns: '2fr 1fr 1fr auto', 
    gap: '20px',
    alignItems: 'flex-end'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  label: {
    fontSize: '14px',
    color: '#555',
    marginBottom: '5px',
    fontWeight: '500'
  },
  input: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 15px',
    height: '45px',
    fontSize: '16px',
    color: '#333',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    width: '100%'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px'
  },
  button: {
    height: '45px',
    padding: '0 20px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '10px',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  submitButton: { backgroundColor: '#007bff', color: 'white' },
  cancelButton: { backgroundColor: '#6c757d', color: 'white' },
  // ... (Estilos de tabla sin cambios) ...
  tableContainer: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', marginTop: '10px' },
  th: { padding: '12px 15px', textAlign: 'left', color: '#555', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e9ecef', },
  tr: { backgroundColor: '#fdfdfd', borderRadius: '8px', },
  td: { padding: '16px 15px', verticalAlign: 'middle', color: '#333', fontSize: '14px', borderTop: '1px solid #e9ecef', borderBottom: '1px solid #e9ecef', },
  tdFirst: { borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', borderLeft: '1px solid #e9ecef', },
  tdLast: { borderTopRightRadius: '8px', borderBottomRightRadius: '8px', borderRight: '1px solid #e9ecef', textAlign: 'right' },
  actionButton: { background: 'none', border: '1px solid transparent', padding: '8px', borderRadius: '6px', cursor: 'pointer', marginLeft: '5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
  editButton: { color: '#007bff' },
  deleteButton: { color: '#dc3545' },
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
  
  const tramitesCollectionRef = collection(db, "tramites");

  useEffect(() => {
    setLoading(true);
    const q = query(tramitesCollectionRef);
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
        await addDoc(tramitesCollectionRef, {
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
    <div>
      <div style={styles.card}>
        <h3 style={styles.formTitle}>
          {isEditing ? 'Editando Trámite' : 'Crear Nuevo Trámite'}
        </h3>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nombre del Trámite</label>
            <input
              type="text"
              style={styles.input}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Certificado de Antecedentes"
            />
          </div>

          {/* ✅ CAMBIO: Nuevo campo 'Prefijo' */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Prefijo (2 Letras)</label>
            <input
              type="text"
              style={styles.input}
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Ej. AN"
              maxLength={2}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Duración (min)</label>
            <input
              type="number"
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
              {isEditing ? 'Actualizar' : <PlusIcon />}
              {isEditing ? '' : 'Guardar'}
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
        <h3 style={styles.formTitle}>Trámites Existentes</h3>
        {loading ? (
          <p>Cargando trámites...</p>
        ) : (
          <div style={styles.tableContainer}>
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
                        title="Editar Trámite"
                        style={{ ...styles.actionButton, ...styles.editButton }}
                        onClick={() => handleEdit(tramite)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        title="Eliminar Trámite"
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
        )}
      </div>
    </div>
  );
}