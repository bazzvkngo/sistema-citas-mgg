// src/components/admin/AdminAgents.jsx
import React, { useMemo, useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

// Dominios permitidos para correos institucionales
const ALLOWED_STAFF_DOMAINS = [
  '@consulperu.pe',
  // Agrega otros dominios si aplica:
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
    backgroundColor: '#fff',
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
    minWidth: '220px',
  },
  tdLast: {
    borderTopRightRadius: '8px',
    borderBottomRightRadius: '8px',
    borderRight: '1px solid #e9ecef',
    minWidth: '320px',
  },

  // Inputs
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
  inputText: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 12px',
    height: '45px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    width: '220px',
    boxSizing: 'border-box'
  },
  inputPhone: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 12px',
    height: '45px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    width: '170px',
    boxSizing: 'border-box'
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

  // Activo
  activoBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start'
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  toggle: {
    width: '16px',
    height: '16px',
    accentColor: '#0d6efd'
  },
  badgeActive: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    background: '#e8fff0',
    color: '#0a7a2f',
    border: '1px solid #b7f0c6'
  },
  badgeInactive: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    background: '#ffecec',
    color: '#b30000',
    border: '1px solid #ffd0d0'
  },

  // Habilidades
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
    accentColor: '#007bff'
  },

  // Acciones
  actionsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: '260px'
  },
  pwdRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  pwdInput: {
    border: '1px solid #ccc',
    borderRadius: '10px',
    padding: '0 12px',
    height: '45px',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    width: '220px',
    boxSizing: 'border-box'
  },
  btn: (variant = 'primary') => {
    const base = {
      border: 'none',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      height: '45px',
      whiteSpace: 'nowrap'
    };

    if (variant === 'primary') {
      return { ...base, background: '#0d6efd', color: '#fff' };
    }
    if (variant === 'ghost') {
      return { ...base, background: '#f2f4f7', color: '#111', border: '1px solid #d6dae0' };
    }
    if (variant === 'danger') {
      return { ...base, background: '#C8102E', color: '#fff' };
    }
    return base;
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 1.35
  }
};
// --- FIN DE ESTILOS ---

export default function AdminAgents() {
  const [usuarios, setUsuarios] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Filtros
  const [filtroRol, setFiltroRol] = useState('staff');
  const [searchTerm, setSearchTerm] = useState('');

  // Password per usuario (solo UI)
  const [pwdByUid, setPwdByUid] = useState({});
  const [savingPwdByUid, setSavingPwdByUid] = useState({});

  const adminUpdateAgente = useMemo(() => httpsCallable(functions, 'adminUpdateAgente'), []);

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

  const safeRole = (r) => (r ? String(r).toLowerCase() : 'ciudadano');

  const handleRolChange = (userId, nuevoRol) => {
    const usuario = usuarios.find((u) => u.id === userId);
    const email = usuario?.email || '';
    const rolActual = safeRole(usuario?.rol);

    // Si se intenta asignar un rol de staff a un correo NO institucional → bloqueamos
    if (STAFF_ROLES.includes(nuevoRol) && !isInstitutionalEmail(email)) {
      alert(
        'Este usuario no tiene un correo institucional autorizado.\n\n' +
        'Solo los correos que terminan en los dominios configurados pueden recibir roles de Agente, Admin, Pantalla TV o Kiosko.'
      );
      return;
    }

    if (rolActual === nuevoRol) return;

    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { rol: nuevoRol }).catch(error => {
      console.error("Error al cambiar rol: ", error);
      alert("Error al actualizar el rol.");
    });
  };

  const handleModuloChange = (userId, nuevoModulo) => {
    const moduloNum = Number(nuevoModulo) || 0;
    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { moduloAsignado: moduloNum }).catch(error => {
      console.error("Error al cambiar módulo: ", error);
      alert("Error al actualizar el módulo.");
    });
  };

  const handleHabilidadChange = (userId, tramiteId, isChecked) => {
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) return;

    const habilidadesActuales = usuario.habilidades || [];
    const nuevasHabilidades = isChecked
      ? [...new Set([...habilidadesActuales, tramiteId])]
      : habilidadesActuales.filter(h => h !== tramiteId);

    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { habilidades: nuevasHabilidades }).catch(error => {
      console.error("Error al cambiar habilidades: ", error);
      alert("Error al actualizar habilidades.");
    });
  };

  // nombreCompleto / telefono / activo
  const handleNombreChange = (userId, value) => {
    const nombre = (value || '').toString().trim();
    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { nombreCompleto: nombre }).catch(error => {
      console.error("Error al actualizar nombreCompleto: ", error);
      alert("Error al actualizar el nombre.");
    });
  };

  const handleTelefonoChange = (userId, value) => {
    const tel = (value || '').toString().trim();
    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { telefono: tel }).catch(error => {
      console.error("Error al actualizar telefono: ", error);
      alert("Error al actualizar el teléfono.");
    });
  };

  const handleActivoChange = (userId, checked) => {
    const userDocRef = doc(db, 'usuarios', userId);
    updateDoc(userDocRef, { activo: !!checked }).catch(error => {
      console.error("Error al actualizar activo: ", error);
      alert("Error al actualizar estado activo.");
    });
  };

  const handlePwdChange = (uid, value) => {
    setPwdByUid((prev) => ({ ...prev, [uid]: value }));
  };

  const handleGuardarPwd = async (uid) => {
    const pwd = (pwdByUid[uid] || '').trim();
    if (!pwd) {
      alert('Ingresa una contraseña primero.');
      return;
    }
    if (pwd.length < 6) {
      alert('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    try {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: true }));
      await adminUpdateAgente({
        uid,
        updates: {},
        newPassword: pwd
      });
      setPwdByUid((prev) => ({ ...prev, [uid]: '' }));
      alert('Contraseña actualizada correctamente.');
    } catch (err) {
      console.error('Error al actualizar contraseña:', err);
      alert('No se pudo actualizar la contraseña. Revisa permisos y vuelve a intentar.');
    } finally {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: false }));
    }
  };

  // Filtrado
  const usuariosFiltrados = usuarios.filter((user) => {
    const rol = safeRole(user.rol);

    // 1) Filtro por rol
    if (filtroRol === 'staff') {
      if (rol === 'ciudadano') return false;
    } else if (filtroRol !== 'todos') {
      if (rol !== filtroRol) return false;
    }

    // 2) Texto (email o DNI o nombre)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const emailMatch = (user.email || '').toLowerCase().includes(term);
      const dniMatch = user.dni ? String(user.dni).toLowerCase().includes(term) : false;
      const nombreMatch = (user.nombreCompleto || '').toLowerCase().includes(term);
      if (!emailMatch && !dniMatch && !nombreMatch) return false;
    }

    return true;
  });

  if (loading || tramites.length === 0) {
    return <p>Cargando usuarios y trámites...</p>;
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.formTitle}>Gestión de Agentes y Habilidades</h3>

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
          placeholder="Email, DNI o Nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Nombre</th>
              <th style={styles.th}>Teléfono</th>
              <th style={styles.th}>Activo</th>
              <th style={styles.th}>Rol</th>
              <th style={styles.th}>Módulo</th>
              <th style={styles.th}>Habilidades (Trámites que atiende)</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {usuariosFiltrados.map(user => {
              const rol = safeRole(user.rol);
              const isSelf = user.id === currentUser?.uid;

              const isStaff = rol !== 'ciudadano';
              const activo = user.activo === false ? false : true; // default true
              const savingPwd = !!savingPwdByUid[user.id];

              return (
                <tr key={user.id} style={styles.tr}>
                  <td style={{ ...styles.td, ...styles.tdFirst }}>
                    {user.email || '(sin email)'}
                  </td>

                  <td style={styles.td}>
                    {isStaff ? (
                      <input
                        type="text"
                        style={styles.inputText}
                        key={user.id + (user.nombreCompleto ?? '')}
                        defaultValue={user.nombreCompleto || ''}
                        placeholder="Nombre completo"
                        onBlur={(e) => handleNombreChange(user.id, e.target.value)}
                      />
                    ) : (
                      <span>—</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    {isStaff ? (
                      <input
                        type="text"
                        style={styles.inputPhone}
                        key={user.id + (user.telefono ?? '')}
                        defaultValue={user.telefono || ''}
                        placeholder="+56 9 ..."
                        onBlur={(e) => handleTelefonoChange(user.id, e.target.value)}
                      />
                    ) : (
                      <span>—</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    {isStaff ? (
                      <div style={styles.activoBox}>
                        <div style={styles.toggleRow}>
                          <input
                            type="checkbox"
                            style={styles.toggle}
                            checked={activo}
                            disabled={isSelf}
                            onChange={(e) => handleActivoChange(user.id, e.target.checked)}
                          />
                          <span style={activo ? styles.badgeActive : styles.badgeInactive}>
                            {activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        {isSelf && (
                          <span style={{ fontSize: 12, color: '#777' }}>
                            No puedes desactivarte a ti mismo.
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    <select
                      style={styles.select}
                      value={rol}
                      onChange={(e) => handleRolChange(user.id, e.target.value)}
                      disabled={isSelf}
                    >
                      <option value="ciudadano">Ciudadano</option>
                      <option value="agente">Agente</option>
                      <option value="admin">Admin</option>
                      <option value="pantalla">Pantalla TV</option>
                      <option value="kiosko">Kiosko</option>
                    </select>
                  </td>

                  <td style={styles.td}>
                    {rol !== 'ciudadano' && rol !== 'pantalla' && rol !== 'kiosko' ? (
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

                  <td style={styles.td}>
                    {rol === 'agente' || rol === 'admin' ? (
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

                  <td style={{ ...styles.td, ...styles.tdLast }}>
                    {isStaff ? (
                      <div style={styles.actionsBox}>
                        <div style={styles.pwdRow}>
                          <input
                            type="password"
                            style={styles.pwdInput}
                            placeholder="Nueva contraseña (mín. 6)"
                            value={pwdByUid[user.id] || ''}
                            onChange={(e) => handlePwdChange(user.id, e.target.value)}
                            disabled={savingPwd}
                          />
                          <button
                            style={styles.btn('primary')}
                            onClick={() => handleGuardarPwd(user.id)}
                            disabled={savingPwd}
                            title="Actualiza la contraseña en Firebase Auth"
                          >
                            {savingPwd ? 'Guardando...' : 'Guardar contraseña'}
                          </button>
                        </div>

                        <div style={styles.helpText}>
                          Esta acción actualiza la contraseña del usuario en Firebase Auth. El resto de campos se guardan al salir del campo.
                        </div>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...styles.td, textAlign: 'center', fontStyle: 'italic' }}>
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
