// src/pages/Kiosk.jsx
import React, { useState, useEffect } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../firebase";
import { QRCodeSVG } from "qrcode.react";

// Functions
const functions = getFunctions(app, "southamerica-west1");
const generarTurnoKiosko = httpsCallable(functions, "generarTurnoKiosko");

/**
 * Kiosk – estilo “Sodimac”
 * - Título: Selecciona un servicio para obtener tu turno
 * - Botones grandes por trámite
 * - Footer: “Turno preferencial…”
 * - Mantiene tu flujo: trámites -> dni -> ticket
 */

const UI = {
  bg: "#eef3fb",
  panel: "#ffffff",
  ink: "#0b1220",
  muted: "#6b7280",
  brand: "#1f6feb",
  border: "rgba(15, 23, 42, 0.12)",
  shadow: "0 18px 55px rgba(0,0,0,0.14)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: UI.bg,
    fontFamily: "Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
  },

  top: {
    height: 78,
    background: UI.panel,
    borderBottom: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 22px",
  },
  topLeft: { display: "flex", alignItems: "center", gap: 14 },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #0ea5e9, #1f6feb)",
    boxShadow: "0 10px 24px rgba(31,111,235,0.25)",
  },
  topTitle: { fontWeight: 900, fontSize: 18 },
  topSub: { fontWeight: 800, fontSize: 12, color: UI.muted, marginTop: 2 },

  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    width: "min(860px, 96vw)",
    background: UI.panel,
    border: `1px solid ${UI.border}`,
    borderRadius: 20,
    boxShadow: UI.shadow,
    padding: "28px 26px",
  },

  h1: { margin: 0, fontSize: 30, fontWeight: 900, color: UI.ink },
  h2: { margin: "10px 0 0 0", fontSize: 18, fontWeight: 800, color: UI.muted },

  gridBtns: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  btn: {
    width: "100%",
    textAlign: "center",
    padding: "22px 18px",
    borderRadius: 14,
    border: `2px solid ${UI.border}`,
    background: "#fff",
    fontSize: 22,
    fontWeight: 900,
    color: UI.ink,
    cursor: "pointer",
    transition: "transform .06s ease",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #1f6feb, #0b3d91)",
    color: "#fff",
    border: "none",
  },
  btnGhost: {
    background: "transparent",
    border: "none",
    color: UI.muted,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "underline",
    marginTop: 14,
  },

  dniWrap: { marginTop: 18, display: "grid", gap: 12 },
  input: {
    height: 66,
    borderRadius: 14,
    border: `2px solid ${UI.border}`,
    padding: "0 16px",
    fontSize: 26,
    fontWeight: 900,
    textAlign: "center",
    outline: "none",
  },

  ticketBox: {
    marginTop: 16,
    border: `2px solid ${UI.border}`,
    borderRadius: 18,
    padding: 18,
    background: "#f8fafc",
    textAlign: "center",
  },
  ticketLabel: { margin: 0, fontSize: 16, fontWeight: 900, color: UI.muted },
  ticketService: { margin: "8px 0 0 0", fontSize: 24, fontWeight: 900, color: UI.ink },
  ticketCode: { margin: "10px 0 0 0", fontSize: 74, fontWeight: 900, color: "#C8102E", lineHeight: 1 },
  hr: { margin: "16px 0", border: "none", borderTop: `1px solid ${UI.border}` },

  error: {
    marginTop: 10,
    background: "#fff5f5",
    border: "1px solid #ffd0d0",
    color: "#7a0000",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
  },

  footer: {
    background: UI.panel,
    borderTop: `1px solid ${UI.border}`,
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  footerLeft: { display: "flex", alignItems: "center", gap: 10 },
  icon: (size = 22) => ({
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: UI.muted,
  }),
  footerTitle: { fontSize: 14, fontWeight: 900, color: UI.ink },
  footerText: { fontSize: 12, fontWeight: 800, color: UI.muted },
};

export default function Kiosk() {
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
        const tramitesSnapshot = await getDocs(query(collection(db, "tramites")));
        const tramitesList = tramitesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTramites(tramitesList);
        setError(null);
      } catch (e) {
        console.error("Error al cargar trámites:", e);
        setError("Error al cargar servicios. Intente más tarde.");
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
    if (dniLimpio.trim().length < 7) {
      setError("Por favor, ingrese un DNI/RUT válido.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await generarTurnoKiosko({
        dniLimpio,
        tramiteId: selectedTramite.id,
      });

      const { id, codigo, nombre } = result.data;
      const qrUrl = `${window.location.origin}/qr-seguimiento?turnoId=${id}`;

      setGeneratedTicket({
        codigo,
        nombre,
        qrValue: qrUrl,
      });
      setView("ticket");
    } catch (err) {
      console.error("Error al generar turno:", err);

      let userMessage = "Error al generar su turno. Intente de nuevo.";
      if (err.message && err.message.includes("FirebaseError: ")) {
        userMessage = err.message.replace("FirebaseError: ", "").replace(":", "");
      } else if (err.code) {
        userMessage = `Error de servidor (${err.code}). Por favor, intente más tarde.`;
      }
      setError(userMessage);
    }
    setLoading(false);
  };

  const resetKiosk = () => {
    setView("tramites");
    setError(null);
    setDniVisual("");
    setDniLimpio("");
    setSelectedTramite(null);
    setGeneratedTicket(null);
  };

  return (
    <div style={styles.page}>
      {/* TOP BAR */}
      <div style={styles.top}>
        <div style={styles.topLeft}>
          <div style={styles.logoBox} />
          <div>
            <div style={styles.topTitle}>Consulado del Perú – Iquique</div>
            <div style={styles.topSub}>Kiosko de turnos</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: UI.muted }}>
          {view === "tramites" ? "Seleccione servicio" : view === "dni" ? "Identificación" : "Ticket"}
        </div>
      </div>

      <div style={styles.center}>
        <div style={styles.card}>
          {/* VISTA 1: TRÁMITES */}
          {view === "tramites" && (
            <>
              <h1 style={styles.h1}>Selecciona un servicio</h1>
              <h2 style={styles.h2}>para obtener tu turno:</h2>

              <div style={styles.gridBtns}>
                {loading && <div style={{ fontWeight: 900, color: UI.muted }}>Cargando servicios…</div>}
                {error && <div style={styles.error}>{error}</div>}

                {!loading &&
                  tramites.map((t) => (
                    <button
                      key={t.id}
                      style={styles.btn}
                      onClick={() => handleSelectTramite(t)}
                    >
                      {t.nombre || t.id}
                    </button>
                  ))}
              </div>
            </>
          )}

          {/* VISTA 2: DNI */}
          {view === "dni" && selectedTramite && (
            <>
              <h1 style={styles.h1}>{selectedTramite.nombre}</h1>
              <h2 style={styles.h2}>Ingresa tu DNI o RUT para continuar</h2>

              <form onSubmit={handleGenerarTurno} style={styles.dniWrap}>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="12.345.678-K"
                  value={dniVisual}
                  maxLength={12}
                  onChange={handleDniChange}
                  autoFocus
                />

                {error && <div style={styles.error}>{error}</div>}

                <button
                  type="submit"
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  disabled={loading}
                >
                  {loading ? "Generando…" : "Generar Turno"}
                </button>
              </form>

              <button style={styles.btnGhost} onClick={resetKiosk} disabled={loading}>
                ← Volver
              </button>
            </>
          )}

          {/* VISTA 3: TICKET */}
          {view === "ticket" && generatedTicket && (
            <>
              <h1 style={styles.h1}>Tu turno fue generado</h1>
              <h2 style={styles.h2}>Espera a ser llamado en pantalla</h2>

              <div style={styles.ticketBox}>
                <p style={styles.ticketLabel}>Servicio:</p>
                <p style={styles.ticketService}>{generatedTicket.nombre}</p>
                <p style={styles.ticketCode}>{generatedTicket.codigo}</p>

                <div style={styles.hr} />

                <p style={{ margin: 0, fontWeight: 900, color: UI.muted }}>
                  Escanea este QR para ver el estado de tu turno:
                </p>
                <div style={{ marginTop: 12 }}>
                  <QRCodeSVG value={generatedTicket.qrValue} size={220} />
                </div>
              </div>

              <button
                style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 16 }}
                onClick={resetKiosk}
              >
                Aceptar
              </button>
            </>
          )}
        </div>
      </div>

      {/* FOOTER “TURNO PREFERENCIAL” */}
      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          <span style={styles.icon(22)}>♿</span>
          <span style={styles.icon(22)}>🧓</span>
          <span style={styles.icon(22)}>🤰</span>
          <div>
            <div style={styles.footerTitle}>Turno preferencial</div>
            <div style={styles.footerText}>
              No es necesario sacar turno, acérquese directamente a un módulo para ser atendido.
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: UI.muted }}>
          Sistema de Citas
        </div>
      </div>
    </div>
  );
}
