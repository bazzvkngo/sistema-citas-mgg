import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { QRCodeSVG } from "qrcode.react";
import { db, app } from "../firebase";
import useImmersiveFullscreen from "../hooks/useImmersiveFullscreen";
import logoConsulado from "../assets/logo-consulado.png";
import { buildTurnoTrackingUrl, resolvePublicAppUrl } from "../utils/tracking";

const functions = getFunctions(app, "southamerica-west1");
const generarTurnoKiosko = httpsCallable(functions, "generarTurnoKiosko");

const UI = {
  bg: "#f1f4f8",
  panel: "#ffffff",
  ink: "#0b1220",
  muted: "#6b7280",
  brand: "#c8102e",
  borderSoft: "rgba(148, 163, 184, 0.18)",
  shadow: "0 20px 48px rgba(15,23,42,0.1)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: UI.bg,
    fontFamily: '"Segoe UI", Arial, sans-serif',
    display: "flex",
    flexDirection: "column",
  },

  top: {
    minHeight: 76,
    background: "#ffffff",
    borderBottom: `1px solid ${UI.borderSoft}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    gap: 16,
  },
  topLeft: { display: "flex", alignItems: "center", gap: 14 },
  logoBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    background: "#ffffff",
    boxShadow: "0 8px 20px rgba(15,23,42,0.1)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  logoImg: {
    width: 38,
    height: 38,
    objectFit: "contain",
  },
  topTitle: {
    fontWeight: 900,
    fontSize: 20,
    lineHeight: 1.05,
    color: UI.ink,
    letterSpacing: "-0.03em",
  },
  topSub: {
    fontWeight: 800,
    fontSize: 12,
    color: UI.muted,
    marginTop: 3,
  },
  topRight: {
    fontWeight: 900,
    fontSize: 11,
    color: UI.muted,
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 999,
    padding: "8px 11px",
    whiteSpace: "nowrap",
  },

  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    width: "min(840px, 92vw)",
    background: UI.panel,
    border: `1px solid ${UI.borderSoft}`,
    borderRadius: 24,
    boxShadow: UI.shadow,
    padding: "24px 24px 22px",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.brand,
  },
  h1: {
    margin: "10px 0 0",
    fontSize: 38,
    lineHeight: 1.02,
    fontWeight: 900,
    color: UI.ink,
    letterSpacing: "-0.04em",
  },
  h2: {
    margin: "12px 0 0 0",
    fontSize: 17,
    fontWeight: 800,
    color: UI.muted,
    lineHeight: 1.45,
    maxWidth: 640,
  },

  gridBtns: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  btn: {
    width: "100%",
    textAlign: "center",
    padding: "18px 18px",
    borderRadius: 18,
    border: `1px solid ${UI.borderSoft}`,
    background: "#ffffff",
    fontSize: 22,
    fontWeight: 900,
    color: UI.ink,
    cursor: "pointer",
    transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    minHeight: 86,
  },
  btnLabel: {
    display: "block",
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    color: UI.ink,
    letterSpacing: "-0.03em",
  },
  btnMeta: {
    display: "block",
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 800,
    color: UI.muted,
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #c8102e, #a30f1f)",
    color: "#fff",
    border: "none",
    boxShadow: "0 16px 30px rgba(200,16,46,0.2)",
    textAlign: "center",
  },
  btnGhost: {
    background: "transparent",
    border: "none",
    color: UI.muted,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "underline",
    marginTop: 14,
    fontSize: 15,
  },
  sectionCard: {
    marginTop: 18,
    padding: 0,
    borderRadius: 0,
    background: "transparent",
    border: "none",
  },
  selectedService: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#fff5f5",
    border: "1px solid rgba(200,16,46,0.16)",
    color: UI.brand,
    fontSize: 12,
    fontWeight: 900,
  },
  dniWrap: { marginTop: 14, display: "grid", gap: 12 },
  input: {
    height: 72,
    borderRadius: 18,
    border: `2px solid ${UI.borderSoft}`,
    padding: "0 18px",
    fontSize: 28,
    fontWeight: 900,
    textAlign: "center",
    outline: "none",
    background: "#ffffff",
    color: UI.ink,
    letterSpacing: "0.04em",
  },

  ticketBox: {
    marginTop: 16,
    border: `1px solid ${UI.borderSoft}`,
    borderRadius: 18,
    padding: 20,
    background: "#ffffff",
    textAlign: "center",
  },
  ticketLabel: {
    margin: 0,
    fontSize: 13,
    fontWeight: 900,
    color: UI.muted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  ticketService: {
    margin: "10px 0 0 0",
    fontSize: 26,
    fontWeight: 900,
    color: UI.ink,
    letterSpacing: "-0.03em",
  },
  ticketCode: {
    margin: "16px 0 0 0",
    fontSize: 76,
    fontWeight: 900,
    color: UI.brand,
    lineHeight: 1,
    letterSpacing: "-0.04em",
  },
  qrWrap: {
    display: "flex",
    justifyContent: "center",
    marginTop: 12,
    padding: 10,
    borderRadius: 16,
    background: "#ffffff",
    border: `1px solid ${UI.borderSoft}`,
  },
  hr: {
    margin: "16px 0",
    border: "none",
    borderTop: `1px solid ${UI.borderSoft}`,
  },
  error: {
    marginTop: 10,
    background: "#fff5f5",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
  },
  loadingState: {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px dashed ${UI.borderSoft}`,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    fontWeight: 900,
    color: UI.muted,
  },
};

function getCallableErrorMessage(error, fallback) {
  const raw = error?.details || error?.message || "";
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  return cleaned || fallback;
}

export default function Kiosk() {
  const rootRef = useRef(null);
  const generateInFlightRef = useRef(false);
  const { toggleFullscreen } = useImmersiveFullscreen(rootRef, {
    styleId: "cp-kiosk-fullscreen-style",
    bodyClassName: "cp-kiosk-fullscreen",
  });

  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState("tramites");
  const [selectedTramite, setSelectedTramite] = useState(null);

  const [dniVisual, setDniVisual] = useState("");
  const [dniLimpio, setDniLimpio] = useState("");

  const [generatedTicket, setGeneratedTicket] = useState(null);

  useEffect(() => {
    const fetchTramites = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "tramites")));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTramites(list);
        setError(null);
      } catch (e) {
        console.error("Error al cargar trámites:", e);
        setError("Error al cargar servicios.\nIntente más tarde.");
      }
      setLoading(false);
    };

    fetchTramites();
  }, []);

  const handleSelectTramite = (tramite) => {
    setSelectedTramite(tramite);
    setView("dni");
    setError(null);
    setDniVisual("");
    setDniLimpio("");
  };

  const handleDniChange = (e) => {
    let valor = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase();
    if (valor.length > 9) valor = valor.slice(0, 9);

    setDniLimpio(valor);

    let formateado = valor;
    if (valor.length > 1) {
      const cuerpo = valor.slice(0, -1);
      const dv = valor.slice(-1);
      formateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
    }
    setDniVisual(formateado);
  };

  const handleGenerarTurno = async (e) => {
    e.preventDefault();
    if (loading || generateInFlightRef.current) return;

    if (dniLimpio.trim().length < 7) {
      setError("Por favor, ingrese un DNI/RUT válido.");
      return;
    }

    generateInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await generarTurnoKiosko({
        dniLimpio,
        tramiteId: selectedTramite.id,
      });

      const { codigo, nombre, trackingToken } = result.data;
      const qrUrl = buildTurnoTrackingUrl(resolvePublicAppUrl(), trackingToken);

      setGeneratedTicket({
        codigo,
        nombre,
        qrValue: qrUrl,
      });

      setView("ticket");
    } catch (err) {
      console.error("Error al generar turno:", err);

      const userMessage = getCallableErrorMessage(err, "Error al generar su turno.\nIntente de nuevo.");
      setError(userMessage);
    } finally {
      generateInFlightRef.current = false;
      setLoading(false);
    }
  };

  const resetKiosk = () => {
    setView("tramites");
    setError(null);
    setDniVisual("");
    setDniLimpio("");
    setSelectedTramite(null);
    setGeneratedTicket(null);
  };

  const stepLabel =
    view === "tramites" ? "Seleccione servicio" : view === "dni" ? "Identificación" : "Ticket";

  return (
    <div ref={rootRef} style={styles.page} onDoubleClick={toggleFullscreen}>
      <div style={styles.top}>
        <div style={styles.topLeft}>
          <div style={styles.logoBox}>
            <img src={logoConsulado} alt="Consulado del Perú" style={styles.logoImg} />
          </div>
          <div>
            <div style={styles.topTitle}>Consulado del Perú en Iquique</div>
            <div style={styles.topSub}>Kiosko de atención consular</div>
          </div>
        </div>
        <div style={styles.topRight}>{stepLabel}</div>
      </div>

      <div style={styles.center}>
        <div style={styles.card}>
          {view === "tramites" && (
            <>
              <p style={styles.eyebrow}>Paso 1</p>
              <h1 style={styles.h1}>Selecciona un servicio</h1>
              <h2 style={styles.h2}>
                Toca el trámite que necesitas para comenzar la emisión de tu turno.
              </h2>

              <div style={styles.gridBtns}>
                {loading && <div style={styles.loadingState}>Cargando servicios…</div>}
                {error && <div style={styles.error}>{error}</div>}

                {!loading &&
                  tramites.map((t) => (
                    <button key={t.id} style={styles.btn} onClick={() => handleSelectTramite(t)}>
                      <span style={styles.btnLabel}>{t.nombre || t.id}</span>
                      <span style={styles.btnMeta}>Continuar con este servicio</span>
                    </button>
                  ))}
              </div>
            </>
          )}

          {view === "dni" && selectedTramite && (
            <>
              <p style={styles.eyebrow}>Paso 2</p>
              <h1 style={styles.h1}>Identificación</h1>
              <h2 style={styles.h2}>
                Ingresa tu DNI o RUT para generar el turno del trámite seleccionado.
              </h2>

              <div style={styles.sectionCard}>
                <span style={styles.selectedService}>
                  Servicio: {selectedTramite.nombre || "Servicio"}
                </span>

                <div style={styles.dniWrap}>
                  <input
                    style={styles.input}
                    value={dniVisual}
                    onChange={handleDniChange}
                    placeholder="12.345.678-9"
                    autoFocus
                    inputMode="text"
                    autoComplete="off"
                  />

                {error && <div style={styles.error}>{error}</div>}

                <button
                  style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 6 }}
                  onClick={handleGenerarTurno}
                  disabled={loading}
                >
                  {loading ? "Generando…" : "Generar turno"}
                  </button>

                  <button style={styles.btnGhost} onClick={resetKiosk} disabled={loading}>
                    ← Volver
                  </button>
                </div>
              </div>
            </>
          )}

          {view === "ticket" && generatedTicket && (
            <>
              <p style={styles.eyebrow}>Paso 3</p>
              <h1 style={styles.h1}>Tu turno fue generado</h1>
              <h2 style={styles.h2}>
                Espera a ser llamado en pantalla. También puedes seguir el estado escaneando
                el código QR.
              </h2>

              <div style={styles.ticketBox}>
                <p style={styles.ticketLabel}>Servicio</p>
                <p style={styles.ticketService}>{generatedTicket.nombre}</p>

                <p style={styles.ticketCode}>{generatedTicket.codigo}</p>

                <hr style={styles.hr} />

                <p style={styles.ticketLabel}>Escanea este QR para ver el estado de tu turno</p>

                <div style={styles.qrWrap}>
                  <QRCodeSVG value={generatedTicket.qrValue} size={146} />
                </div>

                <button
                  style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 20 }}
                  onClick={resetKiosk}
                >
                  Aceptar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
