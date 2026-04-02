// src/components/admin/AdminAgents.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import "./AdminTheme.css";
import "./AdminAgents.css";

const ALLOWED_STAFF_DOMAINS = ["@consulperu.pe"];
const STAFF_ROLES = ["agente", "admin", "pantalla", "kiosko"];

const UI = {
  ink: "var(--text-primary)",
  muted: "var(--text-secondary)",
  border: "var(--border-soft)",
  borderStrong: "var(--border-strong)",
  panel: "var(--surface-card)",
  bg: "var(--surface-subcard)",
  bgSoft: "var(--surface-muted)",
  brand: "var(--warning-strong)",
  brandSoft: "var(--warning-soft)",
  blue: "var(--brand-primary)",
  success: "var(--success-strong)",
  successSoft: "var(--success-soft)",
  danger: "var(--danger-strong)",
  dangerSoft: "var(--danger-soft)",
  shadow: "var(--shadow-card)",
};

const styles = {
  card: {
    backgroundColor: UI.panel,
    borderRadius: 18,
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    padding: 18,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  titleBlock: { display: "flex", flexDirection: "column", gap: 3 },
  title: { fontSize: 16, fontWeight: 900, color: UI.ink, margin: 0 },
  subtitle: { fontSize: 12, color: UI.muted, fontWeight: 700, margin: 0 },
  meta: {
    fontSize: 11,
    fontWeight: 800,
    color: UI.muted,
    background: UI.bg,
    border: `1px solid ${UI.border}`,
    borderRadius: 999,
    padding: "5px 9px",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterLeft: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  label: { fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" },
  select: {
    border: `1px solid ${UI.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    background: UI.panel,
    minWidth: 210,
    color: UI.ink,
  },
  selectSmall: {
    border: `1px solid ${UI.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    background: UI.panel,
    minWidth: 150,
    color: UI.ink,
  },
  input: {
    border: `1px solid ${UI.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    background: UI.panel,
    minWidth: 240,
    color: UI.ink,
  },
  filterHint: { fontSize: 11, fontWeight: 700, color: UI.muted },
  listWrap: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    overflow: "hidden",
    background: "var(--surface-page)",
  },
  listScroll: {
    maxHeight: 620,
    overflow: "auto",
    background: "var(--surface-page)",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.4fr) 0.8fr 0.7fr 0.9fr auto",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid transparent",
    alignItems: "center",
  },
  rowAlt: { background: "var(--surface-row-alt)" },
  colMain: { minWidth: 0 },
  email: {
    fontWeight: 900,
    color: UI.ink,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
  },
  sub: { fontSize: 11, fontWeight: 700, color: UI.muted, marginTop: 2 },
  valueLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: UI.muted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  valueText: { fontSize: 13, fontWeight: 800, color: UI.ink },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    border: `1px solid ${UI.border}`,
    width: "fit-content",
    background: UI.bg,
    color: UI.ink,
  },
  badgeActive: { background: UI.successSoft, color: UI.success, borderColor: "var(--success-border)" },
  badgeInactive: { background: UI.dangerSoft, color: UI.danger, borderColor: "var(--danger-border)" },
  warningText: { fontSize: 11, fontWeight: 700, color: UI.brand, marginTop: 4 },
  rowActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  btn: (variant = "primary") => {
    const base = {
      border: "none",
      borderRadius: 10,
      padding: "8px 11px",
      fontSize: 12,
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      transition: "background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease",
    };
    if (variant === "primary") return { ...base, background: UI.blue, color: "#fff" };
    if (variant === "ghost") return { ...base, background: "var(--surface-subcard)", color: UI.ink, border: `1px solid ${UI.borderStrong}` };
    if (variant === "danger") return { ...base, background: UI.brand, color: "#fff" };
    if (variant === "success") return { ...base, background: UI.success, color: "#fff" };
    return base;
  },
  expand: {
    padding: 12,
    borderBottom: "1px solid transparent",
    background: "var(--surface-expanded)",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },
  editorTitle: { fontSize: 14, fontWeight: 900, color: UI.ink, margin: 0 },
  editorMeta: { fontSize: 11, fontWeight: 700, color: UI.muted, margin: 0 },
  dirtyBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
    background: UI.brandSoft,
    color: UI.brand,
    border: "1px solid var(--warning-border)",
  },
  editorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: 10,
  },
  section: {
    border: "1px solid var(--border-strong)",
    borderRadius: 14,
    padding: 12,
    background: UI.bg,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: 900, color: UI.ink, textTransform: "uppercase", letterSpacing: "0.04em" },
  sectionHint: { fontSize: 11, fontWeight: 700, color: UI.muted },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: 10,
    alignItems: "start",
  },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: 800, color: UI.muted },
  fieldInput: {
    border: `1px solid ${UI.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    background: UI.panel,
    color: UI.ink,
    minHeight: 38,
    boxSizing: "border-box",
  },
  fieldInputDisabled: { background: UI.bgSoft, color: UI.muted },
  inlineRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  switchRow: { display: "flex", alignItems: "center", gap: 8, minHeight: 38 },
  toggle: { width: 16, height: 16, accentColor: UI.blue },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    background: UI.bg,
    fontSize: 11,
    fontWeight: 800,
    color: UI.ink,
  },
  skillsList: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 8,
  },
  skillRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    color: UI.ink,
    padding: "8px 9px",
    borderRadius: 10,
    border: `1px solid ${UI.border}`,
    background: UI.panel,
  },
  checkbox: { width: 15, height: 15, accentColor: UI.blue },
  help: { fontSize: 11, color: UI.muted, fontWeight: 700, lineHeight: 1.35 },
  statusBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  actionsBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
  },
  actionsLeft: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  actionsRight: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  pwdRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pwdInput: {
    border: `1px solid ${UI.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    background: UI.panel,
    minWidth: 220,
    minHeight: 38,
    color: UI.ink,
  },
  empty: { padding: 14, color: UI.muted, fontWeight: 800, fontSize: 13 },
};

const isInstitutionalEmail = (email = "") =>
  ALLOWED_STAFF_DOMAINS.some((domain) =>
    String(email || "").toLowerCase().endsWith(domain.toLowerCase())
  );

const safeRole = (value) => (value ? String(value).toLowerCase() : "ciudadano");
const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizeDoc = (value) => normalizeText(value).replace(/\s+/g, "").toUpperCase();
const normalizeModuloDraft = (value) => normalizeText(value);
const normalizeSkills = (value) =>
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];

function buildDraftFromUser(user = {}) {
  return {
    email: normalizeEmail(user.email),
    dni: normalizeDoc(user.dni || user.rut || user.docNorm || ""),
    nombreCompleto: normalizeText(user.nombreCompleto || user.nombre || ""),
    telefono: normalizeText(user.telefono || ""),
    rol: safeRole(user.rol),
    moduloAsignado: normalizeModuloDraft(user.moduloAsignado),
    activo: user.activo === false ? false : true,
    habilidades: normalizeSkills(user.habilidades),
  };
}

function normalizeDraftForCompare(draft = {}) {
  return {
    email: normalizeEmail(draft.email),
    dni: normalizeDoc(draft.dni),
    nombreCompleto: normalizeText(draft.nombreCompleto),
    telefono: normalizeText(draft.telefono),
    rol: safeRole(draft.rol),
    moduloAsignado: normalizeModuloDraft(draft.moduloAsignado),
    activo: !!draft.activo,
    habilidades: [...normalizeSkills(draft.habilidades)].sort(),
  };
}

function areDraftsEqual(left = {}, right = {}) {
  const a = normalizeDraftForCompare(left);
  const b = normalizeDraftForCompare(right);
  return (
    a.email === b.email &&
    a.dni === b.dni &&
    a.nombreCompleto === b.nombreCompleto &&
    a.telefono === b.telefono &&
    a.rol === b.rol &&
    a.moduloAsignado === b.moduloAsignado &&
    a.activo === b.activo &&
    JSON.stringify(a.habilidades) === JSON.stringify(b.habilidades)
  );
}

function getRoleLabel(rol) {
  if (rol === "admin") return "Admin";
  if (rol === "agente") return "Agente";
  if (rol === "pantalla") return "Pantalla TV";
  if (rol === "kiosko") return "Kiosko";
  return "Ciudadano";
}

function getStatusTone(type) {
  if (type === "success") {
    return { background: UI.successSoft, color: UI.success, border: "1px solid var(--success-border)" };
  }
  if (type === "error") {
    return { background: UI.dangerSoft, color: UI.danger, border: "1px solid var(--danger-border)" };
  }
  return { background: UI.bgSoft, color: UI.muted, border: `1px solid ${UI.border}` };
}

export default function AdminAgents() {
  const { currentUser } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTramites, setLoadingTramites] = useState(true);

  const [filtroRol, setFiltroRol] = useState("staff");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedUid, setExpandedUid] = useState(null);
  const [skillsOpenUid, setSkillsOpenUid] = useState(null);
  const [draftByUid, setDraftByUid] = useState({});
  const [baselineByUid, setBaselineByUid] = useState({});
  const [statusByUid, setStatusByUid] = useState({});
  const [savingByUid, setSavingByUid] = useState({});

  const [pwdByUid, setPwdByUid] = useState({});
  const [savingPwdByUid, setSavingPwdByUid] = useState({});

  const adminUpdateAgente = useMemo(
    () => httpsCallable(functions, "adminUpdateAgente"),
    []
  );

  useEffect(() => {
    setLoadingTramites(true);
    const q = query(collection(db, "tramites"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTramites(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoadingTramites(false);
      },
      (error) => {
        console.error("Error al escuchar tramites:", error);
        setLoadingTramites(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoadingUsers(true);

    let q = query(collection(db, "usuarios"));
    if (filtroRol === "staff") {
      q = query(collection(db, "usuarios"), where("rol", "in", STAFF_ROLES));
    } else if (filtroRol !== "todos") {
      q = query(collection(db, "usuarios"), where("rol", "==", filtroRol));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsuarios(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoadingUsers(false);
      },
      (error) => {
        console.error("Error al escuchar usuarios:", error);
        setLoadingUsers(false);
      }
    );

    return () => unsub();
  }, [filtroRol]);

  const tramitesMap = useMemo(
    () => new Map(tramites.map((item) => [item.id, item.nombre || item.id])),
    [tramites]
  );

  const usuariosFiltrados = useMemo(() => {
    const term = normalizeText(searchTerm).toLowerCase();

    return usuarios
      .filter((user) => {
        const rol = safeRole(user.rol);
        const activo = user.activo === false ? false : true;

        if (filtroEstado === "activos" && !activo) return false;
        if (filtroEstado === "inactivos" && activo) return false;

        if (term) {
          const emailMatch = normalizeEmail(user.email).includes(term);
          const dniMatch = normalizeDoc(user.dni || user.rut).toLowerCase().includes(term);
          const nombreMatch = normalizeText(user.nombreCompleto || user.nombre).toLowerCase().includes(term);
          if (!emailMatch && !dniMatch && !nombreMatch) return false;
        }

        if (filtroRol === "staff") return rol !== "ciudadano";
        if (filtroRol === "todos") return true;
        return rol === filtroRol;
      })
      .sort((a, b) => normalizeEmail(a.email).localeCompare(normalizeEmail(b.email)));
  }, [usuarios, filtroEstado, filtroRol, searchTerm]);

  const openEditor = (user) => {
    const nextDraft = buildDraftFromUser(user);
    setExpandedUid((current) => (current === user.id ? null : user.id));
    setSkillsOpenUid(null);
    setDraftByUid((prev) => ({ ...prev, [user.id]: nextDraft }));
    setBaselineByUid((prev) => ({ ...prev, [user.id]: nextDraft }));
    setStatusByUid((prev) => ({ ...prev, [user.id]: null }));
  };

  const handleDraftChange = (uid, field, value) => {
    setDraftByUid((prev) => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [field]: value,
      },
    }));
    setStatusByUid((prev) => ({ ...prev, [uid]: null }));
  };

  const handleSkillToggle = (uid, tramiteId, checked) => {
    setDraftByUid((prev) => {
      const currentDraft = prev[uid] || {};
      const currentSkills = normalizeSkills(currentDraft.habilidades);
      const nextSkills = checked
        ? [...new Set([...currentSkills, tramiteId])]
        : currentSkills.filter((item) => item !== tramiteId);

      return {
        ...prev,
        [uid]: {
          ...currentDraft,
          habilidades: nextSkills,
        },
      };
    });
    setStatusByUid((prev) => ({ ...prev, [uid]: null }));
  };

  const handleCancel = (uid) => {
    setDraftByUid((prev) => ({ ...prev, [uid]: baselineByUid[uid] || prev[uid] }));
    setStatusByUid((prev) => ({ ...prev, [uid]: null }));
    if (skillsOpenUid === uid) setSkillsOpenUid(null);
  };

  const handleSave = async (user) => {
    const uid = user.id;
    const draft = draftByUid[uid] || buildDraftFromUser(user);
    const payload = normalizeDraftForCompare(draft);

    try {
      setSavingByUid((prev) => ({ ...prev, [uid]: true }));
      setStatusByUid((prev) => ({ ...prev, [uid]: null }));

      await adminUpdateAgente({
        uid,
        updates: {
          email: payload.email,
          dni: payload.dni,
          nombreCompleto: payload.nombreCompleto,
          telefono: payload.telefono,
          rol: payload.rol,
          moduloAsignado: payload.moduloAsignado || null,
          activo: payload.activo,
          habilidades: payload.habilidades,
        },
      });

      setBaselineByUid((prev) => ({ ...prev, [uid]: payload }));
      setDraftByUid((prev) => ({ ...prev, [uid]: payload }));
      setStatusByUid((prev) => ({
        ...prev,
        [uid]: { type: "success", text: "Cambios guardados correctamente." },
      }));
    } catch (error) {
      console.error("Error al guardar cambios del staff:", error);
      setStatusByUid((prev) => ({
        ...prev,
        [uid]: {
          type: "error",
          text: normalizeText(error?.message) || "No se pudieron guardar los cambios del usuario.",
        },
      }));
    } finally {
      setSavingByUid((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const handlePwdChange = (uid, value) => {
    setPwdByUid((prev) => ({ ...prev, [uid]: value }));
  };

  const handleGuardarPwd = async (uid) => {
    const password = normalizeText(pwdByUid[uid]);
    if (!password) return alert("Ingresa una contrasena primero.");
    if (password.length < 6) return alert("La contrasena debe tener minimo 6 caracteres.");

    try {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: true }));
      await adminUpdateAgente({ uid, updates: {}, newPassword: password });
      setPwdByUid((prev) => ({ ...prev, [uid]: "" }));
      alert("Contrasena actualizada correctamente.");
    } catch (error) {
      console.error("Error al actualizar contrasena:", error);
      alert("No se pudo actualizar la contrasena. Revisa permisos y vuelve a intentar.");
    } finally {
      setSavingPwdByUid((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const renderSkillSummary = (draft) => {
    const selected = normalizeSkills(draft.habilidades);
    if (!selected.length) return <div style={styles.help}>No tiene habilidades asignadas.</div>;

    return (
      <div style={styles.chips}>
        {selected.slice(0, 8).map((item) => (
          <span key={item} style={styles.chip}>
            {tramitesMap.get(item) || item}
          </span>
        ))}
        {selected.length > 8 ? <span style={styles.chip}>+{selected.length - 8}</span> : null}
      </div>
    );
  };

  if (loadingUsers || loadingTramites) {
    return <p>Cargando usuarios y tramites...</p>;
  }

  return (
    <div className="admin-theme-shell admin-agents-shell" style={styles.card}>
      <div className="admin-agents-toolbar" style={styles.headerRow}>
        <div style={styles.titleBlock}>
          <h3 style={styles.title}>Administracion de personal</h3>
          <p style={styles.subtitle}>
            Gestiona staff interno con edicion explicita y cambios sensibles controlados.
          </p>
        </div>
        <div style={styles.meta}>{usuariosFiltrados.length} usuarios</div>
      </div>

      <div className="admin-agents-filters" style={styles.filterBar}>
        <div style={styles.filterLeft}>
          <span style={styles.label}>Mostrar:</span>
          <select
            className="admin-agents-control"
            style={styles.select}
            value={filtroRol}
            onChange={(event) => {
              setFiltroRol(event.target.value);
              setExpandedUid(null);
              setSkillsOpenUid(null);
            }}
          >
            <option value="staff">Solo personal interno</option>
            <option value="todos">Todos los usuarios</option>
            <option value="ciudadano">Solo ciudadanos</option>
            <option value="agente">Solo agentes</option>
            <option value="admin">Solo admins</option>
            <option value="pantalla">Solo pantalla TV</option>
            <option value="kiosko">Solo kiosko</option>
          </select>

          <select
            className="admin-agents-control"
            style={styles.selectSmall}
            value={filtroEstado}
            onChange={(event) => setFiltroEstado(event.target.value)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activos">Estado: Activos</option>
            <option value="inactivos">Estado: Inactivos</option>
          </select>

          <input
            type="text"
            className="admin-agents-control"
            style={styles.input}
            placeholder="Buscar por email, rut/dni o nombre"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div style={styles.filterHint}>La edicion se guarda solo con "Guardar cambios".</div>
      </div>

      <div className="admin-agents-list" style={styles.listWrap}>
        <div className="admin-agents-scroll" style={styles.listScroll}>
          {usuariosFiltrados.length === 0 ? (
            <div style={styles.empty}>No hay usuarios que coincidan con el filtro.</div>
          ) : (
            usuariosFiltrados.map((user, index) => {
              const rol = safeRole(user.rol);
              const isSelf = user.id === currentUser?.uid;
              const isStaff = STAFF_ROLES.includes(rol);
              const canEditUser = isStaff;
              const activo = user.activo === false ? false : true;
              const expanded = expandedUid === user.id;
              const draft = draftByUid[user.id] || buildDraftFromUser(user);
              const baseline = baselineByUid[user.id] || buildDraftFromUser(user);
              const draftRole = safeRole(draft.rol);
              const canHaveModulo = rol !== "ciudadano" && rol !== "pantalla" && rol !== "kiosko";
              const draftCanHaveModulo =
                draftRole !== "ciudadano" && draftRole !== "pantalla" && draftRole !== "kiosko";
              const draftCanHaveSkills = draftRole === "agente" || draftRole === "admin";
              const isDirty = expanded ? !areDraftsEqual(draft, baseline) : false;
              const status = statusByUid[user.id];
              const skillsOpen = skillsOpenUid === user.id;

              return (
                <div
                  key={user.id}
                  className={`admin-agents-record ${expanded ? "is-open" : ""}`}
                >
                  <div
                    className={`admin-agents-row ${expanded ? "is-open" : ""}`}
                    style={{ ...styles.row, ...(index % 2 ? styles.rowAlt : null) }}
                  >
                    <div style={styles.colMain}>
                      <div style={styles.email}>{user.email || "(sin email)"}</div>
                      <div style={styles.sub}>
                        {normalizeText(user.nombreCompleto || user.nombre) || "Sin nombre registrado"}
                      </div>
                      <div style={styles.sub}>
                        RUT/DNI: {normalizeText(user.dni || user.rut || user.docNorm) || "—"}
                      </div>
                    </div>

                    <div>
                      <div style={styles.valueLabel}>Rol</div>
                      <span style={styles.badge}>{getRoleLabel(rol)}</span>
                      {isStaff && user.email && !isInstitutionalEmail(user.email) ? (
                        <div style={styles.warningText}>Email no institucional</div>
                      ) : null}
                    </div>

                    <div>
                      <div style={styles.valueLabel}>Modulo</div>
                      <div style={styles.valueText}>
                        {canHaveModulo ? normalizeText(user.moduloAsignado) || "—" : "N/A"}
                      </div>
                    </div>

                    <div>
                      <div style={styles.valueLabel}>Estado</div>
                      <span
                        style={{
                          ...styles.badge,
                          ...(activo ? styles.badgeActive : styles.badgeInactive),
                        }}
                      >
                        {activo ? "Activo" : "Inactivo"}
                      </span>
                      {isSelf && isStaff ? (
                        <div style={styles.sub}>Tu cuenta conserva protecciones de autocambio.</div>
                      ) : null}
                    </div>

                    <div style={styles.rowActions}>
                      <button
                        style={styles.btn("ghost")}
                        onClick={() => openEditor(user)}
                        disabled={!canEditUser}
                        title={
                          canEditUser
                            ? expanded
                              ? "Cerrar editor"
                              : "Editar personal"
                            : "La edicion completa de esta vista aplica solo a personal interno"
                        }
                      >
                        {expanded ? "Cerrar" : "Editar"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="admin-agents-expand" style={styles.expand}>
                      <div className="admin-agents-editor-head" style={styles.editorHeader}>
                        <div>
                          <p style={styles.editorTitle}>Editar perfil interno</p>
                          <p style={styles.editorMeta}>
                            Los cambios se preparan en borrador local hasta confirmar "Guardar cambios".
                          </p>
                        </div>
                        {isDirty ? <span style={styles.dirtyBadge}>Cambios sin guardar</span> : null}
                      </div>

                      <div style={styles.editorGrid}>
                        <div
                          className="admin-agents-section"
                          style={{ ...styles.section, gridColumn: "span 12" }}
                        >
                          <div style={styles.sectionHeader}>
                            <div style={styles.sectionTitle}>Datos de acceso</div>
                            <div style={styles.sectionHint}>
                              El correo se sincroniza por backend con Firebase Auth y usuarios.
                            </div>
                          </div>

                          <div style={styles.formGrid}>
                            <div style={{ ...styles.field, gridColumn: "span 7" }}>
                              <div style={styles.fieldLabel}>Correo</div>
                              <input
                                type="email"
                                className="admin-agents-control"
                                style={{
                                  ...styles.fieldInput,
                                  ...(isSelf ? styles.fieldInputDisabled : null),
                                }}
                                value={draft.email}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "email", event.target.value)
                                }
                                disabled={isSelf}
                                placeholder="usuario@consulperu.pe"
                              />
                              {isSelf ? (
                                <div style={styles.help}>
                                  Para evitar problemas de sesion, el correo de tu propia cuenta se mantiene protegido aqui.
                                </div>
                              ) : null}
                            </div>

                            <div style={{ ...styles.field, gridColumn: "span 5" }}>
                              <div style={styles.fieldLabel}>RUT / DNI</div>
                              <input
                                type="text"
                                className="admin-agents-control"
                                style={styles.fieldInput}
                                value={draft.dni}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "dni", event.target.value.toUpperCase())
                                }
                                placeholder="Documento interno"
                              />
                            </div>
                          </div>
                        </div>

                        <div
                          className="admin-agents-section"
                          style={{ ...styles.section, gridColumn: "span 6" }}
                        >
                          <div style={styles.sectionHeader}>
                            <div style={styles.sectionTitle}>Datos personales</div>
                          </div>

                          <div style={styles.formGrid}>
                            <div style={{ ...styles.field, gridColumn: "span 12" }}>
                              <div style={styles.fieldLabel}>Nombre completo</div>
                              <input
                                type="text"
                                className="admin-agents-control"
                                style={styles.fieldInput}
                                value={draft.nombreCompleto}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "nombreCompleto", event.target.value)
                                }
                                placeholder="Nombre y apellidos"
                              />
                            </div>

                            <div style={{ ...styles.field, gridColumn: "span 12" }}>
                              <div style={styles.fieldLabel}>Telefono</div>
                              <input
                                type="text"
                                className="admin-agents-control"
                                style={styles.fieldInput}
                                value={draft.telefono}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "telefono", event.target.value)
                                }
                                placeholder="+56 9 ..."
                              />
                            </div>
                          </div>
                        </div>

                        <div
                          className="admin-agents-section"
                          style={{ ...styles.section, gridColumn: "span 6" }}
                        >
                          <div style={styles.sectionHeader}>
                            <div style={styles.sectionTitle}>Permisos operativos</div>
                            <div style={styles.sectionHint}>
                              Rol de staff requiere correo institucional.
                            </div>
                          </div>

                          <div style={styles.formGrid}>
                            <div style={{ ...styles.field, gridColumn: "span 5" }}>
                              <div style={styles.fieldLabel}>Rol</div>
                              <select
                                className="admin-agents-control"
                                style={{
                                  ...styles.fieldInput,
                                  ...(isSelf ? styles.fieldInputDisabled : null),
                                }}
                                value={draft.rol}
                                disabled={isSelf}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "rol", event.target.value)
                                }
                              >
                                <option value="agente">Agente</option>
                                <option value="admin">Admin</option>
                                <option value="pantalla">Pantalla TV</option>
                                <option value="kiosko">Kiosko</option>
                                <option value="ciudadano">Ciudadano</option>
                              </select>
                            </div>

                            <div style={{ ...styles.field, gridColumn: "span 4" }}>
                              <div style={styles.fieldLabel}>Modulo</div>
                              <input
                                type="text"
                                className="admin-agents-control"
                                style={{
                                  ...styles.fieldInput,
                                  ...(!draftCanHaveModulo ? styles.fieldInputDisabled : null),
                                }}
                                value={draft.moduloAsignado}
                                onChange={(event) =>
                                  handleDraftChange(user.id, "moduloAsignado", event.target.value)
                                }
                                disabled={!draftCanHaveModulo}
                                placeholder={draftCanHaveModulo ? "1" : "N/A"}
                              />
                            </div>

                            <div style={{ ...styles.field, gridColumn: "span 3" }}>
                              <div style={styles.fieldLabel}>Estado</div>
                              <div style={styles.switchRow}>
                                <input
                                  type="checkbox"
                                  style={styles.toggle}
                                  checked={!!draft.activo}
                                  disabled={isSelf}
                                  onChange={(event) =>
                                    handleDraftChange(user.id, "activo", event.target.checked)
                                  }
                                />
                                <span
                                  style={{
                                    ...styles.badge,
                                    ...(draft.activo ? styles.badgeActive : styles.badgeInactive),
                                  }}
                                >
                                  {draft.activo ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className="admin-agents-section"
                          style={{ ...styles.section, gridColumn: "span 12" }}
                        >
                          <div style={styles.sectionHeader}>
                            <div>
                              <div style={styles.sectionTitle}>Habilidades</div>
                              <div style={styles.sectionHint}>
                                Tramites habilitados para el usuario.
                              </div>
                            </div>

                            <div style={styles.inlineRow}>
                              <span style={styles.meta}>
                                {normalizeSkills(draft.habilidades).length} seleccionadas
                              </span>
                              <button
                                style={styles.btn("ghost")}
                                onClick={() =>
                                  setSkillsOpenUid((current) =>
                                    current === user.id ? null : user.id
                                  )
                                }
                              >
                                {skillsOpen ? "Ocultar detalle" : "Editar habilidades"}
                              </button>
                            </div>
                          </div>

                          {draftCanHaveSkills ? (
                            <>
                              {renderSkillSummary(draft)}
                              {skillsOpen ? (
                                <div className="admin-agents-skills" style={styles.skillsList}>
                                  {tramites.map((tramite) => {
                                    const checked = normalizeSkills(draft.habilidades).includes(tramite.id);
                                    return (
                                      <label
                                        key={tramite.id}
                                        className="admin-agents-skill-row"
                                        style={styles.skillRow}
                                      >
                                        <input
                                          type="checkbox"
                                          style={styles.checkbox}
                                          checked={checked}
                                          onChange={(event) =>
                                            handleSkillToggle(
                                              user.id,
                                              tramite.id,
                                              event.target.checked
                                            )
                                          }
                                        />
                                        {tramite.nombre || tramite.id}
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div style={styles.help}>
                              Este rol no utiliza habilidades operativas en la agenda actual.
                            </div>
                          )}
                        </div>

                        <div
                          className="admin-agents-section admin-agents-section--sensitive"
                          style={{ ...styles.section, gridColumn: "span 12" }}
                        >
                          <div style={styles.sectionHeader}>
                            <div style={styles.sectionTitle}>Acciones sensibles</div>
                            <div style={styles.sectionHint}>
                              La contrasena se actualiza de forma separada en Firebase Auth.
                            </div>
                          </div>

                          <div style={styles.pwdRow}>
                            <input
                              type="password"
                              className="admin-agents-control"
                              style={styles.pwdInput}
                              placeholder="Nueva contrasena (min. 6)"
                              value={pwdByUid[user.id] || ""}
                              onChange={(event) => handlePwdChange(user.id, event.target.value)}
                              disabled={!!savingPwdByUid[user.id]}
                            />
                            <button
                              style={styles.btn("primary")}
                              onClick={() => handleGuardarPwd(user.id)}
                              disabled={!!savingPwdByUid[user.id]}
                            >
                              {savingPwdByUid[user.id] ? "Guardando..." : "Guardar contrasena"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {status ? (
                        <div style={{ ...styles.statusBox, ...getStatusTone(status.type) }}>
                          {status.text}
                        </div>
                      ) : null}

                      <div style={styles.actionsBar}>
                        <div style={styles.actionsLeft}>
                          <div style={styles.help}>
                            Cancelar revierte el borrador local. Nada se persiste hasta confirmar.
                          </div>
                        </div>

                        <div style={styles.actionsRight}>
                          <button
                            style={styles.btn("ghost")}
                            onClick={() => handleCancel(user.id)}
                            disabled={!isDirty || !!savingByUid[user.id]}
                          >
                            Cancelar
                          </button>
                          <button
                            style={styles.btn("success")}
                            onClick={() => handleSave(user)}
                            disabled={!isDirty || !!savingByUid[user.id]}
                          >
                            {savingByUid[user.id] ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
