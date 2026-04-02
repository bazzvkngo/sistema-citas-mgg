import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import {
  buildCitizenPayload,
  mapCitizenDocToForm,
  mapUserBootstrapToForm,
  normalizeCitizenDoc,
} from "../../utils/citizenProfileData";

const styles = {
  container: {
    display: "grid",
    gap: 14,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
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
    boxSizing: "border-box",
  },
  docHint: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  stack: {
    display: "grid",
    gap: 14,
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  actionBlock: {
    display: "grid",
    gap: 10,
  },
  actionHint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#64748b",
    fontWeight: 700,
    display: "none",
  },
  actionHintLive: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#64748b",
    fontWeight: 700,
  },
  soonNote: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#64748b",
    fontWeight: 800,
    display: "none",
  },
  pendingNote: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#64748b",
    fontWeight: 800,
  },
  btn: (variant) => {
    const base = {
      minHeight: 40,
      padding: "0 13px",
      borderRadius: 10,
      border: "1px solid transparent",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      width: "100%",
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
  accountStatusWrap: {
    display: "grid",
    gap: 10,
  },
  accountStatusCard: {
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  accountStatusLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  accountStatusValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  pendingEmailCard: {
    border: "1px solid rgba(245, 158, 11, 0.24)",
    borderRadius: 14,
    padding: 12,
    background: "#fffaf0",
  },
  pendingEmailTitle: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#92400e",
  },
  pendingEmailValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  pendingEmailSub: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 700,
    color: "#7c2d12",
  },
  recTitle: {
    margin: 0,
    fontSize: 18,
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
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    background: "#fff",
  },
  recItemTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  recCode: {
    fontWeight: 900,
    color: "#0f172a",
  },
  recState: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.16)",
    fontSize: 11,
    fontWeight: 900,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  recMeta: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  recMetaLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  recMetaValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    lineHeight: 1.4,
  },
  emptyRec: {
    border: "1px dashed rgba(148,163,184,0.24)",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
  },
  emptyRecTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },
  emptyRecBody: {
    margin: "6px 0 0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    lineHeight: 1.5,
  },
};

const lookupCitizenUserByDoc = httpsCallable(functions, "lookupCitizenUserByDoc");
const staffUpsertCitizenProfile = httpsCallable(functions, "staffUpsertCitizenProfile");
const staffSendCitizenPasswordReset = httpsCallable(functions, "staffSendCitizenPasswordReset");
const adminDeleteCitizenProfile = httpsCallable(functions, "adminDeleteCitizenProfile");

async function findCitizenUserByDoc(docNorm) {
  const result = await lookupCitizenUserByDoc({ doc: docNorm });
  const payload = result?.data || {};
  return payload?.found ? payload.user || null : null;
}

function getErrorMessage(error, fallbackMessage) {
  const code = String(error?.code || "").trim().toLowerCase();
  const callableMessage = error?.details?.message || error?.message;
  if (callableMessage && !/^internal$/i.test(String(callableMessage).trim())) {
    return String(callableMessage).replace(/^functions\//, "");
  }
  if (code.includes("permission-denied")) return "No tienes permisos para realizar esta acción.";
  if (code.includes("unavailable")) return "El servicio no está disponible en este momento.";
  if (code.includes("not-found")) return "La acción solicitada no está disponible.";
  if (code.includes("internal")) return fallbackMessage;
  return callableMessage ? String(callableMessage).replace(/^functions\//, "") : fallbackMessage;
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

function formatRecentDate(value) {
  if (!value?.toDate) return "Fecha no disponible";
  return value.toDate().toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskEmail(email) {
  const value = String(email || "").trim();
  if (!value || !value.includes("@")) return value;

  const [localPart, domain] = value.split("@");
  if (!domain) return value;

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export default function CitizenProfile({ role = "agente" }) {
  const isAdmin = role === "admin";

  const [dniRaw, setDniRaw] = useState("");
  const dniNorm = useMemo(() => normalizeCitizenDoc(dniRaw), [dniRaw]);

  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingEmailStatus, setPendingEmailStatus] = useState("");

  const [exists, setExists] = useState(false);
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
    setPendingEmail("");
    setPendingEmailStatus("");
    setExists(false);
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
        "NO_SE_PRESENT\u00D3",
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
        setPendingEmail(mapped.pendingEmail || "");
        setPendingEmailStatus(mapped.pendingEmailStatus || "");
        setExists(mapped.exists);
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
          setPendingEmail("");
          setPendingEmailStatus("");
          setExists(mapped.exists);
          setMsg("Datos base cargados desde usuarios.");
          return;
        }
      }

      resetForm();
      setDniRaw(formatCitizenDocument(dniNorm));
      setExists(false);
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
      const payload = buildCitizenPayload({
        docNorm: dniNorm,
        docDisplay: dniRaw,
        tipoDoc,
        nombres,
        apellidos,
        nombreCompleto,
        telefono,
        email,
      });
      const result = await staffUpsertCitizenProfile(payload);
      const response = result?.data || {};
      setDniRaw(formatCitizenDocument(dniRaw));
      setEmail(response?.emailChangePending ? String(response?.appliedEmail || payload.email || "") : String(payload.email || ""));
      setPendingEmail(response?.emailChangePending ? String(response?.pendingEmail || payload.email || "") : "");
      setPendingEmailStatus(response?.emailChangePending ? "confirmation_required" : "");
      setExists(true);
      setMsg(
        String(
          response?.message ||
          (response?.accountCreated
            ? "Cuenta ciudadana creada correctamente."
            : "Ficha y cuenta actualizadas correctamente.")
        )
      );
    } catch (e) {
      console.error(e);
      setMsg(`Error al guardar: ${getErrorMessage(e, "No se pudo crear o sincronizar la cuenta del ciudadano.")}`);
    } finally {
      setBusy(false);
    }
  };

  const restablecerPassword = async () => {
    setMsg("");
    if (!dniNorm) return setMsg("Ingresa DNI/RUT.");
    setBusy(true);
    try {
      const result = await staffSendCitizenPasswordReset({ docNorm: dniNorm });
      const sentTo = result?.data?.sentTo;
      setMsg(
        sentTo
          ? `Se envió un enlace de restablecimiento a ${sentTo}.`
          : "Se envió el enlace de restablecimiento."
      );
    } catch (e) {
      console.error(e);
      setMsg(`Error al restablecer contraseña: ${getErrorMessage(e, "No se pudo enviar el enlace.")}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async () => {
    setMsg("");
    if (!dniNorm) return setMsg("Ingresa DNI/RUT.");
    const ok = window.confirm("Eliminar esta ficha de ciudadano.\nEsta acción no deshace la cuenta de acceso.");
    if (!ok) return;
    setBusy(true);
    try {
      await adminDeleteCitizenProfile({ docNorm: dniNorm });
      resetForm();
      setDniRaw("");
      setRecientes([]);
      setMsg("Ficha eliminada correctamente.");
    } catch (e) {
      console.error(e);
      setMsg(`Error al eliminar: ${getErrorMessage(e, "No se pudo eliminar la ficha.")}`);
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
  const accountStatus = !dniNorm
    ? "Sin documento"
    : exists
      ? "Encontrado"
      : "Nuevo registro";

  return (
    <div style={styles.container}>
      <div style={styles.topGrid}>
        <div style={styles.card}>
          <div style={styles.head}>
            <div style={styles.titleWrap}>
              <h2 style={styles.title}>Datos del ciudadano</h2>
              <p style={styles.sub}>Consulta y actualiza la ficha principal del ciudadano.</p>
            </div>
            <div style={styles.badge}>{isAdmin ? "admin" : "agente"}</div>
          </div>

          <div style={styles.fieldsGrid}>
            <div style={styles.fieldBlockFull}>
              <div style={styles.label}>RUT / DNI</div>
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
          <div style={styles.head}>
            <div style={styles.titleWrap}>
              <h3 style={styles.sectionTitle}>Gestión de cuenta</h3>
              <p style={styles.sub}>Acciones rápidas sobre la ficha y el acceso del ciudadano.</p>
            </div>
          </div>

          <div style={styles.stack}>
            <div style={styles.docRow}>
              <div style={styles.label}>Buscar ciudadano</div>
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
            </div>

            <div style={styles.accountStatusWrap}>
              <div style={styles.accountStatusCard}>
                <div style={styles.accountStatusLabel}>Estado</div>
                <div style={styles.accountStatusValue}>{accountStatus}</div>
              </div>
              {pendingEmail && pendingEmailStatus === "confirmation_required" ? (
                <div style={styles.pendingEmailCard}>
                  <div style={styles.pendingEmailTitle}>Correo pendiente de confirmacion</div>
                  <div style={styles.pendingEmailValue}>{maskEmail(pendingEmail)}</div>
                  <p style={styles.pendingEmailSub}>
                    El nuevo correo recibio un enlace de confirmacion. El cambio se aplicara cuando el ciudadano lo confirme.
                  </p>
                </div>
              ) : null}
              {statusMessage ? <div style={styles.statusInline(statusTone)}>{statusMessage}</div> : null}
            </div>

            <div style={styles.actionBlock}>
              <div style={styles.actionGrid}>
                <button style={{ ...styles.btn("primary"), ...(disabled ? styles.btnDisabled : {}) }} onClick={buscar} disabled={disabled}>
                  Buscar
                </button>
                <button style={{ ...styles.btn("dark"), ...(disabled ? styles.btnDisabled : {}) }} onClick={guardar} disabled={disabled}>
                  Guardar ficha
                </button>
                <button style={{ ...styles.btn(), ...(disabled ? styles.btnDisabled : {}) }} onClick={limpiar} disabled={disabled}>
                  Nuevo registro
                </button>
                <button style={{ ...styles.btn(), ...(disabled ? styles.btnDisabled : {}) }} onClick={restablecerPassword} disabled={disabled}>
                  Restablecer acceso
                </button>
                {isAdmin ? (
                  <button style={{ ...styles.btn("danger"), ...(disabled ? styles.btnDisabled : {}) }} onClick={eliminar} disabled={disabled}>
                    Eliminar ficha
                  </button>
                ) : null}
              </div>
              <p style={styles.actionHintLive}>
                Guardar ficha actualiza los datos del ciudadano. Restablecer acceso envía un enlace al correo asociado de una cuenta ciudadana existente.
              </p>
              {isAdmin ? (
                <p style={styles.soonNote}>Pendiente: desactivación real de cuenta y baja segura en Auth.</p>
              ) : null}
              {isAdmin ? (
                <p style={styles.pendingNote}>Pendiente: desactivación real de cuenta y baja segura en Auth.</p>
              ) : null}
              <p style={styles.actionHint}>
                Las acciones visibles mantienen el flujo actual y actúan sobre la ficha del ciudadano.
              </p>
              <p style={styles.soonNote}>Próximamente: restablecer contraseña.</p>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.recTitle}>Atenciones recientes</h3>
        <p style={styles.recSub}>Últimos registros vinculados al documento consultado.</p>

        {recientes.length === 0 ? (
          <div style={styles.emptyRec}>
            <p style={styles.emptyRecTitle}>Aún no hay actividad reciente</p>
            <p style={styles.emptyRecBody}>
              Cuando el ciudadano tenga atenciones cerradas o recientes asociadas a este documento,
              aparecerán aquí para consulta rápida.
            </p>
          </div>
        ) : (
          recientes.map((r) => (
            <div key={r.id} style={styles.recItem}>
              <div style={styles.recItemTop}>
                <div style={styles.recCode}>{r.codigo || "-"}</div>
                <div style={styles.recState}>{r.estado || "-"}</div>
              </div>

              <div style={styles.recMeta}>
                <div>
                  <div style={styles.recMetaLabel}>Trámite</div>
                  <div style={styles.recMetaValue}>{r.tramiteNombre || r.tramiteID || "-"}</div>
                </div>
                <div>
                  <div style={styles.recMetaLabel}>Cierre</div>
                  <div style={styles.recMetaValue}>{formatRecentDate(r.fechaHoraAtencionFin || r.fechaHora)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
