import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";

const adminUpdateArcoRequest = httpsCallable(functions, "adminUpdateArcoRequest");

const TYPE_LABELS = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación",
  oposicion: "Oposición",
};

const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  resuelta: "Resuelta",
  rechazada: "Rechazada",
};

const styles = {
  wrap: { padding: 10 },
  title: { margin: "0 0 12px", fontSize: 18, fontWeight: 900 },
  subtitle: { margin: "0 0 16px", color: "#555", lineHeight: 1.5 },
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.2fr",
    gap: 10,
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
    boxSizing: "border-box",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    padding: 10,
    background: "#f3f3f3",
    borderBottom: "1px solid #ddd",
    fontSize: 12,
  },
  td: {
    padding: 10,
    borderBottom: "1px solid #eee",
    fontSize: 13,
    verticalAlign: "top",
  },
  btn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnPrimary: { background: "#0d6efd", color: "#fff" },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  modal: {
    width: "min(760px, 100%)",
    background: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 900 },
  modalRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 },
  modalReadOnly: {
    width: "100%",
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 800,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    resize: "vertical",
    boxSizing: "border-box",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  error: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: 700,
  },
};

function fmtTs(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function getCallableErrorMessage(error, fallback) {
  const raw = error?.details || error?.message || "";
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  return cleaned || fallback;
}

export default function AdminArcoRequests() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [nextStatus, setNextStatus] = useState("pendiente");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "arcoRequests"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Error al cargar solicitudes ARCO:", err);
        setError("No se pudieron cargar las solicitudes ARCO.");
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (typeFilter && row.type !== typeFilter) return false;
      if (!term) return true;
      const haystack = [
        row.requesterName,
        row.requesterEmail,
        row.requesterDocument,
        row.details,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [rows, search, statusFilter, typeFilter]);

  const openDetail = (row) => {
    setSelected(row);
    setResolutionNotes(String(row.resolutionNotes || ""));
    setNextStatus(String(row.status || "pendiente"));
    setError("");
  };

  const closeModal = () => {
    setSelected(null);
    setResolutionNotes("");
    setNextStatus("pendiente");
  };

  const handleSave = async () => {
    if (!selected || saving) return;

    setSaving(true);
    setError("");
    try {
      await adminUpdateArcoRequest({
        requestId: selected.id,
        status: nextStatus,
        resolutionNotes,
      });
      closeModal();
    } catch (err) {
      console.error("Error al actualizar solicitud ARCO:", err);
      setError(getCallableErrorMessage(err, "No se pudo actualizar la solicitud."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>Solicitudes ARCO</h3>
      <p style={styles.subtitle}>
        Revisa solicitudes de acceso, rectificación, cancelación u oposición y registra su estado.
      </p>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.filters}>
        <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select style={styles.input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          style={styles.input}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo, documento..."
        />
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Fecha</th>
            <th style={styles.th}>Tipo</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Solicitante</th>
            <th style={styles.th}>Correo</th>
            <th style={styles.th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td style={styles.td}>{fmtTs(row.createdAt)}</td>
              <td style={styles.td}>{TYPE_LABELS[row.type] || row.type || "—"}</td>
              <td style={styles.td}>{STATUS_LABELS[row.status] || row.status || "—"}</td>
              <td style={styles.td}>{row.requesterName || "—"}</td>
              <td style={styles.td}>{row.requesterEmail || "—"}</td>
              <td style={styles.td}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openDetail(row)}>
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td style={styles.td} colSpan={6}>
                No hay solicitudes ARCO para los filtros seleccionados.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {selected ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>Solicitud ARCO: {TYPE_LABELS[selected.type] || selected.type}</h4>

            <div style={styles.modalRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Solicitante</div>
                <div style={styles.modalReadOnly}>{String(selected.requesterName || "—")}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Documento</div>
                <div style={styles.modalReadOnly}>{String(selected.requesterDocument || "—")}</div>
              </div>
            </div>

            <div style={styles.modalRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Correo</div>
                <div style={styles.modalReadOnly}>{String(selected.requesterEmail || "—")}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Creada</div>
                <div style={styles.modalReadOnly}>{fmtTs(selected.createdAt)}</div>
              </div>
            </div>

            <div style={styles.modalRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Estado</div>
                <select style={styles.input} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Resuelta</div>
                <div style={styles.modalReadOnly}>
                  {selected.resolvedAt ? `${fmtTs(selected.resolvedAt)} · ${selected.resolvedByUid || "—"}` : "No"}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Detalle</div>
            <div style={{ ...styles.modalReadOnly, minHeight: 96, alignItems: "flex-start", lineHeight: 1.6 }}>
              {String(selected.details || "—")}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, margin: "10px 0 6px" }}>Notas de resolución</div>
            <textarea
              style={styles.textarea}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Notas internas de revisión o resolución"
            />

            <div style={styles.modalActions}>
              <button style={{ ...styles.btn, background: "#dc3545", color: "#fff" }} onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
