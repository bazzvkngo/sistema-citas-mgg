// src/components/admin/AdminAgents.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

// Dominios permitidos para correos institucionales
const ALLOWED_STAFF_DOMAINS = [
  "@consulperu.pe",
  // '@rree.gob.pe',
];

// Roles considerados “de funcionario”
const STAFF_ROLES = ["agente", "admin", "pantalla", "kiosko"];

const isInstitutionalEmail = (email = "") =>
  ALLOWED_STAFF_DOMAINS.some((dom) =>
    email.toLowerCase().endsWith(dom.toLowerCase())
  );

const safeRole = (r) => (r ? String(r).toLowerCase() : "ciudadano");

const UI = {
  ink: "#0b1220",
  muted: "#6b7280",
  border: "rgba(15, 23, 42, 0.12)",
  panel: "#ffffff",
  bg: "#f8fafc",
  brand: "#C8102E",
  blue: "#0d6efd",
  shadow: "0 12px 32px rgba(0,0,0,0.08)",
};

const styles = {
  card: {
    backgroundColor: UI.panel,
    borderRadius: 14,
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    padding: 20,
    marginBottom: 20,
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: 900, color: "#333" },
  meta: { fontSize: 12, fontWeight: 900, color: UI.muted },

  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterLeft: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  label: { fontSize: 13, fontWeight: 900, color: "#444" },
  select: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
    minWidth: 220,
  },
  selectSmall: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
    minWidth: 160,
  },
  input: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
    minWidth: 260,
  },

  listWrap: {
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    overflow: "hidden",
    background: "#fff",
  },
  listScroll: {
    maxHeight: 620,
    overflow: "auto",
    background: "#fff",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.9fr 0.7fr 0.7fr 120px",
    gap: 12,
    padding: 12,
    borderBottom: `1px solid rgba(0,0,0,0.06)`,
    alignItems: "center",
  },
  rowAlt: { background: UI.bg },
  colMain: { minWidth: 0 },
  email: {
    fontWeight: 900,
    color: UI.ink,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sub: { fontSize: 12, fontWeight: 800, color: UI.muted, marginTop: 2 },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: `1px solid ${UI.border}`,
    width: "fit-content",
  },
  badgeActive: { background: "#e8fff0", color: "#0a7a2f", borderColor: "#b7f0c6" },
  badgeInactive: { background: "#ffecec", color: "#b30000", borderColor: "#ffd0d0" },

  toggleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  toggle: { width: 16, height: 16, accentColor: UI.blue },

  btn: (variant = "primary") => {
    const base = {
      border: "none",
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };
    if (variant === "primary") return { ...base, background: UI.blue, color: "#fff" };
    if (variant === "ghost")
      return { ...base, background: "#f2f4f7", color: "#111", border: "1px solid #d6dae0" };
    if (variant === "danger") return { ...base, background: UI.brand, color: "#fff" };
    return base;
  },

  expand: {
    padding: 12,
    borderBottom: `1px solid rgba(0,0,0,0.06)`,
    background: "#fff",
  },
  section: {
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    marginTop: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: 900, color: UI.ink, marginBottom: 10 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 900, color: UI.muted },
  fieldInput: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },

  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: UI.bg,
    fontSize: 12,
    fontWeight: 900,
    color: UI.ink,
  },
  help: { fontSize: 12, color: UI.muted, fontWeight: 800, marginTop: 8, lineHeight: 1.35 },

  skillsList: { marginTop: 10, display: "grid", gap: 8 },
  skillRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800 },
  checkbox: { width: 16, height: 16, accentColor: UI.blue },

  pwdRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  pwdInput: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
    minWidth: 260,
  },

  empty: { padding: 12, color: UI.muted, fontWeight: 900 },
};

export default function AdminAgents() {
  const { currentUser } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTramites, setLoadingTramites] = useState(true);

  // filtros
  const [filtroRol, setFiltroRol] = useState("staff"); // staff | todos | ciudadano | agente | admin | pantalla | kiosko
  const [filtroEstado, setFiltroEstado] = useState("todos"); // todos | activos | inactivos
  const [searchTerm, setSearchTerm] = useState("");

  // UI
  const [expandedUid, setExpandedUid] = useState(null);
  const [skillsOpenUid, setSkillsOpenUid] = useState(null);

  // password per usuario
  const [pwdByUid, setPwdByUid] = useState({});
  const [savingPwdByUid, setSavingPwdByUid] = useState({});

  const adminUpdateAgente = useMemo(
    () => httpsCallable(functions, "adminUpdateAgente"),
    []
  );

  // tramites
  useEffect(() => {
    setLoadingTramites(true);
    const q = query(collection(db, "tramites"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTramites(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setLoadingTramites(false);
      },
      (err) => {
        console.error("Error al escuchar tramites:", err);
        setLoadingTramites(false);
      }
    );
    return () => unsub();
  }, []);

  // usuarios (mejor: query según filtro)
  useEffect(() => {
    setLoadingUsers(true);

    let q = query(collection(db, "usuarios"));

    // ✅ reducir lecturas por defecto (staff)
    if (filtroRol === "staff") {
      q = query(collection(db, "usuarios"), where("rol", "in", STAFF_ROLES));
    } else if (filtroRol !== "todos") {
      q = query(collection(db, "usuarios"), where("rol", "==", filtroRol));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsuarios(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setLoadingUsers(false);
      },
      (err) => {
        console.error("Error al escuchar usuarios:", err);
        setLoadingUsers(false);
      }
    );

    return () => unsub();
  }, [filtroRol]);

  const handleRolChange = async (userId, nuevoRol) => {
    const usuario = usuarios.find((u) => u.id === userId);
    const email = usuario?.email || "";
    const rolActual = safeRole(usuario?.rol);

    if (STAFF_ROLES.includes(nuevoRol) && !isInstitutionalEmail(email)) {
      alert(
        "Este usuario no tiene un correo institucional autorizado.\n\n" +
          "Solo los correos que terminan en los dominios configurados pueden recibir roles de Agente, Admin, Pantalla TV o Kiosko."
      );
      return;
    }

    if (rolActual === nuevoRol) return;

    try {
      await updateDoc(doc(db, "usuarios", userId), { rol: nuevoRol });
    } catch (e) {
      console.error("Error al cambiar rol:", e);
      alert("Error al actualizar el rol.");
    }
  };

  const handleModuloChange = async (userId, nuevoModulo) => {
    const moduloNum = Number(nuevoModulo) || 0;
    try {
      await updateDoc(doc(db, "usuarios", userId), { moduloAsignado: moduloNum });
    } catch (e) {
      console.error("Error al cambiar módulo:", e);
      alert("Error al actualizar el módulo.");
    }
  };

  const handleHabilidadChange = async (userId, tramiteId, isChecked) => {
    const usuario = usuarios.find((u) => u.id === userId);
    if (!usuario) return;

    const actuales = usuario.habilidades || [];
    const nuevas = isChecked
      ? [...new Set([...actuales, tramiteId])]
      : actuales.filter((h) => h !== tramiteId);

    try {
      await updateDoc(doc(db, "usuarios", userId), { habilidades: nuevas });
    } catch (e) {
      console.error("Error al cambiar habilidades:", e);
      alert("Error al actualizar habilidades.");
    }
  };

  const handleNombreChange = async (userId, value) => {
    const nombre = (value || "").toString().trim();
    try {
      await updateDoc(doc(db, "usuarios", userId), { nombreCompleto: nombre });
    } catch (e) {
      console.error("Error al actualizar nombreCompleto:", e);
      alert("Error al actualizar el nombre.");
    }
  };

  const handleTelefonoChange = async (userId, value) => {
    const tel = (value || "").toString().trim();
    try {
      await updateDoc(doc(db, "usuarios", userId), { telefono: tel });
    } catch (e) {
      console.error("Error al actualizar telefono:", e);
      alert("Error al actualizar el teléfono.");
    }
  };

  const handleActivoChange = async (userId, checked) => {
    try {
      await updateDoc(doc(db, "usuarios", userId), { activo: !!checked });
    } catch (e) {
      console.error("Error al actualizar activo:", e);
      alert("Error al actualizar estado activo.");
    }
  };

  const handlePwdChange = (uid, value) => {
    setPwdByUid((prev) => ({ ...prev, [uid]: value }));
  };

  const handleGuardarPwd = async (uid) => {
    const pwd = (pwdByUid[uid] || "").trim();
    if (!pwd) return alert("Ingresa una contraseña primero.");
    if (pwd.length < 6) return alert("La contraseña debe tener mínimo 6 caracteres.");

    try {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: true }));
      await adminUpdateAgente({ uid, updates: {}, newPassword: pwd });
      setPwdByUid((prev) => ({ ...prev, [uid]: "" }));
      alert("Contraseña actualizada correctamente.");
    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      alert("No se pudo actualizar la contraseña. Revisa permisos y vuelve a intentar.");
    } finally {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();

    return usuarios
      .filter((u) => {
        const rol = safeRole(u.rol);

        // estado
        const activo = u.activo === false ? false : true;
        if (filtroEstado === "activos" && !activo) return false;
        if (filtroEstado === "inactivos" && activo) return false;

        // texto (email o DNI o nombre)
        if (term) {
          const emailMatch = (u.email || "").toLowerCase().includes(term);
          const dniMatch = u.dni ? String(u.dni).toLowerCase().includes(term) : false;
          const nombreMatch = (u.nombreCompleto || "").toLowerCase().includes(term);
          if (!emailMatch && !dniMatch && !nombreMatch) return false;
        }

        // para "todos" ya viene todo desde query
        // para staff/rol específico ya viene desde query
        // pero mantenemos compatibilidad por si rol viene null
        if (filtroRol === "staff") return rol !== "ciudadano";
        if (filtroRol === "todos") return true;
        return rol === filtroRol;
      })
      .sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [usuarios, filtroRol, filtroEstado, searchTerm]);

  const getRoleLabel = (rol) => {
    if (rol === "admin") return "Admin";
    if (rol === "agente") return "Agente";
    if (rol === "pantalla") return "Pantalla TV";
    if (rol === "kiosko") return "Kiosko";
    return "Ciudadano";
  };

  const getSelectedTramites = (user) => {
    const ids = user.habilidades || [];
    const map = new Map(tramites.map((t) => [t.id, t.nombre || t.id]));
    return ids.map((id) => map.get(id) || id);
  };

  if (loadingUsers || loadingTramites) {
    return <p>Cargando usuarios y trámites...</p>;
  }

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.title}>Gestión de Agentes y Habilidades</div>
        <div style={styles.meta}>{usuariosFiltrados.length} usuarios</div>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.filterLeft}>
          <span style={styles.label}>Mostrar:</span>
          <select
            style={styles.select}
            value={filtroRol}
            onChange={(e) => {
              setFiltroRol(e.target.value);
              setExpandedUid(null);
              setSkillsOpenUid(null);
            }}
          >
            <option value="staff">Solo personal (Agente/Admin/Pantalla/Kiosko)</option>
            <option value="todos">Todos los usuarios</option>
            <option value="ciudadano">Solo ciudadanos</option>
            <option value="agente">Solo agentes</option>
            <option value="admin">Solo admins</option>
            <option value="pantalla">Solo pantalla TV</option>
            <option value="kiosko">Solo kiosko</option>
          </select>

          <select
            style={styles.selectSmall}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activos">Estado: Activos</option>
            <option value="inactivos">Estado: Inactivos</option>
          </select>

          <input
            type="text"
            style={styles.input}
            placeholder="Buscar: Email, DNI o Nombre…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.meta}>Tip: los campos se guardan al salir del input.</div>
      </div>

      <div style={styles.listWrap}>
        <div style={styles.listScroll}>
          {usuariosFiltrados.length === 0 ? (
            <div style={styles.empty}>No hay usuarios que coincidan con el filtro.</div>
          ) : (
            usuariosFiltrados.map((user, idx) => {
              const rol = safeRole(user.rol);
              const isSelf = user.id === currentUser?.uid;

              const isStaff = rol !== "ciudadano";
              const activo = user.activo === false ? false : true;

              const canHaveModulo =
                rol !== "ciudadano" && rol !== "pantalla" && rol !== "kiosko";

              const canHaveSkills = rol === "agente" || rol === "admin";
              const selectedSkills = canHaveSkills ? getSelectedTramites(user) : [];

              const expanded = expandedUid === user.id;
              const skillsOpen = skillsOpenUid === user.id;

              return (
                <React.Fragment key={user.id}>
                  <div style={{ ...styles.row, ...(idx % 2 ? styles.rowAlt : null) }}>
                    <div style={styles.colMain}>
                      <div style={styles.email}>{user.email || "(sin email)"}</div>
                      <div style={styles.sub}>
                        {isStaff
                          ? user.nombreCompleto || "—"
                          : `DNI: ${user.dni || "—"}`}
                      </div>
                    </div>

                    <div>
                      <span style={styles.badge}>{getRoleLabel(rol)}</span>
                      {STAFF_ROLES.includes(rol) && user.email && !isInstitutionalEmail(user.email) && (
                        <div style={{ ...styles.sub, marginTop: 6, color: UI.brand }}>
                          Email no institucional
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={styles.sub}>Módulo</div>
                      <div style={{ fontWeight: 900, color: UI.ink }}>
                        {canHaveModulo ? (user.moduloAsignado || "—") : "N/A"}
                      </div>
                    </div>

                    <div>
                      <div style={styles.sub}>Estado</div>
                      <div style={styles.toggleRow}>
                        {isStaff ? (
                          <>
                            <input
                              type="checkbox"
                              style={styles.toggle}
                              checked={activo}
                              disabled={isSelf}
                              onChange={(e) => handleActivoChange(user.id, e.target.checked)}
                              title={isSelf ? "No puedes desactivarte a ti mismo" : "Cambiar estado"}
                            />
                            <span
                              style={{
                                ...styles.badge,
                                ...(activo ? styles.badgeActive : styles.badgeInactive),
                              }}
                            >
                              {activo ? "Activo" : "Inactivo"}
                            </span>
                          </>
                        ) : (
                          <span style={{ ...styles.badge, background: UI.bg }}>—</span>
                        )}
                      </div>
                      {isSelf && isStaff && (
                        <div style={styles.sub}>No puedes desactivarte a ti mismo.</div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        style={styles.btn("ghost")}
                        onClick={() => {
                          setExpandedUid(expanded ? null : user.id);
                          if (expanded) setSkillsOpenUid(null);
                        }}
                      >
                        {expanded ? "Cerrar" : "Editar"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={styles.expand}>
                      {/* DATOS */}
                      <div style={styles.section}>
                        <div style={styles.sectionTitle}>Datos del usuario</div>

                        <div style={styles.formGrid}>
                          <div style={{ ...styles.field, gridColumn: "span 4" }}>
                            <div style={styles.fieldLabel}>Nombre completo</div>
                            <input
                              type="text"
                              style={styles.fieldInput}
                              defaultValue={user.nombreCompleto || ""}
                              placeholder={isStaff ? "Nombre completo" : "—"}
                              disabled={!isStaff}
                              onBlur={(e) => handleNombreChange(user.id, e.target.value)}
                            />
                          </div>

                          <div style={{ ...styles.field, gridColumn: "span 3" }}>
                            <div style={styles.fieldLabel}>Teléfono</div>
                            <input
                              type="text"
                              style={styles.fieldInput}
                              defaultValue={user.telefono || ""}
                              placeholder={isStaff ? "+56 9 ..." : "—"}
                              disabled={!isStaff}
                              onBlur={(e) => handleTelefonoChange(user.id, e.target.value)}
                            />
                          </div>

                          <div style={{ ...styles.field, gridColumn: "span 3" }}>
                            <div style={styles.fieldLabel}>Rol</div>
                            <select
                              style={styles.fieldInput}
                              value={rol}
                              disabled={isSelf}
                              onChange={(e) => handleRolChange(user.id, e.target.value)}
                            >
                              <option value="ciudadano">Ciudadano</option>
                              <option value="agente">Agente</option>
                              <option value="admin">Admin</option>
                              <option value="pantalla">Pantalla TV</option>
                              <option value="kiosko">Kiosko</option>
                            </select>
                          </div>

                          <div style={{ ...styles.field, gridColumn: "span 2" }}>
                            <div style={styles.fieldLabel}>Módulo</div>
                            <input
                              type="number"
                              style={styles.fieldInput}
                              defaultValue={user.moduloAsignado || ""}
                              placeholder="N/A"
                              disabled={!canHaveModulo}
                              onBlur={(e) => handleModuloChange(user.id, e.target.value)}
                            />
                          </div>
                        </div>

                        <div style={styles.help}>
                          * Nombre / teléfono / módulo se guardan al salir del campo. <br />
                          * Rol de staff requiere correo institucional.
                        </div>
                      </div>

                      {/* HABILIDADES */}
                      {canHaveSkills && (
                        <div style={styles.section}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <div style={styles.sectionTitle}>Habilidades (trámites que atiende)</div>
                              <div style={styles.sub}>
                                Seleccionadas: <b>{selectedSkills.length}</b>
                              </div>
                            </div>

                            <button
                              style={styles.btn("ghost")}
                              onClick={() => setSkillsOpenUid(skillsOpen ? null : user.id)}
                            >
                              {skillsOpen ? "Ocultar" : "Editar habilidades"}
                            </button>
                          </div>

                          {selectedSkills.length > 0 ? (
                            <div style={{ ...styles.chips, marginTop: 10 }}>
                              {selectedSkills.slice(0, 8).map((name) => (
                                <span key={name} style={styles.chip}>
                                  {name}
                                </span>
                              ))}
                              {selectedSkills.length > 8 && (
                                <span style={styles.chip}>+{selectedSkills.length - 8}</span>
                              )}
                            </div>
                          ) : (
                            <div style={{ ...styles.sub, marginTop: 10 }}>
                              No tiene habilidades asignadas.
                            </div>
                          )}

                          {skillsOpen && (
                            <div style={styles.skillsList}>
                              {tramites.map((t) => {
                                const checked = user.habilidades?.includes(t.id) || false;
                                return (
                                  <label key={t.id} style={styles.skillRow}>
                                    <input
                                      type="checkbox"
                                      style={styles.checkbox}
                                      checked={checked}
                                      onChange={(e) =>
                                        handleHabilidadChange(user.id, t.id, e.target.checked)
                                      }
                                    />
                                    {t.nombre || t.id}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* CONTRASEÑA */}
                      {isStaff && (
                        <div style={styles.section}>
                          <div style={styles.sectionTitle}>Contraseña (Firebase Auth)</div>

                          <div style={styles.pwdRow}>
                            <input
                              type="password"
                              style={styles.pwdInput}
                              placeholder="Nueva contraseña (mín. 6)"
                              value={pwdByUid[user.id] || ""}
                              onChange={(e) => handlePwdChange(user.id, e.target.value)}
                              disabled={!!savingPwdByUid[user.id]}
                            />
                            <button
                              style={styles.btn("primary")}
                              onClick={() => handleGuardarPwd(user.id)}
                              disabled={!!savingPwdByUid[user.id]}
                            >
                              {savingPwdByUid[user.id] ? "Guardando..." : "Guardar contraseña"}
                            </button>
                          </div>

                          <div style={styles.help}>
                            Esta acción cambia la contraseña del usuario en Firebase Auth.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}