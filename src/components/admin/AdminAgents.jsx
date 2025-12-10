// src/components/admin/AdminAgents.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

// 🔐 Dominios permitidos para correos institucionales
const ALLOWED_STAFF_DOMAINS = [
  '@consulado.pe',
  // Si el consulado usa otros dominios, los agregas aquí:
  // '@rree.gob.pe',
];

// Roles considerados “de funcionario”
const STAFF_ROLES = ['agente', 'admin', 'pantalla', 'kiosko'];

const isInstitutionalEmail = (email = '') =>
  ALLOWED_STAFF_DOMAINS.some((dominio) =>
    email.toLowerCase().endsWith(dominio.toLowerCase())
  );

// --- ESTILOS "CLEAN UI" ---
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
  // Barra de filtros
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '18px',
    alignItems: 'center'
  },
  filterLabel: {
    fontSize: '14px',
    color: '#555',
    fontWeight: '500'
  },
  filterSelect: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '8px 10px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    backgroundColor: '#fff',
    minWidth: '160px'
  },
  filterInput: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '8px 10px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    minWidth: '220px'
  },

  tableContainer: {
    width: '100%',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 8px',
    marginTop: '10px'
  },
  th: {
    padding: '12px 15px',
    textAlign: 'left',
    color: '#555',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e9ecef',
  },
  tr: {
    backgroundColor: '#fdfdfd',
    borderRadius: '8px',
  },
  td: {
    padding: '16px 15px',
    verticalAlign: 'top',
    color: '#333',
    fontSize: '14px',
    borderTop: '1px solid #e9ecef',
    borderBottom: '1px solid #e9ecef',
  },
  tdFirst: {
    borderTopLeftRadius: '8px',
    borderBottomLeftRadius: '8px',
    borderLeft: '1px solid #e9ecef',
    minWidth: '200px', // Para el email
  },
  tdLast: {
    borderTopRightRadius: '8px',
    borderBottomRightRadius: '8px',
    borderRight: '1px solid #e9ecef',
    minWidth: '250px', // Para las habilidades
  },
  // Estilos para los inputs de la tabla
  select: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '10px 15px',
    height: '45px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    backgroundColor: '#fff',
    width: '100%',
    minWidth: '120px'
  },
  inputModulo: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 15px',
    height: '45px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    width: '80px',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  habilidadesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  habilidadLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    cursor: 'pointer',
    gap: '8px'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#007bff' // Azul
  }
};
// --- FIN DE ESTILOS ---

export default function AdminAgents() {
  const [usuarios, setUsuarios] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Filtros
  // filtroRol:
  //  - "staff" → solo roles distintos de ciudadano (lo que más le importa al admin)
  //  - "todos" → muestra absolutamente todos
  //  - "ciudadano" / "agente" / "admin" / "pantalla" / "kiosko"
  const [filtroRol, setFiltroRol] = useState('staff');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'tramites'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tramitesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTramites(tramitesList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'usuarios'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usuariosList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsuarios(usuariosList);
        setLoading(false);
      },
      (error) => {
        console.error("Error al escuchar usuarios: ", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleRolChange = (userId, nuevoRol) => {
    // Buscamos el usuario para validar su correo
    const usuario = usuarios.find((u) => u.id === userId);
    const email = usuario?.email || '';
    const rolActual = usuario?.rol || 'ciudadano';

    // Si se intenta asignar un rol de staff a un correo NO institucional → bloqueamos
    if (STAFF_ROLES.includes(nuevoRol) && !isInstitutionalEmail(email)) {
      alert(
        'Este usuario no tiene un correo institucional autorizado.\n\n' +
        'Solo los correos que terminan en los dominios configurados (por ejemplo @consulado.pe) ' +
        'pueden recibir roles de Agente, Admin, Pantalla TV o Kiosko.'
      );
      return;
    }

    // Bajar de staff a ciudadano siempre se permite
    if (rolActual === nuevoRol) return;

    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, {
      rol: nuevoRol
    }).catch(error => {
      console.error("Error al cambiar rol: ", error);
      alert("Error al actualizar el rol.");
    });
  };

  const handleModuloChange = (userId, nuevoModulo) => {
    const moduloNum = Number(nuevoModulo) || 0;
    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, {
      moduloAsignado: moduloNum
    }).catch(error => {
      console.error("Error al cambiar módulo: ", error);
      alert("Error al actualizar el módulo.");
    });
  };

  const handleHabilidadChange = (userId, tramiteId, isChecked) => {
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) return;

    let habilidadesActuales = usuario.habilidades || [];
    let nuevasHabilidades;

    if (isChecked) {
      nuevasHabilidades = [...new Set([...habilidadesActuales, tramiteId])];
    } else {
      nuevasHabilidades = habilidadesActuales.filter(h => h !== tramiteId);
    }

    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, {
      habilidades: nuevasHabilidades
    }).catch(error => {
      console.error("Error al cambiar habilidades: ", error);
      alert("Error al actualizar habilidades.");
    });
  };

  // 🔍 Lógica de filtrado en memoria (para ~cientos de usuarios va sobrado)
  const usuariosFiltrados = usuarios.filter((user) => {
    const rol = user.rol || 'ciudadano';

    // 1) Filtro por rol
    if (filtroRol === 'staff') {
      // Solo personal: todo lo que NO sea ciudadano
      if (rol === 'ciudadano') return false;
    } else if (filtroRol !== 'todos') {
      if (rol !== filtroRol) return false;
    }

    // 2) Filtro por texto (email o DNI)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const emailMatch = (user.email || '').toLowerCase().includes(term);
      const dniMatch = user.dni ? String(user.dni).includes(term) : false;
      if (!emailMatch && !dniMatch) return false;
    }

    return true;
  });

  if (loading || tramites.length === 0) {
    return <p>Cargando usuarios y trámites...</p>;
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.formTitle}>Gestión de Agentes y Habilidades</h3>

      {/* 🔍 Barra de filtros */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>Mostrar:</span>
        <select
          style={styles.filterSelect}
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
        >
          <option value="staff">Solo personal (Agente/Admin/Pantalla/Kiosko)</option>
          <option value="todos">Todos los usuarios</option>
          <option value="ciudadano">Solo ciudadanos</option>
          <option value="agente">Solo agentes</option>
          <option value="admin">Solo admins</option>
          <option value="pantalla">Solo pantalla TV</option>
          <option value="kiosko">Solo kiosko</option>
        </select>

        <span style={styles.filterLabel}>Buscar:</span>
        <input
          type="text"
          style={styles.filterInput}
          placeholder="Email o DNI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Rol</th>
              <th style={styles.th}>Módulo</th>
              <th style={styles.th}>Habilidades (Trámites que atiende)</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(user => (
              <tr key={user.id} style={styles.tr}>

                {/* Email */}
                <td style={{ ...styles.td, ...styles.tdFirst }}>{user.email}</td>

                {/* Rol */}
                <td style={styles.td}>
                  <select
                    style={styles.select}
                    value={user.rol}
                    onChange={(e) => handleRolChange(user.id, e.target.value)}
                    disabled={user.id === currentUser?.uid}
                  >
                    <option value="ciudadano">Ciudadano</option>
                    <option value="agente">Agente</option>
                    <option value="admin">Admin</option>
                    <option value="pantalla">Pantalla TV</option>
                    <option value="kiosko">Kiosko</option>
                  </select>
                </td>

                {/* Módulo */}
                <td style={styles.td}>
                  {user.rol !== 'ciudadano' && user.rol !== 'pantalla' && user.rol !== 'kiosko' ? (
                    <input
                      type="number"
                      style={styles.inputModulo}
                      key={user.id + (user.moduloAsignado ?? '')}
                      defaultValue={user.moduloAsignado || ''}
                      placeholder="N/A"
                      onBlur={(e) => handleModuloChange(user.id, e.target.value)}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </td>

                {/* Habilidades */}
                <td style={{ ...styles.td, ...styles.tdLast }}>
                  {user.rol === 'agente' || user.rol === 'admin' ? (
                    <div style={styles.habilidadesBox}>
                      {tramites.map(tramite => {
                        const tieneHabilidad = user.habilidades?.includes(tramite.id) || false;
                        return (
                          <label key={tramite.id} style={styles.habilidadLabel}>
                            <input
                              type="checkbox"
                              style={styles.checkbox}
                              checked={tieneHabilidad}
                              onChange={(e) =>
                                handleHabilidadChange(
                                  user.id,
                                  tramite.id,
                                  e.target.checked
                                )
                              }
                            />
                            {tramite.nombre}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}

            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...styles.td, textAlign: 'center', fontStyle: 'italic' }}>
                  No hay usuarios que coincidan con el filtro actual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
