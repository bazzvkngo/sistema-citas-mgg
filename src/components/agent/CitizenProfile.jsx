import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import {
  buildCitizenPayload,
  mapCitizenDocToForm,
  mapUserBootstrapToForm,
  normalizeCitizenDoc,
} from "../../utils/citizenProfileData";

const styles = {
  container: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) 320px",
    gap: 14,
    alignItems: "start",
  },
  card: {
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 18,
    padding: 16,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
    boxShadow: "0 14px 28px rgba(15,23,42,0.06)",
  },
  head: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  titleWrap: { minWidth: 0 },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  sub: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.4,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "#f8fafc",
    fontSize: 11,
    fontWeight: 900,
    color: "#334155",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  docRow: {
    display: "grid",
    gap: 8,
  },
  docInputRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
  },
  label: {
    fontWeight: 900,
    fontSize: 12,
    color: "#334155",
    letterSpacing: "0.02em",
  },
  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.2)",
    fontWeight: 800,
    background: "#fff",
    color: "#0f172a",
  },
  docHint: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  select: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.2)",
    fontWeight: 800,
    background: "#fff",
    color: "#0f172a",
  },
  btnRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  btn: (variant) => {
    const base = {
      minHeight: 38,
      padding: "0 13px",
      borderRadius: 10,
      border: "1px solid transparent",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
    };
    if (variant === "primary") return { ...base, background: "#0f172a", color: "#fff" };
    if (variant === "dark") {
      return {
        ...base,
        background: "#e2e8f0",
        color: "#0f172a",
        border: "1px solid rgba(148,163,184,0.2)",
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        background: "#fff1f2",
        color: "#9f1239",
        border: "1px solid #fecdd3",
      };
    }
    return {
      ...base,
      background: "#f8fafc",
      color: "#0f172a",
      border: "1px solid rgba(148,163,184,0.2)",
    };
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  fieldBlock: {
    display: "grid",
    gap: 6,
  },
  fieldBlockFull: {
    display: "grid",
    gap: 6,
    gridColumn: "1 / -1",
  },
  statusInline: (tone) => ({
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: tone === "error" ? "1px solid #fecaca" : "1px solid rgba(148,163,184,0.16)",
    background: tone === "error" ? "#fff1f2" : "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    color: tone === "error" ? "#9f1239" : "#334155",
    lineHeight: 1.45,
  }),
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    minHeight: 42,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#f8fafc",
    fontSize: 11,
    fontWeight: 900,
    color: "#475569",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  recTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  recSub: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
    fontSize: 12,
  },
  recItem: {
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    background: "#fff",
  },
  emptyRec: {
    border: "1px dashed rgba(148,163,184,0.24)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    background: "#fff",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
  },
};

const lookupCitizenUserByDoc = httpsCallable(functions, "lookupCitizenUserByDoc");

async function findCitizenUserByDoc(docNorm) {
  const result = await lookupCitizenUserByDoc({ doc: docNorm });
  const payload = result?.data || {};
  return payload?.found ? payload.user || null : null;
}

function addDocThousands(value) {
  return String(value || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCitizenDocument(raw) {
  const normalized = normalizeCitizenDoc(raw);
  if (!normalized) return "";

  const hasVerifier = /K$/.test(normalized) || normalized.length > 8;
  if (hasVerifier) {
    const body = normalized.slice(0, -1);
    const verifier = normalized.slice(-1);
    return body ? `${addDocThousands(body)}-${verifier}` : verifier;
  }

  return addDocThousands(normalized);
}

function inferTipoDoc(docNorm) {
  if (!docNorm) return "DNI";
  return /K$/.test(docNorm) || docNorm.length > 8 ? "RUT" : "DNI";
}

export default function CitizenProfile({ role = "agente" }) {
  const { currentUser } = useAuth();
  const isAdmin = role === "admin";

  const [dniRaw, setDniRaw] = useState("");
  const dniNorm = useMemo(() => normalizeCitizenDoc(dniRaw), [dniRaw]);

  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [exists, setExists] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [recientes, setRecientes] = useState([]);

  const resetForm = () => {
    setTipoDoc("DNI");
    setNombres("");
    setApellidos("");
    setNombreCompleto("");
    setTelefono("");
    setEmail("");
    setExists(false);
    setSource("");
  };

  useEffect(() => {
    if (!dniNorm) {
      setRecientes([]);
      return;
    }

    const qRec = query(
      collection(db, "citas"),
      where("dni", "==", dniNorm),
      where("estado", "in", [
        "completado",
        "cerrada",
        "cerrado",
        "no_asistio",
        "NO_SE_PRESENTO",
        "NO_SE_PRESENTÓ",
      ]),
      orderBy("fechaHoraAtencionFin", "desc"),
      limit(8)
    );

    const unsub = onSnapshot(
      qRec,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecientes(rows);
      },
      (err) => {
        console.error("Recientes error:", err);
        setMsg((prev) => prev || `Recientes: ${err?.message || "error"}`);
      }
    );

    return () => unsub();
  }, [dniNorm]);

  const buscar = async () => {
    setMsg("");
    if (!dniNorm) return setMsg("Ingresa DNI/RUT.");
    setBusy(true);
    try {
      const refC = doc(db, "ciudadanos", dniNorm);
      const snapC = await getDoc(refC);

      if (snapC.exists()) {
        const data = snapC.data() || {};
        const mapped = mapCitizenDocToForm(dniNorm, data);
        setDniRaw(formatCitizenDocument(mapped.docIdInput || dniNorm));
        setTipoDoc(mapped.tipoDoc);
        setNombres(mapped.nombres);
        setApellidos(mapped.apellidos);
        setNombreCompleto(mapped.nombreCompleto);
        setTelefono(mapped.telefono);
        setEmail(mapped.email);
        setExists(mapped.exists);
        setSource(mapped.source);
        setMsg("Registro encontrado en ciudadanos.");
        return;
      }

      if (isAdmin || role === "agente") {
        const d = await findCitizenUserByDoc(dniNorm);
        if (d) {
          const mapped = mapUserBootstrapToForm(dniNorm, d);
          setDniRaw(formatCitizenDocument(mapped.docIdInput || dniNorm));
          setTipoDoc(mapped.tipoDoc);
          setNombres(mapped.nombres);
          setApellidos(mapped.apellidos);
          setNombreCompleto(mapped.nombreCompleto);
          setTelefono(mapped.telefono);
          setEmail(mapped.email);
          setExists(mapped.exists);
          setSource(mapped.source);
          setMsg("Datos base cargados desde usuarios.");
          return;
        }
      }

      resetForm();
      setDniRaw(formatCitizenDocument(dniNorm));
      setExists(false);
      setSource("");
      setMsg("No existe. Puedes crear el registro.");
    } catch (e) {
      console.error(e);
      setMsg(`Error al buscar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const guardar = async () => {
    setMsg("");
    if (!dniNorm) return setMsg("Ingresa DNI/RUT.");
    setBusy(true);

    try {
      const ref = doc(db, "ciudadanos", dniNorm);
      const payload = {
        ...buildCitizenPayload({
          docNorm: dniNorm,
          docDisplay: dniRaw,
          tipoDoc,
          nombres,
          apellidos,
          nombreCompleto,
          telefono,
          email,
        }),
        updatedAt: serverTimestamp(),
      };

      const before = await getDoc(ref);
      if (!before.exists()) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser?.uid || "";
      } else {
        payload.updatedBy = currentUser?.uid || "";
      }

      await setDoc(ref, payload, { merge: true });

      setDniRaw(formatCitizenDocument(dniRaw));
      setExists(true);
      setSource("ciudadanos");
      setMsg("Guardado en ciudadanos.");
    } catch (e) {
      console.error(e);
      setMsg(`Error al guardar: ${e?.code ? `[${e.code}] ` : ""}${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async () => {
    setMsg("");
    if (!dniNorm) return setMsg("Ingresa DNI/RUT.");
    setBusy(true);
    try {
      await deleteDoc(doc(db, "ciudadanos", dniNorm));
      resetForm();
      setMsg("Eliminado de ciudadanos.");
    } catch (e) {
      console.error(e);
      setMsg(`Error al eliminar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const limpiar = () => {
    setDniRaw("");
    resetForm();
    setMsg("");
    setRecientes([]);
  };

  const handleDocChange = (value) => {
    const formatted = formatCitizenDocument(value);
    const normalized = normalizeCitizenDoc(value);
    setDniRaw(formatted);
    if (normalized) {
      setTipoDoc(inferTipoDoc(normalized));
    } else {
      setTipoDoc("DNI");
    }
  };

  const disabled = busy;
  const statusTone = String(msg || "").toLowerCase().includes("error") ? "error" : "info";
  const statusMessage = msg || (exists ? "Registro cargado." : "");
  const tipoDocLabel = tipoDoc || inferTipoDoc(dniNorm);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.head}>
          <div style={styles.titleWrap}>
            <h2 style={styles.title}>Ciudadano</h2>
            <p style={styles.sub}>Consulta y actualizacion.</p>
          </div>
          <div style={styles.badge}>{isAdmin ? "admin" : "agente"}</div>
        </div>

        <div style={styles.docRow}>
          <div style={styles.label}>Documento</div>
          <div style={styles.docInputRow}>
            <input
              style={styles.input}
              value={dniRaw}
              onChange={(e) => handleDocChange(e.target.value)}
              placeholder="18.373.138-1"
              disabled={disabled}
            />
            <div style={styles.metaPill}>{tipoDocLabel}</div>
          </div>
          <p style={styles.docHint}>Ingresa RUT o DNI.</p>
        </div>

        <div style={styles.btnRow}>
          <button style={{ ...styles.btn("primary"), ...(disabled ? styles.btnDisabled : {}) }} onClick={buscar} disabled={disabled}>
            Buscar
          </button>
          <button style={{ ...styles.btn("dark"), ...(disabled ? styles.btnDisabled : {}) }} onClick={guardar} disabled={disabled}>
            Guardar
          </button>
          <button style={{ ...styles.btn(), ...(disabled ? styles.btnDisabled : {}) }} onClick={limpiar} disabled={disabled}>
            Limpiar
          </button>
          {isAdmin ? (
            <button style={{ ...styles.btn("danger"), ...(disabled ? styles.btnDisabled : {}) }} onClick={eliminar} disabled={disabled}>
              Eliminar
            </button>
          ) : null}
        </div>

        {statusMessage ? <div style={styles.statusInline(statusTone)}>{statusMessage}</div> : null}

        <div style={styles.fieldsGrid}>
          <div style={styles.fieldBlock}>
            <div style={styles.label}>Nombres</div>
            <input style={styles.input} value={nombres} onChange={(e) => setNombres(e.target.value)} />
          </div>

          <div style={styles.fieldBlock}>
            <div style={styles.label}>Apellidos</div>
            <input style={styles.input} value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>

          <div style={styles.fieldBlockFull}>
            <div style={styles.label}>Nombre completo</div>
            <input style={styles.input} value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} />
          </div>

          <div style={styles.fieldBlock}>
            <div style={styles.label}>Telefono</div>
            <input style={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>

          <div style={styles.fieldBlock}>
            <div style={styles.label}>Email</div>
            <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.recTitle}>Recientes</h3>
        <p style={styles.recSub}>Historial reciente en citas.</p>

        {recientes.length === 0 ? (
          <div style={styles.emptyRec}>Sin registros.</div>
        ) : (
          recientes.map((r) => (
            <div key={r.id} style={styles.recItem}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {r.codigo || "-"} <span style={{ fontWeight: 800, color: "#64748b" }}>({r.estado || "-"})</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#334155" }}>
                Tramite: {r.tramiteNombre || r.tramiteID || "-"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
