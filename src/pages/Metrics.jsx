// src/pages/Metrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { app, db } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { format } from "date-fns";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Chart from "chart.js/auto";
import ReportChart from "../components/common/ReportChart";

import "./Metrics.css";

const FUNCTIONS_REGION = "southamerica-west1";

const styles = {
  page: { padding: 20, maxWidth: 1250, margin: "0 auto", fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 24, fontWeight: 900, color: "#C8102E" },

  card: {
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
    padding: 16,
    marginBottom: 14,
    border: "1px solid #eee",
  },

  button: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 900,
    backgroundColor: "#C8102E",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  buttonSecondary: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 900,
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  buttonDanger: {
    border: "1px solid #ffd0d0",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 900,
    backgroundColor: "#fff5f5",
    color: "#7a0000",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  input: { border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 800 },
  select: { border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 900, background: "#fff" },

  small: { fontSize: 12, color: "#666", margin: 0, fontWeight: 800, lineHeight: 1.35 },

  tabs: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  tab: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: "9px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
    color: "#111",
  },
  tabActive: { borderColor: "#cfe0ff", background: "#eaf2ff", color: "#0b3d91" },

  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", borderBottom: "2px solid #eee", padding: "10px 8px", fontSize: 12, color: "#444", fontWeight: 900, whiteSpace: "nowrap" },
  td: { borderBottom: "1px solid #eee", padding: "10px 8px", fontSize: 13, verticalAlign: "top" },

  badge: (bg, color) => ({
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: 999,
    background: bg,
    color,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.05)",
    whiteSpace: "nowrap",
  }),

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 },
  kpi: { border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" },
  kpiLabel: { fontSize: 12, fontWeight: 800, color: "#666", marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: 900, color: "#111" },
  kpiHint: { fontSize: 12, fontWeight: 800, color: "#777", marginTop: 6, lineHeight: 1.25 },

  split2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
};

function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function safeToDate(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtDate(ts) {
  const d = safeToDate(ts);
  if (!d) return "-";
  return format(d, "dd/MM/yyyy HH:mm");
}

function msToMin(ms) {
  if (ms == null) return "-";
  const n = Number(ms);
  if (!Number.isFinite(n)) return "-";
  return Math.round((n / 60000) * 10) / 10;
}

function normalizeCountMap(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) {
    if (maybe.length === 0) return [];
    if (Array.isArray(maybe[0])) return maybe.map(([k, v]) => ({ key: String(k), count: Number(v) || 0 }));
    if (typeof maybe[0] === "object") {
      return maybe.map((x) => ({ key: String(x.key ?? x.id ?? x.name ?? "-"), count: Number(x.count ?? x.value ?? 0) || 0 }));
    }
    return [];
  }
  if (typeof maybe === "object") {
    return Object.entries(maybe).map(([k, v]) => ({ key: String(k), count: Number(v) || 0 }));
  }
  return [];
}

function sortDesc(arr) {
  return [...arr].sort((a, b) => (b.count || 0) - (a.count || 0));
}

function countBy(list, getKey) {
  const m = new Map();
  list.forEach((r) => {
    const k = String(getKey(r) ?? "-");
    m.set(k, (m.get(k) || 0) + 1);
  });
  return sortDesc(Array.from(m.entries()).map(([key, count]) => ({ key, count })));
}

function makeChartImageBase64({ type, labels, values, title }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 430;
  const ctx = canvas.getContext("2d");

  const chart = new Chart(ctx, {
    type,
    data: { labels, datasets: [{ label: title || "", data: values }] },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false }, title: { display: !!title, text: title || "" } },
    },
  });

  chart.update();
  const b64 = canvas.toDataURL("image/png");
  chart.destroy();
  return b64;
}

function buildPrintableHTML({ title, rangeText, sections }) {
  const css = `
    <style>
      body { font-family: Arial, sans-serif; margin: 18px; color: #111; }
      h1 { margin: 0 0 6px 0; font-size: 20px; color: #C8102E; }
      .sub { margin: 0 0 14px 0; font-size: 12px; color: #555; font-weight: 700; }
      .section { border: 1px solid #eee; border-radius: 12px; padding: 12px; margin: 10px 0; }
      .section h2 { margin: 0 0 10px 0; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #eee; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
      th { font-weight: 900; color: #444; border-bottom: 2px solid #ddd; }
      .img { width: 100%; max-width: 1000px; margin-top: 10px; }
      .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.08); font-weight: 800; font-size: 11px; }
      .kpiGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .kpi { border: 1px solid #eee; border-radius: 12px; padding: 10px; }
      .kpi .l { font-size: 11px; color: #666; font-weight: 800; margin-bottom: 6px; }
      .kpi .v { font-size: 18px; font-weight: 900; }
      @media print { .noPrint { display: none; } }
    </style>
  `;

  const body = sections
    .map((s) => {
      const imgHTML = s.chartBase64 ? `<img class="img" src="${s.chartBase64}" />` : "";
      const tableHTML = s.table
        ? `
          <table>
            <thead><tr>${s.table.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>
              ${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        `
        : "";

      const kpisHTML = s.kpis
        ? `
          <div class="kpiGrid">
            ${s.kpis.map((k) => `<div class="kpi"><div class="l">${k.label}</div><div class="v">${k.value}</div><div style="font-size:11px;color:#777;font-weight:700;margin-top:6px">${k.hint || ""}</div></div>`).join("")}
          </div>
        `
        : "";

      return `
        <div class="section">
          <h2>${s.title}</h2>
          ${kpisHTML}
          ${tableHTML}
          ${imgHTML}
        </div>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>${title}</title>
        ${css}
      </head>
      <body>
        <div class="noPrint" style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:10px">
          <button onclick="window.print()">Imprimir / Guardar PDF</button>
        </div>
        <h1>${title}</h1>
        <p class="sub">${rangeText}</p>
        ${body}
      </body>
    </html>
  `;
}

async function exportAllToExcelPro({ filename, overview, tiempos, byAgente, byModulo, byTramite, detalleCitas, detalleTurnos, agentsMap }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Citas";
  wb.created = new Date();

  const boldHeader = (row) => {
    row.font = { bold: true };
    row.alignment = { vertical: "middle" };
  };

  // Resumen
  const sResumen = wb.addWorksheet("Resumen");
  const header = sResumen.addRow(["Métrica", "Valor"]);
  boldHeader(header);
  sResumen.addRow(["Total registros", overview.total]);
  sResumen.addRow(["WEB", overview.totalWeb]);
  sResumen.addRow(["KIOSKO", overview.totalKiosko]);
  sResumen.addRow(["Completadas", overview.atendidas]);
  sResumen.addRow(["No se presentó", overview.noPresento]);

  // Agrupaciones
  const sAg = wb.addWorksheet("PorAgente");
  boldHeader(sAg.addRow(["AgenteID", "Agente", "Cantidad"]));
  byAgente.forEach((x) => {
    const ag = agentsMap?.[x.key] || {};
    const label = ag.nombreCompleto || ag.email || (x.key === "SIN_AGENTE" ? "SIN AGENTE" : x.key);
    sAg.addRow([x.key, label, x.count]);
  });

  const sMod = wb.addWorksheet("PorModulo");
  boldHeader(sMod.addRow(["Módulo", "Cantidad"]));
  byModulo.forEach((x) => sMod.addRow([x.key, x.count]));

  const sTra = wb.addWorksheet("PorTramite");
  boldHeader(sTra.addRow(["Trámite", "Cantidad"]));
  byTramite.forEach((x) => sTra.addRow([x.key, x.count]));

  // Tiempos
  const sT = wb.addWorksheet("Tiempos");
  boldHeader(sT.addRow(["Métrica", "Min (min)", "Prom (min)", "Max (min)"]));
  sT.addRow(["Espera", msToMin(tiempos.espera.minMs), msToMin(tiempos.espera.avgMs), msToMin(tiempos.espera.maxMs)]);
  sT.addRow(["Atención", msToMin(tiempos.atencion.minMs), msToMin(tiempos.atencion.avgMs), msToMin(tiempos.atencion.maxMs)]);

  // Detalle WEB
  const sC = wb.addWorksheet("DetalleCitas_WEB");
  boldHeader(
    sC.addRow(["ID", "Código", "DNI", "Trámite", "Estado", "Clasificación", "Agente", "Módulo", "FechaHora", "Llamado", "Fin", "Espera(min)", "Atención(min)"])
  );
  detalleCitas.forEach((r) => {
    const ag = agentsMap?.[r.agenteID] || {};
    const label = ag.nombreCompleto || ag.email || r.agenteID || "";
    sC.addRow([
      r.id, r.codigo || "", r.dni || r.dniCiudadano || "", r.tramiteID || "", r.estado || "", r.clasificacion || "",
      label, r.moduloAsignado || "", fmtDate(r.fechaHora), fmtDate(r.llamadoAt), fmtDate(r.finAt), msToMin(r.esperaMs), msToMin(r.atencionMs)
    ]);
  });

  // Detalle KIOSKO
  const sK = wb.addWorksheet("DetalleTurnos_KIOSKO");
  boldHeader(
    sK.addRow(["ID", "Código", "Trámite", "Estado", "Clasificación", "Agente", "Módulo", "Generado", "Llamado", "Fin", "Espera(min)", "Atención(min)"])
  );
  detalleTurnos.forEach((r) => {
    const ag = agentsMap?.[r.agenteID] || {};
    const label = ag.nombreCompleto || ag.email || r.agenteID || "";
    sK.addRow([
      r.id, r.codigo || "", r.tramiteID || "", r.estado || "", r.clasificacion || "",
      label, r.modulo || "", fmtDate(r.fechaHoraGenerado || r.createdAt || r.fechaHora), fmtDate(r.llamadoAt), fmtDate(r.finAt), msToMin(r.esperaMs), msToMin(r.atencionMs)
    ]);
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), filename);
}

function RecordModal({ open, onClose, record, agentsMap }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !record) return null;

  const ag = agentsMap?.[record.agenteID] || {};
  const origen = record.__origen || "-";
  const titulo = `${origen}: ${record.codigo || record.id || "Detalle"}`;

  const clasificacion = record.clasificacion || "";
  const badgeStyle =
    clasificacion === "ATENDIDO_OK" || clasificacion === "ATENDIDO" || clasificacion === "TRAMITE_OK"
      ? styles.badge("#d4edda", "#155724")
      : clasificacion === "NO_SE_PRESENTO"
      ? styles.badge("#f8d7da", "#721c24")
      : styles.badge("#fff3cd", "#856404");

  return (
    <div onClick={onClose} className="metrics-modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="metrics-modal">
        <div className="metrics-modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{titulo}</h3>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.badge("#eaf2ff", "#0b3d91")}>{origen}</span>
              <span style={badgeStyle}>{clasificacion || record.estado || "—"}</span>
              <span style={styles.badge("#f3f4f6", "#111")}>Módulo: {record.moduloAsignado || record.modulo || "—"}</span>
              <span style={styles.badge("#f3f4f6", "#111")}>Trámite: {record.tramiteID || "—"}</span>
            </div>
          </div>
          <button onClick={onClose} style={styles.buttonSecondary}>Cerrar</button>
        </div>

        <div className="metrics-modal-grid">
          <div className="metrics-modal-box">
            <div className="metrics-modal-label">Agente</div>
            <div className="metrics-modal-value">{ag.nombreCompleto || ag.email || record.agenteID || "—"}</div>
          </div>
          <div className="metrics-modal-box">
            <div className="metrics-modal-label">Ciudadano</div>
            <div className="metrics-modal-value">
              {record.dni || record.dniCiudadano || "—"} {record.nombreCiudadano ? `· ${record.nombreCiudadano}` : ""}
            </div>
          </div>
        </div>

        <div className="metrics-modal-box" style={{ marginTop: 10 }}>
          <div className="metrics-modal-row">
            <div><span className="metrics-modal-label">Fecha/Hora: </span><strong>{fmtDate(record.fechaHora || record.fechaHoraGenerado || record.createdAt)}</strong></div>
            <div><span className="metrics-modal-label">Llamado: </span><strong>{fmtDate(record.llamadoAt)}</strong></div>
            <div><span className="metrics-modal-label">Fin: </span><strong>{fmtDate(record.finAt)}</strong></div>
            <div><span className="metrics-modal-label">Espera (min): </span><strong>{msToMin(record.esperaMs)}</strong></div>
            <div><span className="metrics-modal-label">Atención (min): </span><strong>{msToMin(record.atencionMs)}</strong></div>
          </div>

          {record.comentariosAgente ? (
            <div style={{ marginTop: 10 }}>
              <div className="metrics-modal-label">Comentarios agente</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>{record.comentariosAgente}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Metrics() {
  const { currentUser } = useAuth();

  const [startDateISO, setStartDateISO] = useState(isoToday());
  const [endDateISO, setEndDateISO] = useState(isoToday());
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [showCharts, setShowCharts] = useState(true);

  // Panel desplegable (control center)
  const [controlOpen, setControlOpen] = useState(true);

  // filtros (interactivos)
  const [originFilter, setOriginFilter] = useState("ALL"); // ALL | WEB | KIOSKO
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [moduloFilter, setModuloFilter] = useState("ALL");
  const [tramiteFilter, setTramiteFilter] = useState("ALL");
  const [agenteFilter, setAgenteFilter] = useState("ALL");
  const [topN, setTopN] = useState(12);

  // búsqueda general
  const [searchText, setSearchText] = useState("");

  const [agentsMap, setAgentsMap] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const isAdmin = useMemo(() => {
    const r = currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil;
    return r === "admin" || currentUser?.isAdmin === true;
  }, [currentUser]);

  // base detalle
  const detalleCitas = useMemo(() => {
    const list = stats?.detalleCitas || [];
    return list.map((r) => ({
      ...r,
      __origen: "WEB",
      llamadoAt: r.llamadoAt || r.fechaHoraLlamado || r.fechaHoraLlamadoAt || null,
      finAt: r.finAt || r.fechaHoraAtencionFin || null,
      moduloKey: r.moduloAsignado || "SIN_MODULO",
      estadoKey: r.estado || "SIN_ESTADO",
      tramiteKey: r.tramiteID || "SIN_TRAMITE",
      agenteKey: r.agenteID || "SIN_AGENTE",
      dniKey: r.dni || r.dniCiudadano || "SIN_DNI",
    }));
  }, [stats]);

  const detalleTurnos = useMemo(() => {
    const list = stats?.detalleTurnos || [];
    return list.map((r) => ({
      ...r,
      __origen: "KIOSKO",
      llamadoAt: r.llamadoAt || r.fechaHoraLlamado || null,
      finAt: r.finAt || r.fechaHoraAtencionFin || null,
      moduloKey: r.modulo || "SIN_MODULO",
      estadoKey: r.estado || "SIN_ESTADO",
      tramiteKey: r.tramiteID || "SIN_TRAMITE",
      agenteKey: r.agenteID || "SIN_AGENTE",
      dniKey: r.dni || r.dniCiudadano || "SIN_DNI",
    }));
  }, [stats]);

  const allRecords = useMemo(() => [...detalleCitas, ...detalleTurnos], [detalleCitas, detalleTurnos]);

  // opciones dinámicas para filtros
  const estadoOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.estadoKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const moduloOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.moduloKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const tramiteOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.tramiteKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const agenteOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.agenteKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  // aplicar filtros + búsqueda
  const filteredRecords = useMemo(() => {
    const t = searchText.trim().toLowerCase();

    return allRecords.filter((r) => {
      if (originFilter !== "ALL" && r.__origen !== originFilter) return false;
      if (estadoFilter !== "ALL" && r.estadoKey !== estadoFilter) return false;
      if (moduloFilter !== "ALL" && r.moduloKey !== moduloFilter) return false;
      if (tramiteFilter !== "ALL" && r.tramiteKey !== tramiteFilter) return false;
      if (agenteFilter !== "ALL" && r.agenteKey !== agenteFilter) return false;

      if (t) {
        const blob = JSON.stringify(r).toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [allRecords, originFilter, estadoFilter, moduloFilter, tramiteFilter, agenteFilter, searchText]);

  const filteredCitas = useMemo(() => filteredRecords.filter((r) => r.__origen === "WEB"), [filteredRecords]);
  const filteredTurnos = useMemo(() => filteredRecords.filter((r) => r.__origen === "KIOSKO"), [filteredRecords]);

  // KPI overview en base a filteredRecords
  const overview = useMemo(() => {
    const total = filteredRecords.length;
    const totalWeb = filteredCitas.length;
    const totalKiosko = filteredTurnos.length;

    const atendidas = filteredRecords.filter((r) => r.estadoKey === "completado").length;
    const noPresento = filteredRecords.filter((r) => (r.clasificacion || r.estadoKey) === "NO_SE_PRESENTO").length;

    const porEstado = countBy(filteredRecords, (r) => r.estadoKey);
    const porTramite = countBy(filteredRecords, (r) => r.tramiteKey);
    const porAgente = countBy(filteredRecords, (r) => r.agenteKey);
    const porModulo = countBy(filteredRecords, (r) => r.moduloKey);

    return { total, totalWeb, totalKiosko, atendidas, noPresento, porEstado, porTramite, porAgente, porModulo };
  }, [filteredRecords, filteredCitas, filteredTurnos]);

  // agrupaciones preferentes (si el backend las trajo, igual las recalculamos por filtros)
  const byAgente = useMemo(() => overview.porAgente, [overview]);
  const byModulo = useMemo(() => overview.porModulo, [overview]);
  const byTramite = useMemo(() => overview.porTramite, [overview]);

  // reporte por DNI (usuario/ciudadano)
  const byDni = useMemo(() => {
    const m = new Map();
    filteredRecords.forEach((r) => {
      const dni = r.dniKey || "SIN_DNI";
      const prev = m.get(dni) || { dni, total: 0, web: 0, kiosko: 0, esperaMs: [], atencionMs: [] };
      prev.total += 1;
      if (r.__origen === "WEB") prev.web += 1;
      if (r.__origen === "KIOSKO") prev.kiosko += 1;
      if (Number.isFinite(Number(r.esperaMs))) prev.esperaMs.push(Number(r.esperaMs));
      if (Number.isFinite(Number(r.atencionMs))) prev.atencionMs.push(Number(r.atencionMs));
      m.set(dni, prev);
    });

    const rows = Array.from(m.values()).map((x) => {
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      return {
        dni: x.dni,
        total: x.total,
        web: x.web,
        kiosko: x.kiosko,
        esperaAvgMin: msToMin(avg(x.esperaMs)),
        atencionAvgMin: msToMin(avg(x.atencionMs)),
      };
    });

    rows.sort((a, b) => (b.total || 0) - (a.total || 0));
    return rows;
  }, [filteredRecords]);

  // tiempos (para filtros, recalculamos desde filteredRecords)
  const tiempos = useMemo(() => {
    const esperaVals = [];
    const atVals = [];
    const esperaItems = [];
    const atItems = [];

    filteredRecords.forEach((r) => {
      if (Number.isFinite(Number(r.esperaMs))) {
        const ms = Number(r.esperaMs);
        esperaVals.push(ms);
        esperaItems.push({ id: r.id, codigo: r.codigo || r.id, origen: r.__origen, modulo: r.moduloKey, esperaMs: ms });
      }
      if (Number.isFinite(Number(r.atencionMs))) {
        const ms = Number(r.atencionMs);
        atVals.push(ms);
        atItems.push({ id: r.id, codigo: r.codigo || r.id, origen: r.__origen, modulo: r.moduloKey, atencionMs: ms });
      }
    });

    const min = (arr) => (arr.length ? Math.min(...arr) : null);
    const max = (arr) => (arr.length ? Math.max(...arr) : null);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    esperaItems.sort((a, b) => b.esperaMs - a.esperaMs);
    atItems.sort((a, b) => b.atencionMs - a.atencionMs);

    return {
      espera: { minMs: min(esperaVals), avgMs: avg(esperaVals), maxMs: max(esperaVals) },
      atencion: { minMs: min(atVals), avgMs: avg(atVals), maxMs: max(atVals) },
      topEsperaMax: esperaItems.slice(0, 15),
      topAtencionMax: atItems.slice(0, 15),
    };
  }, [filteredRecords]);

  const fetchAgentsInfo = async (uids) => {
    try {
      const chunkSize = 10;
      const all = {};
      for (let i = 0; i < uids.length; i += chunkSize) {
        const chunk = uids.slice(i, i + chunkSize);
        const qUsers = query(collection(db, "usuarios"), where(documentId(), "in", chunk));
        const snap = await getDocs(qUsers);
        snap.docs.forEach((d) => (all[d.id] = d.data()));
      }
      setAgentsMap(all);
    } catch (err) {
      console.warn("No se pudo cargar info agentes (usuarios):", err);
    }
  };

  const openDetails = (record) => {
    if (!record) return;
    setSelectedRecord(record);
    setModalOpen(true);
  };

  const closeDetails = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  const fetchMetrics = async () => {
    if (!startDateISO || !endDateISO) {
      alert("Selecciona un rango de fechas.");
      return;
    }

    setLoading(true);
    setStats(null);
    setAgentsMap({});
    setModalOpen(false);
    setSelectedRecord(null);

    try {
      const functions = getFunctions(app, FUNCTIONS_REGION);
      const fn = httpsCallable(functions, "getMetricsData");
      const res = await fn({ startDateISO, endDateISO });
      const data = res?.data || null;
      setStats(data);

      const agenteIds = new Set();
      (data?.detalleCitas || []).forEach((r) => r?.agenteID && agenteIds.add(r.agenteID));
      (data?.detalleTurnos || []).forEach((r) => r?.agenteID && agenteIds.add(r.agenteID));
      if (agenteIds.size > 0) await fetchAgentsInfo(Array.from(agenteIds));
    } catch (err) {
      console.error("Error al cargar métricas:", err);
      alert("Error al cargar métricas. Revisa logs / índices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const canExport = !!stats && !loading;

  const getAgentLabel = (uid) => {
    const ag = agentsMap?.[uid] || {};
    return ag.nombreCompleto || ag.email || (uid === "SIN_AGENTE" ? "SIN AGENTE" : uid);
  };

  const exportExcel = async () => {
    await exportAllToExcelPro({
      filename: `metrics_${startDateISO}_a_${endDateISO}.xlsx`,
      overview,
      tiempos,
      byAgente,
      byModulo,
      byTramite,
      detalleCitas: filteredCitas,
      detalleTurnos: filteredTurnos,
      agentsMap,
    });
  };

  const exportPDF = () => {
    // Armamos un “documento” imprimible con tablas + gráficos (si están activos)
    const rangeText = `Rango: ${startDateISO} → ${endDateISO} · Filtros: Origen=${originFilter}, Estado=${estadoFilter}, Módulo=${moduloFilter}, Trámite=${tramiteFilter}, Agente=${agenteFilter}`;

    const topEstado = overview.porEstado.slice(0, topN);
    const topModulo = byModulo.slice(0, topN);
    const topTramite = byTramite.slice(0, topN);
    const topAgente = byAgente.slice(0, topN).map((x) => ({ ...x, label: getAgentLabel(x.key) }));

    const sections = [];

    sections.push({
      title: "KPIs Resumen",
      kpis: [
        { label: "Total registros", value: overview.total, hint: `WEB: ${overview.totalWeb} · KIOSKO: ${overview.totalKiosko}` },
        { label: "Completadas", value: overview.atendidas, hint: "Estado = completado" },
        { label: "No se presentó", value: overview.noPresento, hint: "Clasificación = NO_SE_PRESENTO" },
        { label: "Espera promedio", value: `${msToMin(tiempos.espera.avgMs)} min`, hint: `Min ${msToMin(tiempos.espera.minMs)} · Max ${msToMin(tiempos.espera.maxMs)}` },
      ],
    });

    // Por Estado
    sections.push({
      title: `Top ${topN} por Estado`,
      table: {
        headers: ["Estado", "Cantidad"],
        rows: topEstado.map((x) => [x.key, x.count]),
      },
      chartBase64: showCharts ? makeChartImageBase64({
        type: "bar",
        labels: topEstado.map((x) => x.key),
        values: topEstado.map((x) => x.count),
        title: `Por Estado (Top ${topN})`
      }) : null
    });

    // Por Módulo
    sections.push({
      title: `Top ${topN} por Módulo`,
      table: {
        headers: ["Módulo", "Cantidad"],
        rows: topModulo.map((x) => [x.key, x.count]),
      },
      chartBase64: showCharts ? makeChartImageBase64({
        type: "bar",
        labels: topModulo.map((x) => x.key),
        values: topModulo.map((x) => x.count),
        title: `Por Módulo (Top ${topN})`
      }) : null
    });

    // Por Trámite
    sections.push({
      title: `Top ${topN} por Trámite`,
      table: {
        headers: ["Trámite", "Cantidad"],
        rows: topTramite.map((x) => [x.key, x.count]),
      },
      chartBase64: showCharts ? makeChartImageBase64({
        type: "bar",
        labels: topTramite.map((x) => x.key),
        values: topTramite.map((x) => x.count),
        title: `Por Trámite (Top ${topN})`
      }) : null
    });

    // Por Agente
    sections.push({
      title: `Top ${topN} por Agente`,
      table: {
        headers: ["Agente", "UID", "Cantidad"],
        rows: topAgente.map((x) => [x.label, x.key, x.count]),
      },
      chartBase64: showCharts ? makeChartImageBase64({
        type: "bar",
        labels: topAgente.map((x) => x.label),
        values: topAgente.map((x) => x.count),
        title: `Por Agente (Top ${topN})`
      }) : null
    });

    // Tiempos
    sections.push({
      title: "Tiempos (Resumen)",
      table: {
        headers: ["Métrica", "Min (min)", "Prom (min)", "Max (min)"],
        rows: [
          ["Espera", msToMin(tiempos.espera.minMs), msToMin(tiempos.espera.avgMs), msToMin(tiempos.espera.maxMs)],
          ["Atención", msToMin(tiempos.atencion.minMs), msToMin(tiempos.atencion.avgMs), msToMin(tiempos.atencion.maxMs)],
        ],
      },
    });

    const html = buildPrintableHTML({
      title: "Reporte de Métricas (Sistema de Citas)",
      rangeText,
      sections,
    });

    const w = window.open("", "_blank");
    if (!w) return alert("Bloqueado por el navegador. Permite popups para exportar PDF.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const resetFilters = () => {
    setOriginFilter("ALL");
    setEstadoFilter("ALL");
    setModuloFilter("ALL");
    setTramiteFilter("ALL");
    setAgenteFilter("ALL");
    setTopN(12);
    setSearchText("");
  };

  const renderCountTable = ({ title, rows, keyLabel, keyToLabel }) => {
    const top = rows.slice(0, topN);

    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>{title}</h3>
          <span style={styles.badge("#f3f4f6", "#111")}>Top {topN}</span>
        </div>

        <div style={{ marginTop: 10, ...styles.tableWrap }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{keyLabel}</th>
                <th style={styles.th}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {top.map((x) => (
                <tr key={x.key}>
                  <td style={styles.td}>{keyToLabel ? keyToLabel(x.key) : x.key}</td>
                  <td style={styles.td}><span style={styles.badge("#eaf2ff", "#0b3d91")}>{x.count}</span></td>
                </tr>
              ))}
              {top.length === 0 ? (
                <tr><td style={styles.td} colSpan={2}>Sin datos.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {showCharts && top.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <ReportChart
              title={title}
              type="bar"
              labels={top.map((x) => (keyToLabel ? keyToLabel(x.key) : x.key))}
              values={top.map((x) => x.count)}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderTiempos = () => {
    const topEspera = (tiempos.topEsperaMax || []).slice(0, 15);
    const topAt = (tiempos.topAtencionMax || []).slice(0, 15);

    return (
      <div>
        <div style={{ ...styles.kpiGrid, marginTop: 6 }}>
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Espera promedio</div>
            <div style={styles.kpiValue}>{msToMin(tiempos.espera.avgMs)} min</div>
            <div style={styles.kpiHint}>Min: {msToMin(tiempos.espera.minMs)} · Max: {msToMin(tiempos.espera.maxMs)}</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Atención promedio</div>
            <div style={styles.kpiValue}>{msToMin(tiempos.atencion.avgMs)} min</div>
            <div style={styles.kpiHint}>Min: {msToMin(tiempos.atencion.minMs)} · Max: {msToMin(tiempos.atencion.maxMs)}</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Registros WEB</div>
            <div style={styles.kpiValue}>{overview.totalWeb}</div>
            <div style={styles.kpiHint}>Con filtros aplicados</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Registros KIOSKO</div>
            <div style={styles.kpiValue}>{overview.totalKiosko}</div>
            <div style={styles.kpiHint}>Con filtros aplicados</div>
          </div>
        </div>

        <div style={{ ...styles.split2, marginTop: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Top mayor espera</h3>
            <p style={{ ...styles.small, marginTop: 6 }}>(llamado - origen) en minutos</p>

            <div style={{ marginTop: 10, ...styles.tableWrap }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Origen</th>
                    <th style={styles.th}>Módulo</th>
                    <th style={styles.th}>Min</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {topEspera.map((x) => (
                    <tr key={x.id}>
                      <td style={styles.td}><strong>{x.codigo || x.id}</strong></td>
                      <td style={styles.td}>{x.origen}</td>
                      <td style={styles.td}>{x.modulo || "-"}</td>
                      <td style={styles.td}><span style={styles.badge("#fff3cd", "#856404")}>{msToMin(x.esperaMs)}</span></td>
                      <td style={styles.td}>
                        <button style={styles.buttonSecondary} onClick={() => {
                          const rec = filteredRecords.find((r) => r.id === x.id);
                          openDetails(rec);
                        }}>Ver</button>
                      </td>
                    </tr>
                  ))}
                  {topEspera.length === 0 ? (
                    <tr><td style={styles.td} colSpan={5}>Sin datos (se requiere llamado para calcular).</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {showCharts && topEspera.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <ReportChart title="Top mayor espera (min)" type="bar"
                  labels={topEspera.map((x) => x.codigo || x.id)}
                  values={topEspera.map((x) => msToMin(x.esperaMs))}
                />
              </div>
            ) : null}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Top mayor tiempo de atención</h3>
            <p style={{ ...styles.small, marginTop: 6 }}>(fin - llamado) en minutos</p>

            <div style={{ marginTop: 10, ...styles.tableWrap }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Origen</th>
                    <th style={styles.th}>Módulo</th>
                    <th style={styles.th}>Min</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {topAt.map((x) => (
                    <tr key={x.id}>
                      <td style={styles.td}><strong>{x.codigo || x.id}</strong></td>
                      <td style={styles.td}>{x.origen}</td>
                      <td style={styles.td}>{x.modulo || "-"}</td>
                      <td style={styles.td}><span style={styles.badge("#eaf2ff", "#0b3d91")}>{msToMin(x.atencionMs)}</span></td>
                      <td style={styles.td}>
                        <button style={styles.buttonSecondary} onClick={() => {
                          const rec = filteredRecords.find((r) => r.id === x.id);
                          openDetails(rec);
                        }}>Ver</button>
                      </td>
                    </tr>
                  ))}
                  {topAt.length === 0 ? (
                    <tr><td style={styles.td} colSpan={5}>Sin datos (se requiere fin de atención).</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {showCharts && topAt.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <ReportChart title="Top mayor atención (min)" type="bar"
                  labels={topAt.map((x) => x.codigo || x.id)}
                  values={topAt.map((x) => msToMin(x.atencionMs))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Métricas & KPI</h1>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.buttonSecondary} onClick={() => setControlOpen((v) => !v)}>
            {controlOpen ? "Ocultar controles" : "Mostrar controles"}
          </button>

          <button
            style={{
              ...styles.buttonSecondary,
              background: showCharts ? "#111" : "#fff",
              color: showCharts ? "#fff" : "#111",
            }}
            onClick={() => setShowCharts((v) => !v)}
            disabled={!stats}
          >
            {showCharts ? "Gráficos: ON" : "Gráficos: OFF"}
          </button>
        </div>
      </div>

      <RecordModal open={modalOpen} onClose={closeDetails} record={selectedRecord} agentsMap={agentsMap} />

      {/* CONTROL CENTER (desplegable) */}
      <div style={styles.card} className={`metrics-control ${controlOpen ? "open" : "closed"}`}>
        <div className="metrics-control-head">
          <div>
            <div className="metrics-control-title">Panel de Control</div>
            <p style={styles.small}>
              Filtra, compara y exporta. Todo lo que ves se actualiza con estos filtros (incluye gráficos y exportaciones).
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={styles.buttonSecondary} onClick={resetFilters} disabled={!stats}>
              Reset filtros
            </button>

            <button style={styles.button} onClick={fetchMetrics} disabled={loading || !isAdmin}>
              {loading ? "Cargando..." : "Actualizar datos"}
            </button>

            <button
              onClick={exportExcel}
              style={{
                ...styles.button,
                backgroundColor: canExport ? "#0f7a2a" : "#9ca3af",
                cursor: canExport ? "pointer" : "not-allowed",
              }}
              disabled={!canExport}
              title="Exporta todo a Excel (respeta filtros y búsqueda)"
            >
              Exportar Excel
            </button>

            <button
              onClick={exportPDF}
              style={{
                ...styles.buttonSecondary,
                borderColor: "#cfe0ff",
                backgroundColor: "#eaf2ff",
                color: "#0b3d91",
                cursor: canExport ? "pointer" : "not-allowed",
              }}
              disabled={!canExport}
              title="Abre documento imprimible para guardar como PDF"
            >
              Exportar Documento / PDF
            </button>
          </div>
        </div>

        {controlOpen ? (
          <div className="metrics-control-body">
            <div className="metrics-control-grid">
              <div>
                <div className="metrics-label">Desde</div>
                <input type="date" value={startDateISO} onChange={(e) => setStartDateISO(e.target.value)} style={styles.input} />
              </div>

              <div>
                <div className="metrics-label">Hasta</div>
                <input type="date" value={endDateISO} onChange={(e) => setEndDateISO(e.target.value)} style={styles.input} />
              </div>

              <div>
                <div className="metrics-label">Origen</div>
                <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} style={styles.select} disabled={!stats}>
                  <option value="ALL">Todos</option>
                  <option value="WEB">WEB</option>
                  <option value="KIOSKO">KIOSKO</option>
                </select>
              </div>

              <div>
                <div className="metrics-label">Estado</div>
                <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} style={styles.select} disabled={!stats}>
                  {estadoOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div>
                <div className="metrics-label">Módulo</div>
                <select value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)} style={styles.select} disabled={!stats}>
                  {moduloOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div>
                <div className="metrics-label">Trámite</div>
                <select value={tramiteFilter} onChange={(e) => setTramiteFilter(e.target.value)} style={styles.select} disabled={!stats}>
                  {tramiteOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div>
                <div className="metrics-label">Agente</div>
                <select value={agenteFilter} onChange={(e) => setAgenteFilter(e.target.value)} style={styles.select} disabled={!stats}>
                  {agenteOptions.map((x) => <option key={x} value={x}>{getAgentLabel(x)}</option>)}
                </select>
              </div>

              <div>
                <div className="metrics-label">Top N</div>
                <select value={topN} onChange={(e) => setTopN(parseInt(e.target.value, 10))} style={styles.select} disabled={!stats}>
                  {[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="metrics-control-search">
                <div className="metrics-label">Buscar (en detalle)</div>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ ...styles.input, width: "100%" }}
                  placeholder="código, dni, trámite, agente, estado…"
                  disabled={!stats}
                />
              </div>
            </div>

            {!isAdmin ? (
              <p style={{ marginTop: 10 }}>
                <span style={styles.badge("#f8d7da", "#721c24")}>No autorizado</span>{" "}
                Solo administradores pueden ver métricas.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* TABS */}
      <div style={styles.card}>
        <div style={styles.tabs}>
          {[
            ["resumen", "Resumen"],
            ["agentes", "Agentes"],
            ["modulos", "Módulos"],
            ["tramites", "Trámites"],
            ["tiempos", "Tiempos"],
            ["usuarios", "Usuarios (DNI)"],
            ["detalleWeb", "Detalle WEB"],
            ["detalleKiosko", "Detalle KIOSKO"],
          ].map(([k, label]) => (
            <button
              key={k}
              style={{ ...styles.tab, ...(activeTab === k ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(k)}
              disabled={!stats}
              title={!stats ? "Carga métricas primero" : ""}
            >
              {label}
            </button>
          ))}
        </div>

        {!stats && !loading && <p style={styles.small}>Selecciona rango y presiona “Actualizar datos”.</p>}
        {loading && <p style={styles.small}>Cargando métricas…</p>}

        {stats && activeTab === "resumen" && (
          <>
            <div style={styles.kpiGrid}>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Total registros</div>
                <div style={styles.kpiValue}>{overview.total}</div>
                <div style={styles.kpiHint}>WEB: {overview.totalWeb} · KIOSKO: {overview.totalKiosko}</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Completadas</div>
                <div style={styles.kpiValue}>{overview.atendidas}</div>
                <div style={styles.kpiHint}>Estado = completado</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>No se presentó</div>
                <div style={styles.kpiValue}>{overview.noPresento}</div>
                <div style={styles.kpiHint}>Clasificación = NO_SE_PRESENTO</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Espera promedio</div>
                <div style={styles.kpiValue}>{msToMin(tiempos.espera.avgMs)} min</div>
                <div style={styles.kpiHint}>Min {msToMin(tiempos.espera.minMs)} · Max {msToMin(tiempos.espera.maxMs)}</div>
              </div>
            </div>

            {renderCountTable({ title: "Por Estado", rows: overview.porEstado, keyLabel: "Estado" })}
            {renderCountTable({ title: "Por Trámite (Top)", rows: byTramite, keyLabel: "Trámite" })}
            {renderCountTable({ title: "Por Módulo (Top)", rows: byModulo, keyLabel: "Módulo" })}
          </>
        )}

        {stats && activeTab === "agentes" && (
          renderCountTable({
            title: "Atenciones por Agente",
            rows: byAgente,
            keyLabel: "Agente",
            keyToLabel: (uid) => getAgentLabel(uid),
          })
        )}

        {stats && activeTab === "modulos" && (
          renderCountTable({ title: "Atenciones por Módulo", rows: byModulo, keyLabel: "Módulo" })
        )}

        {stats && activeTab === "tramites" && (
          renderCountTable({ title: "Atenciones por Trámite", rows: byTramite, keyLabel: "Trámite" })
        )}

        {stats && activeTab === "tiempos" && renderTiempos()}

        {stats && activeTab === "usuarios" && (
          <>
            <p style={styles.small}>
              Mostrando {byDni.length} usuarios (DNI). Con filtros aplicados.
            </p>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>DNI</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>WEB</th>
                    <th style={styles.th}>KIOSKO</th>
                    <th style={styles.th}>Espera prom (min)</th>
                    <th style={styles.th}>Atención prom (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {byDni.slice(0, 50).map((r) => (
                    <tr key={r.dni}>
                      <td style={styles.td}><strong>{r.dni}</strong></td>
                      <td style={styles.td}><span style={styles.badge("#eaf2ff", "#0b3d91")}>{r.total}</span></td>
                      <td style={styles.td}>{r.web}</td>
                      <td style={styles.td}>{r.kiosko}</td>
                      <td style={styles.td}>{r.esperaAvgMin}</td>
                      <td style={styles.td}>{r.atencionAvgMin}</td>
                    </tr>
                  ))}
                  {byDni.length === 0 ? (
                    <tr><td style={styles.td} colSpan={6}>Sin datos.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {showCharts && byDni.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <ReportChart
                  title={`Usuarios (DNI) por cantidad (Top ${topN})`}
                  type="bar"
                  labels={byDni.slice(0, topN).map((x) => x.dni)}
                  values={byDni.slice(0, topN).map((x) => x.total)}
                />
              </div>
            ) : null}
          </>
        )}

        {stats && activeTab === "detalleWeb" && (
          <>
            <p style={styles.small}>Mostrando {filteredCitas.length} registros (WEB) con filtros.</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>DNI</th>
                    <th style={styles.th}>Trámite</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Agente</th>
                    <th style={styles.th}>Módulo</th>
                    <th style={styles.th}>Espera</th>
                    <th style={styles.th}>Atención</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCitas.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}><strong>{r.codigo || r.id}</strong></td>
                      <td style={styles.td}>{r.dniKey}</td>
                      <td style={styles.td}>{r.tramiteKey}</td>
                      <td style={styles.td}>
                        <span style={styles.badge("#f3f4f6", "#111")}>{r.estadoKey}</span>{" "}
                        {r.clasificacion ? <span style={styles.badge("#eaf2ff", "#0b3d91")}>{r.clasificacion}</span> : null}
                      </td>
                      <td style={styles.td}>{getAgentLabel(r.agenteKey)}</td>
                      <td style={styles.td}>{r.moduloKey}</td>
                      <td style={styles.td}>{msToMin(r.esperaMs)} min</td>
                      <td style={styles.td}>{msToMin(r.atencionMs)} min</td>
                      <td style={styles.td}><button style={styles.buttonSecondary} onClick={() => openDetails(r)}>Ver</button></td>
                    </tr>
                  ))}
                  {filteredCitas.length === 0 ? (
                    <tr><td style={styles.td} colSpan={9}>Sin resultados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}

        {stats && activeTab === "detalleKiosko" && (
          <>
            <p style={styles.small}>Mostrando {filteredTurnos.length} registros (KIOSKO) con filtros.</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Trámite</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Agente</th>
                    <th style={styles.th}>Módulo</th>
                    <th style={styles.th}>Espera</th>
                    <th style={styles.th}>Atención</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTurnos.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}><strong>{r.codigo || r.id}</strong></td>
                      <td style={styles.td}>{r.tramiteKey}</td>
                      <td style={styles.td}>
                        <span style={styles.badge("#f3f4f6", "#111")}>{r.estadoKey}</span>{" "}
                        {r.clasificacion ? <span style={styles.badge("#eaf2ff", "#0b3d91")}>{r.clasificacion}</span> : null}
                      </td>
                      <td style={styles.td}>{getAgentLabel(r.agenteKey)}</td>
                      <td style={styles.td}>{r.moduloKey}</td>
                      <td style={styles.td}>{msToMin(r.esperaMs)} min</td>
                      <td style={styles.td}>{msToMin(r.atencionMs)} min</td>
                      <td style={styles.td}><button style={styles.buttonSecondary} onClick={() => openDetails(r)}>Ver</button></td>
                    </tr>
                  ))}
                  {filteredTurnos.length === 0 ? (
                    <tr><td style={styles.td} colSpan={8}>Sin resultados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
