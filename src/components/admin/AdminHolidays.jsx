// src/components/admin/AdminHolidays.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import "./AdminTheme.css";

/* ---------------- Helpers fechas / ids ---------------- */
function parseISODateToUTCDate(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
}
function toISODateUTC(date) {
  return date.toISOString().slice(0, 10);
}
function eachDayISOInclusive(startISO, endISO) {
  const start = parseISODateToUTCDate(startISO);
  const end = parseISODateToUTCDate(endISO);
  const out = [];
  let cur = new Date(start);
  while (cur <= end) {
    out.push(toISODateUTC(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
function isNextDay(prevISO, nextISO) {
  const d = parseISODateToUTCDate(prevISO);
  d.setUTCDate(d.getUTCDate() + 1);
  return toISODateUTC(d) === nextISO;
}
function buildFeriadoDocId(fechaISO, pais) {
  return `${fechaISO}__${pais || "AMBOS"}`;
}

/* ---------------- UI ---------------- */
const UI = {
  ink: "var(--text-primary)",
  muted: "var(--text-secondary)",
  border: "var(--border-soft)",
  borderStrong: "var(--border-strong)",
  panel: "var(--surface-card)",
  bg: "var(--surface-subcard)",
  bgPage: "var(--surface-page)",
  bgRow: "var(--surface-row)",
  bgRowAlt: "var(--surface-row-alt)",
  brand: "var(--brand-primary)",
  blue: "var(--brand-primary)",
  success: "var(--success-strong)",
  successSoft: "var(--success-soft)",
  danger: "var(--danger-strong)",
  dangerSoft: "var(--danger-soft)",
  shadow: "var(--shadow-card)",
};

const styles = {
  module: {
    display: "flex",
    flexDirection: "column",
  },
  card: {
    background:
      "linear-gradient(180deg, rgba(41, 79, 118, 0.03), rgba(41, 79, 118, 0)) top / 100% 110px no-repeat, var(--surface-card)",
    borderRadius: 18,
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    padding: 20,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  meta: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    background: UI.bg,
    color: UI.muted,
    border: `1px solid ${UI.border}`,
    fontSize: 11,
    fontWeight: 800,
  },
  title: { fontSize: 16, fontWeight: 900, color: UI.ink, margin: 0 },
  subtitle: { fontSize: 12, fontWeight: 700, color: UI.muted, margin: 0 },
  sectionCard: {
    background: UI.bg,
    borderRadius: 16,
    border: `1px solid ${UI.border}`,
    padding: 14,
  },
  sectionCardSpaced: {
    marginTop: 14,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: 900, color: UI.ink, margin: 0 },
  sectionHint: { fontSize: 11, fontWeight: 700, color: UI.muted, margin: 0 },

  gridTop: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },

  segWrap: {
    display: "inline-flex",
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    overflow: "hidden",
    background: UI.panel,
  },
  segBtn: {
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 900,
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: UI.muted,
  },
  segBtnActive: {
    background: "rgba(41, 79, 118, 0.10)",
    color: UI.ink,
  },

  inputDate: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    minWidth: 170,
    background: UI.panel,
    color: UI.ink,
  },
  inputText: {
    flex: 1,
    minWidth: 240,
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: UI.panel,
    color: UI.ink,
  },
  select: {
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    minWidth: 150,
    background: UI.panel,
    color: UI.ink,
  },

  hint: { fontSize: 12, color: UI.muted, marginTop: -2 },

  btnPrimary: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    backgroundColor: UI.brand,
    color: "white",
  },
  btnSecondary: {
    padding: "10px 16px",
    borderRadius: 12,
    border: `1px solid ${UI.border}`,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    backgroundColor: UI.panel,
    color: UI.ink,
  },

  divider: { height: 1, background: UI.border, margin: "6px 0 0 0" },

  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterLeft: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },

  tableWrap: {
    marginTop: 10,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    overflow: "hidden",
    background: UI.bgPage,
  },
  tableScroll: {
    maxHeight: 520,
    overflow: "auto",
    background: UI.bgPage,
    padding: 8,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    textTransform: "uppercase",
    borderBottom: `1px solid ${UI.border}`,
    color: UI.muted,
    background: UI.bg,
  },
  td: {
    padding: "10px 12px",
    fontSize: 14,
    color: UI.ink,
    borderBottom: `1px solid ${UI.border}`,
    verticalAlign: "middle",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: `1px solid ${UI.border}`,
  },
  badgeActivo: { background: UI.successSoft, color: UI.success, borderColor: "var(--success-border)" },
  badgeInactivo: { background: UI.dangerSoft, color: UI.danger, borderColor: "var(--danger-border)" },

  btnSmall: {
    padding: "7px 10px",
    fontSize: 12,
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    marginRight: 8,
  },
  btnToggle: { background: UI.blue, color: "#fff" },
  btnDelete: { background: UI.danger, color: "#fff" },
  rowAlt: { background: UI.bgRowAlt },

  empty: { padding: 12, color: UI.muted, fontWeight: 900 },
  footerHint: { marginTop: 8, fontSize: 12, color: UI.muted },
};

export default function AdminHolidays() {
  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form “unificado”
  const [accion, setAccion] = useState("bloquear"); // bloquear | desbloquear
  const [alcance, setAlcance] = useState("rango"); // dia | rango
  const [pais, setPais] = useState("AMBOS");
  const [descripcion, setDescripcion] = useState("Cierre temporal");
  const [fechaISO, setFechaISO] = useState("");
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");
  const [modoDesbloqueo, setModoDesbloqueo] = useState("desactivar"); // desactivar | eliminar
  const [busy, setBusy] = useState(false);

  // Filtros lista
  const [vista, setVista] = useState("detalle"); // detalle | resumen
  const [fEstado, setFEstado] = useState("todos"); // todos | activos | inactivos
  const [fPais, setFPais] = useState("todos"); // todos | AMBOS | CHILE | PERU
  const [search, setSearch] = useState("");

  // Escuchar colección
  useEffect(() => {
    const q = query(collection(db, "feriados"), orderBy("fechaISO", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFeriados(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Error al escuchar feriados:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const feriadosByKey = useMemo(() => {
    const map = new Map();
    for (const f of feriados) {
      const key = buildFeriadoDocId(f.fechaISO, f.pais || "AMBOS");
      map.set(key, f);
    }
    return map;
  }, [feriados]);

  const filtered = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return feriados.filter((f) => {
      if (fEstado === "activos" && !f.activo) return false;
      if (fEstado === "inactivos" && f.activo) return false;
      if (fPais !== "todos" && (f.pais || "AMBOS") !== fPais) return false;
      if (!s) return true;
      const hay =
        (f.fechaISO || "").toLowerCase().includes(s) ||
        (f.descripcion || "").toLowerCase().includes(s) ||
        (f.pais || "").toLowerCase().includes(s);
      return hay;
    });
  }, [feriados, fEstado, fPais, search]);

  // Resumen por rangos (misma desc+pais+activo y días consecutivos)
  const grouped = useMemo(() => {
    if (filtered.length === 0) return [];
    const arr = [...filtered].sort((a, b) => (a.fechaISO || "").localeCompare(b.fechaISO || ""));
    const groups = [];
    let cur = null;

    for (const f of arr) {
      const k = `${f.pais || "AMBOS"}|${f.descripcion || ""}|${!!f.activo}`;
      if (
        !cur ||
        cur.key !== k ||
        !isNextDay(cur.endISO, f.fechaISO)
      ) {
        cur = {
          key: k,
          pais: f.pais || "AMBOS",
          descripcion: f.descripcion || "",
          activo: !!f.activo,
          startISO: f.fechaISO,
          endISO: f.fechaISO,
          count: 1,
          ids: [f.id],
        };
        groups.push(cur);
      } else {
        cur.endISO = f.fechaISO;
        cur.count += 1;
        cur.ids.push(f.id);
      }
    }

    return groups;
  }, [filtered]);

  const hintText = useMemo(() => {
    if (accion === "bloquear") {
      return "Bloquea el agendamiento (tu Cloud Function revisa feriados por fechaISO + activo).";
    }
    return modoDesbloqueo === "eliminar"
      ? "Desbloquear (eliminar) borra los documentos del rango."
      : "Desbloquear (desactivar) deja el registro pero lo marca como inactivo.";
  }, [accion, modoDesbloqueo]);

  /* ---------------- Acciones CRUD ---------------- */
  const upsertBloqueoDia = async () => {
    if (!fechaISO) return alert("Seleccione una fecha.");
    const id = buildFeriadoDocId(fechaISO, pais);

    await setDoc(
      doc(db, "feriados", id),
      {
        fechaISO,
        descripcion: (descripcion || "").trim() || "Feriado",
        pais,
        activo: true,
        tipo: "bloqueo",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const desbloquearDia = async () => {
    if (!fechaISO) return alert("Seleccione una fecha.");
    const key = buildFeriadoDocId(fechaISO, pais);
    const f = feriadosByKey.get(key);
    if (!f) return alert("No existe un bloqueo para esa fecha / país.");

    const ref = doc(db, "feriados", f.id);
    if (modoDesbloqueo === "eliminar") await deleteDoc(ref);
    else await updateDoc(ref, { activo: false });
  };

  const bloquearRango = async () => {
    if (!startISO || !endISO) return alert("Selecciona fecha inicio y fin.");
    if (startISO > endISO) return alert("La fecha inicio no puede ser mayor que la fecha fin.");

    const ok = window.confirm(
      `Esto bloqueará desde ${startISO} hasta ${endISO} (${pais}).\n¿Continuar?`
    );
    if (!ok) return;

    const days = eachDayISOInclusive(startISO, endISO);
    const batch = writeBatch(db);

    for (const d of days) {
      const id = buildFeriadoDocId(d, pais);
      batch.set(
        doc(db, "feriados", id),
        {
          fechaISO: d,
          descripcion: (descripcion || "").trim() || "Cierre temporal",
          pais,
          activo: true,
          tipo: "bloqueo_rango",
          rango: { startISO, endISO },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  };

  const desbloquearRango = async () => {
    if (!startISO || !endISO) return alert("Selecciona fecha inicio y fin.");
    if (startISO > endISO) return alert("La fecha inicio no puede ser mayor que la fecha fin.");

    const ok = window.confirm(
      `Esto desbloqueará desde ${startISO} hasta ${endISO} (${pais}).\nModo: ${modoDesbloqueo}.\n¿Continuar?`
    );
    if (!ok) return;

    const days = eachDayISOInclusive(startISO, endISO);
    const batch = writeBatch(db);

    for (const d of days) {
      const key = buildFeriadoDocId(d, pais);
      const f = feriadosByKey.get(key);
      if (!f) continue;

      const ref = doc(db, "feriados", f.id);
      if (modoDesbloqueo === "eliminar") batch.delete(ref);
      else batch.update(ref, { activo: false });
    }

    await batch.commit();
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      if (alcance === "dia") {
        if (accion === "bloquear") await upsertBloqueoDia();
        else await desbloquearDia();
      } else {
        if (accion === "bloquear") await bloquearRango();
        else await desbloquearRango();
      }
    } catch (e) {
      console.error("Error acción feriados:", e);
      alert("Ocurrió un error. Revisa consola.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActivo = async (f) => {
    try {
      await updateDoc(doc(db, "feriados", f.id), { activo: !f.activo });
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado.");
    }
  };

  const handleDelete = async (f) => {
    const ok = window.confirm(`¿Seguro que deseas eliminar el feriado del ${f.fechaISO}?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "feriados", f.id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  // Acciones por grupo (vista resumen)
  const handleGroupToggle = async (g) => {
    const ok = window.confirm(
      `¿Cambiar estado de todo el rango?\n${g.startISO} → ${g.endISO} (${g.count} días)\n`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const id of g.ids) {
        batch.update(doc(db, "feriados", id), { activo: !g.activo });
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del rango.");
    } finally {
      setBusy(false);
    }
  };

  const handleGroupDelete = async (g) => {
    const ok = window.confirm(
      `¿Eliminar TODO el rango?\n${g.startISO} → ${g.endISO} (${g.count} días)\n`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const id of g.ids) batch.delete(doc(db, "feriados", id));
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el rango.");
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = useMemo(() => {
    if (busy) return "Procesando...";
    if (accion === "bloquear") return alcance === "dia" ? "Bloquear día" : "Bloquear rango";
    return alcance === "dia" ? "Aplicar desbloqueo" : "Aplicar desbloqueo";
  }, [accion, alcance, busy]);

  return (
    <div className="admin-theme-shell" style={styles.module}>
    <div style={styles.card}>
      <div style={styles.title}>Gestión de Feriados / Días Bloqueados</div>

      <div style={styles.headerRow}>
        <div style={styles.titleBlock}>
          <div style={styles.subtitle}>
            Configura cierres operativos y administra bloques por dÃ­a o rango con una vista mÃ¡s clara.
          </div>
        </div>
        <div style={styles.meta}>{feriados.length} registros</div>
      </div>

      {/* FORM UNIFICADO */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <p style={styles.sectionTitle}>Configuracion operativa</p>
          <p style={styles.sectionHint}>Define bloqueo o desbloqueo antes de aplicarlo.</p>
        </div>

        <div style={styles.gridTop}>
        <div style={styles.row}>
          <div style={styles.segWrap}>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(accion === "bloquear" ? styles.segBtnActive : null),
              }}
              onClick={() => setAccion("bloquear")}
            >
              Bloquear
            </button>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(accion === "desbloquear" ? styles.segBtnActive : null),
              }}
              onClick={() => setAccion("desbloquear")}
            >
              Desbloquear
            </button>
          </div>

          <div style={styles.segWrap}>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(alcance === "dia" ? styles.segBtnActive : null),
              }}
              onClick={() => setAlcance("dia")}
            >
              Un día
            </button>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(alcance === "rango" ? styles.segBtnActive : null),
              }}
              onClick={() => setAlcance("rango")}
            >
              Rango
            </button>
          </div>

          <select className="admin-theme-control" value={pais} onChange={(e) => setPais(e.target.value)} style={styles.select}>
            <option value="AMBOS">Ambos</option>
            <option value="CHILE">Chile</option>
            <option value="PERU">Perú</option>
          </select>

          {accion === "desbloquear" && (
            <select
              className="admin-theme-control"
              value={modoDesbloqueo}
              onChange={(e) => setModoDesbloqueo(e.target.value)}
              style={styles.select}
              title="Desactivar mantiene el registro (activo=false). Eliminar borra el documento."
            >
              <option value="desactivar">Desactivar</option>
              <option value="eliminar">Eliminar</option>
            </select>
          )}
        </div>

        <div style={styles.hint}>{hintText}</div>

        <div style={styles.row}>
          {alcance === "dia" ? (
            <>
              <input
                type="date"
                className="admin-theme-control"
                value={fechaISO}
                onChange={(e) => setFechaISO(e.target.value)}
                style={styles.inputDate}
              />

              {accion === "bloquear" && (
                <input
                  type="text"
                  className="admin-theme-control"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción (opcional)"
                  style={styles.inputText}
                />
              )}
            </>
          ) : (
            <>
              <input
                type="date"
                className="admin-theme-control"
                value={startISO}
                onChange={(e) => setStartISO(e.target.value)}
                style={styles.inputDate}
              />
              <input
                type="date"
                className="admin-theme-control"
                value={endISO}
                onChange={(e) => setEndISO(e.target.value)}
                style={styles.inputDate}
              />

              {accion === "bloquear" && (
                <input
                  type="text"
                  className="admin-theme-control"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción (ej: Cierre temporal)"
                  style={styles.inputText}
                />
              )}
            </>
          )}

          <button
            type="button"
            style={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={busy}
          >
            {actionLabel}
          </button>

          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => {
              setFechaISO("");
              setStartISO("");
              setEndISO("");
              setDescripcion("Cierre temporal");
            }}
            disabled={busy}
          >
            Limpiar
          </button>
        </div>

        <div style={styles.divider} />
        </div>
      </div>

      {/* LISTADO */}
      <div style={{ ...styles.sectionCard, ...styles.sectionCardSpaced }}>
        <div style={styles.sectionHeader}>
          <p style={styles.sectionTitle}>Bloqueos configurados</p>
          <p style={styles.sectionHint}>
            Alterna entre detalle y resumen para revisar el calendario operativo.
          </p>
        </div>
        <div style={styles.filterBar}>
          <div style={styles.filterLeft}>
            <select className="admin-theme-control" value={vista} onChange={(e) => setVista(e.target.value)} style={styles.select}>
              <option value="detalle">Vista: Detalle</option>
              <option value="resumen">Vista: Resumen por rangos</option>
            </select>

            <select
              className="admin-theme-control"
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
              style={styles.select}
            >
              <option value="todos">Estado: Todos</option>
              <option value="activos">Estado: Activo</option>
              <option value="inactivos">Estado: Inactivo</option>
            </select>

            <select
              className="admin-theme-control"
              value={fPais}
              onChange={(e) => setFPais(e.target.value)}
              style={styles.select}
            >
              <option value="todos">País: Todos</option>
              <option value="AMBOS">AMBOS</option>
              <option value="CHILE">CHILE</option>
              <option value="PERU">PERU</option>
            </select>

            <input
              className="admin-theme-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar (fecha, descripción, país)"
              style={{ ...styles.inputText, minWidth: 260 }}
            />
          </div>

          <div style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>
            {vista === "detalle"
              ? `${filtered.length} registros`
              : `${grouped.length} rangos (${filtered.length} días)`}
          </div>
        </div>

        <div style={styles.tableWrap}>
          <div className="admin-theme-scroll" style={styles.tableScroll}>
            {loading ? (
              <div style={styles.empty}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div style={styles.empty}>No hay feriados configurados.</div>
            ) : vista === "detalle" ? (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Descripción</th>
                    <th style={styles.th}>País</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, idx) => (
                    <tr key={f.id} style={idx % 2 ? styles.rowAlt : undefined}>
                      <td style={styles.td}>{f.fechaISO}</td>
                      <td style={styles.td}>{f.descripcion}</td>
                      <td style={styles.td}>{f.pais || "AMBOS"}</td>
                      <td style={styles.td}>
                        {f.activo ? (
                          <span style={{ ...styles.badge, ...styles.badgeActivo }}>Activo</span>
                        ) : (
                          <span style={{ ...styles.badge, ...styles.badgeInactivo }}>Inactivo</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <button
                          style={{ ...styles.btnSmall, ...styles.btnToggle }}
                          onClick={() => handleToggleActivo(f)}
                          disabled={busy}
                        >
                          {f.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          style={{ ...styles.btnSmall, ...styles.btnDelete }}
                          onClick={() => handleDelete(f)}
                          disabled={busy}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Rango</th>
                    <th style={styles.th}>Días</th>
                    <th style={styles.th}>Descripción</th>
                    <th style={styles.th}>País</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g, idx) => (
                    <tr key={`${g.key}_${g.startISO}_${g.endISO}`} style={idx % 2 ? styles.rowAlt : undefined}>
                      <td style={styles.td}>
                        {g.startISO} → {g.endISO}
                      </td>
                      <td style={styles.td}>{g.count}</td>
                      <td style={styles.td}>{g.descripcion || "—"}</td>
                      <td style={styles.td}>{g.pais}</td>
                      <td style={styles.td}>
                        {g.activo ? (
                          <span style={{ ...styles.badge, ...styles.badgeActivo }}>Activo</span>
                        ) : (
                          <span style={{ ...styles.badge, ...styles.badgeInactivo }}>Inactivo</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <button
                          style={{ ...styles.btnSmall, ...styles.btnToggle }}
                          onClick={() => handleGroupToggle(g)}
                          disabled={busy}
                        >
                          {g.activo ? "Desactivar todo" : "Activar todo"}
                        </button>
                        <button
                          style={{ ...styles.btnSmall, ...styles.btnDelete }}
                          onClick={() => handleGroupDelete(g)}
                          disabled={busy}
                        >
                          Eliminar todo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={styles.footerHint}>
          Tip: usa <b>Resumen por rangos</b> para no ver una lista eterna cuando bloqueas meses completos.
        </div>
      </div>
      </div>
    </div>
  );
}
