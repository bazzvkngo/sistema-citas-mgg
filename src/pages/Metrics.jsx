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

function msToHMS(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "--:--:--";
  const s = Math.floor(n / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function countBy(list, getKey) {
  const m = new Map();
  list.forEach((r) => {
    const k = String(getKey(r) ?? "-");
    m.set(k, (m.get(k) || 0) + 1);
  });
  return Array.from(m.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
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
      plugins: { legend: { display: false }, title: { display: !!title, text: title || "" } }
    }
  });

  chart.update();
  const b64 = canvas.toDataURL("image/png");
  chart.destroy();
  return b64;
}

function buildPrintableHTML({ title, subtitle, sections }) {
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
      .kpiGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .kpi { border: 1px solid #eee; border-radius: 12px; padding: 10px; }
      .kpi .l { font-size: 11px; color: #666; font-weight: 800; margin-bottom: 6px; }
      .kpi .v { font-size: 18px; font-weight: 900; }
      .hint { font-size:11px;color:#777;font-weight:700;margin-top:6px; line-height: 1.25; }
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
            ${s.kpis
              .map(
                (k) =>
                  `<div class="kpi"><div class="l">${k.label}</div><div class="v">${k.value}</div><div class="hint">${k.hint || ""}</div></div>`
              )
              .join("")}
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
        <p class="sub">${subtitle || ""}</p>
        ${body}
      </body>
    </html>
  `;
}

async function exportAllToExcelPro({
  filename,
  overview,
  tiempos,
  byAgente,
  byModulo,
  byTramiteStats,
  detalleCitas,
  detalleTurnos,
  agentsMap
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Citas";
  wb.created = new Date();

  const boldHeader = (row) => {
    row.font = { bold: true };
    row.alignment = { vertical: "middle" };
  };

  const sResumen = wb.addWorksheet("Resumen");
  boldHeader(sResumen.addRow(["Métrica", "Valor"]));
  sResumen.addRow(["Total registros", overview.total]);
  sResumen.addRow(["WEB", overview.totalWeb]);
  sResumen.addRow(["KIOSKO", overview.totalKiosko]);
  sResumen.addRow(["Completadas", overview.atendidas]);
  sResumen.addRow(["No se presentó", overview.noPresento]);
  sResumen.addRow(["Espera promedio (min)", msToMin(tiempos.espera.avgMs)]);
  sResumen.addRow(["Atención promedio (min)", msToMin(tiempos.atencion.avgMs)]);

  const sTraStats = wb.addWorksheet("Tramites_Tiempos");
  boldHeader(sTraStats.addRow(["Trámite", "Cantidad", "Espera Promedio", "Atención Promedio", "Atención Máxima"]));
  byTramiteStats.forEach((t) => {
    sTraStats.addRow([t.tramite, t.count, msToHMS(t.esperaAvgMs), msToHMS(t.atencionAvgMs), msToHMS(t.atencionMaxMs)]);
  });

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

  const sC = wb.addWorksheet("DetalleCitas_WEB");
  boldHeader(
    sC.addRow([
      "ID",
      "Código",
      "DNI",
      "Trámite",
      "Estado",
      "Clasificación",
      "Agente",
      "Módulo",
      "FechaHora",
      "Llamado",
      "Fin",
      "Espera(min)",
      "Atención(min)"
    ])
  );
  detalleCitas.forEach((r) => {
    const ag = agentsMap?.[r.agenteID] || {};
    const label = ag.nombreCompleto || ag.email || r.agenteID || "";
    sC.addRow([
      r.id,
      r.codigo || "",
      r.dni || r.dniCiudadano || "",
      r.tramiteID || "",
      r.estado || "",
      r.clasificacion || "",
      label,
      r.moduloAsignado || "",
      fmtDate(r.fechaHora),
      fmtDate(r.llamadoAt),
      fmtDate(r.finAt),
      msToMin(r.esperaMs),
      msToMin(r.atencionMs)
    ]);
  });

  const sK = wb.addWorksheet("DetalleTurnos_KIOSKO");
  boldHeader(
    sK.addRow([
      "ID",
      "Código",
      "Trámite",
      "Estado",
      "Clasificación",
      "Agente",
      "Módulo",
      "Generado",
      "Llamado",
      "Fin",
      "Espera(min)",
      "Atención(min)"
    ])
  );
  detalleTurnos.forEach((r) => {
    const ag = agentsMap?.[r.agenteID] || {};
    const label = ag.nombreCompleto || ag.email || r.agenteID || "";
    sK.addRow([
      r.id,
      r.codigo || "",
      r.tramiteID || "",
      r.estado || "",
      r.clasificacion || "",
      label,
      r.modulo || "",
      fmtDate(r.fechaHoraGenerado || r.createdAt || r.fechaHora),
      fmtDate(r.llamadoAt),
      fmtDate(r.finAt),
      msToMin(r.esperaMs),
      msToMin(r.atencionMs)
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
  const badgeClass =
    clasificacion === "ATENDIDO_OK" ||
    clasificacion === "ATENDIDO" ||
    clasificacion === "TRAMITE_OK" ||
    record.estadoKey === "completado"
      ? "metrics-badge ok"
      : clasificacion === "NO_SE_PRESENTO"
      ? "metrics-badge bad"
      : "metrics-badge warn";

  const printCase = () => {
    const subtitle = `Caso: ${record.codigo || record.id} · Trámite: ${
      record.tramiteID || record.tramiteKey || "-"
    } · Fecha: ${fmtDate(record.fechaHora || record.fechaHoraGenerado || record.createdAt)}`;

    const html = buildPrintableHTML({
      title: "Copia de Cierre de Atención",
      subtitle,
      sections: [
        {
          title: "Detalle del Caso",
          table: {
            headers: ["Campo", "Valor"],
            rows: [
              ["Origen", origen],
              ["Código", record.codigo || record.id || ""],
              ["DNI/RUT", record.dni || record.dniCiudadano || ""],
              ["Nombre", record.nombreCiudadano || ""],
              ["Trámite", record.tramiteID || record.tramiteKey || ""],
              ["Módulo", record.moduloAsignado || record.modulo || ""],
              ["Agente", ag.nombreCompleto || ag.email || record.agenteID || ""],
              ["Estado", record.estadoKey || record.estado || ""],
              ["Clasificación", record.clasificacion || ""],
              ["Fecha/Hora", fmtDate(record.fechaHora || record.fechaHoraGenerado || record.createdAt)],
              ["Llamado", fmtDate(record.llamadoAt)],
              ["Fin", fmtDate(record.finAt)],
              ["Tiempo espera", msToHMS(record.esperaMs)],
              ["Tiempo atención", msToHMS(record.atencionMs)],
              ["Comentarios agente", record.comentariosAgente || ""]
            ]
          }
        }
      ]
    });

    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up bloqueado. Permite ventanas emergentes para imprimir.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div onClick={onClose} className="metrics-modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="metrics-modal">
        <div className="metrics-modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{titulo}</h3>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="metrics-badge neutral">{origen}</span>
              <span className={badgeClass}>{clasificacion || record.estadoKey || "—"}</span>
              <span className="metrics-badge neutral">Módulo: {record.moduloAsignado || record.modulo || "—"}</span>
              <span className="metrics-badge neutral">Trámite: {record.tramiteID || record.tramiteKey || "—"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={printCase} className="metrics-btn secondary">
              Imprimir / PDF
            </button>
            <button onClick={onClose} className="metrics-btn secondary">
              Cerrar
            </button>
          </div>
        </div>

        <div className="metrics-modal-grid">
          <div className="metrics-modal-box">
            <div className="metrics-modal-label">Agente</div>
            <div className="metrics-modal-value">{ag.nombreCompleto || ag.email || record.agenteID || "—"}</div>
          </div>
          <div className="metrics-modal-box">
            <div className="metrics-modal-label">Ciudadano</div>
            <div className="metrics-modal-value">
              {record.dni || record.dniCiudadano || "—"}{" "}
              {record.nombreCiudadano ? `· ${record.nombreCiudadano}` : ""}
            </div>
          </div>
        </div>

        <div className="metrics-modal-box" style={{ marginTop: 10 }}>
          <div className="metrics-modal-row">
            <div>
              <span className="metrics-modal-label">Fecha/Hora: </span>
              <strong>{fmtDate(record.fechaHora || record.fechaHoraGenerado || record.createdAt)}</strong>
            </div>
            <div>
              <span className="metrics-modal-label">Llamado: </span>
              <strong>{fmtDate(record.llamadoAt)}</strong>
            </div>
            <div>
              <span className="metrics-modal-label">Fin: </span>
              <strong>{fmtDate(record.finAt)}</strong>
            </div>
            <div>
              <span className="metrics-modal-label">Espera: </span>
              <strong>{msToHMS(record.esperaMs)}</strong>
            </div>
            <div>
              <span className="metrics-modal-label">Atención: </span>
              <strong>{msToHMS(record.atencionMs)}</strong>
            </div>
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

function TramiteModal({ open, onClose, tramiteName, records, agentsMap, rangeText }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const list = records || [];
  const total = list.length;
  const completados = list.filter((r) => r.estadoKey === "completado").length;
  const noPresento = list.filter((r) => (r.clasificacion || r.estadoKey) === "NO_SE_PRESENTO").length;

  const esperaVals = list.map((r) => Number(r.esperaMs)).filter((n) => Number.isFinite(n));
  const atVals = list.map((r) => Number(r.atencionMs)).filter((n) => Number.isFinite(n));
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const max = (arr) => (arr.length ? Math.max(...arr) : null);

  const printTramite = () => {
    const subtitle = `Trámite: ${tramiteName} · ${rangeText} · Total: ${total}`;

    const topRows = list.slice(0, 80).map((r) => [
      r.__origen,
      r.codigo || r.id,
      fmtDate(r.fechaHora || r.fechaHoraGenerado || r.createdAt),
      r.moduloAsignado || r.modulo || "",
      agentsMap?.[r.agenteID]?.nombreCompleto || agentsMap?.[r.agenteID]?.email || r.agenteID || "",
      r.estadoKey || r.estado || "",
      msToHMS(r.esperaMs),
      msToHMS(r.atencionMs)
    ]);

    const html = buildPrintableHTML({
      title: "Reporte por Trámite",
      subtitle,
      sections: [
        {
          title: "KPIs del Trámite",
          kpis: [
            { label: "Total", value: total, hint: "Registros filtrados" },
            { label: "Completados", value: completados, hint: "estado = completado" },
            { label: "No se presentó", value: noPresento, hint: "clasificación NO_SE_PRESENTO" },
            { label: "Atención prom.", value: msToHMS(avg(atVals)), hint: `Máx: ${msToHMS(max(atVals))}` }
          ]
        },
        {
          title: "Detalle (top 80)",
          table: {
            headers: ["Origen", "Código", "Fecha", "Módulo", "Agente", "Estado", "Espera", "Atención"],
            rows: topRows
          }
        }
      ]
    });

    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up bloqueado. Permite ventanas emergentes para imprimir.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div onClick={onClose} className="metrics-modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="metrics-modal" style={{ maxWidth: 980 }}>
        <div className="metrics-modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Trámite: {tramiteName}</h3>
            <div style={{ marginTop: 6, fontSize: 12, color: "#666", fontWeight: 800 }}>{rangeText}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={printTramite} className="metrics-btn secondary">
              Imprimir / PDF
            </button>
            <button onClick={onClose} className="metrics-btn secondary">
              Cerrar
            </button>
          </div>
        </div>

        <div className="metrics-kpiGrid" style={{ marginTop: 12 }}>
          <div className="metrics-kpi">
            <div className="metrics-kpiLabel">Total</div>
            <div className="metrics-kpiValue">{total}</div>
            <div className="metrics-kpiHint">Registros filtrados</div>
          </div>
          <div className="metrics-kpi">
            <div className="metrics-kpiLabel">Completados</div>
            <div className="metrics-kpiValue">{completados}</div>
            <div className="metrics-kpiHint">estado = completado</div>
          </div>
          <div className="metrics-kpi">
            <div className="metrics-kpiLabel">No se presentó</div>
            <div className="metrics-kpiValue">{noPresento}</div>
            <div className="metrics-kpiHint">clasificación</div>
          </div>
          <div className="metrics-kpi">
            <div className="metrics-kpiLabel">Atención promedio</div>
            <div className="metrics-kpiValue">{msToHMS(avg(atVals))}</div>
            <div className="metrics-kpiHint">Espera prom: {msToHMS(avg(esperaVals))}</div>
          </div>
        </div>

        <div className="metrics-tableWrap" style={{ marginTop: 12 }}>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Origen</th>
                <th>Código</th>
                <th>Fecha</th>
                <th>Módulo</th>
                <th>Agente</th>
                <th>Estado</th>
                <th>Espera</th>
                <th>Atención</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 120).map((r) => {
                const ag = agentsMap?.[r.agenteID] || {};
                const agLabel = ag.nombreCompleto || ag.email || r.agenteID || "";
                return (
                  <tr key={`${r.__origen}_${r.id}`}>
                    <td>{r.__origen}</td>
                    <td>{r.codigo || r.id}</td>
                    <td>{fmtDate(r.fechaHora || r.fechaHoraGenerado || r.createdAt)}</td>
                    <td>{r.moduloAsignado || r.modulo || ""}</td>
                    <td>{agLabel}</td>
                    <td>{r.estadoKey || r.estado || ""}</td>
                    <td>{msToHMS(r.esperaMs)}</td>
                    <td>{msToHMS(r.atencionMs)}</td>
                  </tr>
                );
              })}
              {total === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: "#666", fontWeight: 800, padding: 12 }}>
                    Sin registros para este trámite (con los filtros actuales).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="metrics-mini" style={{ marginTop: 10 }}>
            Mostrando {Math.min(120, total)} de {total} registros.
          </div>
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

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [originFilter, setOriginFilter] = useState("ALL"); // ALL | WEB | KIOSKO
  const [tramiteFilter, setTramiteFilter] = useState("ALL");
  const [moduloFilter, setModuloFilter] = useState("ALL");
  const [agenteFilter, setAgenteFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const [chartGroup, setChartGroup] = useState("TRAMITE"); // TRAMITE | AGENTE | MODULO | DIA
  const [chartType, setChartType] = useState("ATENCION_PROM"); // ATENCION_PROM | ESPERA_PROM | VOLUMEN | MIX

  const [agentsMap, setAgentsMap] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [tramiteModalOpen, setTramiteModalOpen] = useState(false);
  const [tramiteModalName, setTramiteModalName] = useState("");
  const [tramiteModalRecords, setTramiteModalRecords] = useState([]);

  const isAdmin = useMemo(() => {
    const r = currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil;
    return r === "admin" || currentUser?.isAdmin === true;
  }, [currentUser]);

  // ✅ Calcula espera/atención si no vienen desde backend
  const calcDurations = ({ baseTs, llamadoTs, finTs }) => {
    const base = safeToDate(baseTs);
    const llamado = safeToDate(llamadoTs);
    const fin = safeToDate(finTs);

    let esperaMs = null;
    let atencionMs = null;

    if (llamado && base) {
      esperaMs = Math.max(0, llamado.getTime() - base.getTime());
    }
    if (fin && llamado) {
      atencionMs = Math.max(0, fin.getTime() - llamado.getTime());
    }
    return { esperaMs, atencionMs };
  };

  const detalleCitas = useMemo(() => {
    const list = stats?.detalleCitas || [];
    return list.map((r) => {
      const llamadoAt = r.llamadoAt || r.fechaHoraLlamado || r.fechaHoraLlamadoAt || null;
      const finAt = r.finAt || r.fechaHoraAtencionFin || null;

      const computed = calcDurations({
        baseTs: r.fechaHora, // en WEB, base = hora de cita
        llamadoTs: llamadoAt,
        finTs: finAt
      });

      return {
        ...r,
        __origen: "WEB",
        llamadoAt,
        finAt,
        // si ya venían, los respetamos; si no, calculamos
        esperaMs: Number.isFinite(Number(r.esperaMs)) ? Number(r.esperaMs) : computed.esperaMs,
        atencionMs: Number.isFinite(Number(r.atencionMs)) ? Number(r.atencionMs) : computed.atencionMs,
        moduloKey: r.moduloAsignado || "SIN_MODULO",
        estadoKey: r.estado || "SIN_ESTADO",
        tramiteKey: r.tramiteID || "SIN_TRAMITE",
        agenteKey: r.agenteID || "SIN_AGENTE",
        dniKey: r.dni || r.dniCiudadano || "SIN_DNI"
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const detalleTurnos = useMemo(() => {
    const list = stats?.detalleTurnos || [];
    return list.map((r) => {
      const llamadoAt = r.llamadoAt || r.fechaHoraLlamado || null;
      const finAt = r.finAt || r.fechaHoraAtencionFin || null;

      const base = r.fechaHoraGenerado || r.createdAt || r.fechaHora || null;

      const computed = calcDurations({
        baseTs: base, // en KIOSKO, base = generado/createdAt
        llamadoTs: llamadoAt,
        finTs: finAt
      });

      return {
        ...r,
        __origen: "KIOSKO",
        llamadoAt,
        finAt,
        esperaMs: Number.isFinite(Number(r.esperaMs)) ? Number(r.esperaMs) : computed.esperaMs,
        atencionMs: Number.isFinite(Number(r.atencionMs)) ? Number(r.atencionMs) : computed.atencionMs,
        moduloKey: r.modulo || "SIN_MODULO",
        estadoKey: r.estado || "SIN_ESTADO",
        tramiteKey: r.tramiteID || "SIN_TRAMITE",
        agenteKey: r.agenteID || "SIN_AGENTE",
        dniKey: r.dni || r.dniCiudadano || "SIN_DNI"
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const allRecords = useMemo(() => [...detalleCitas, ...detalleTurnos], [detalleCitas, detalleTurnos]);

  const tramiteOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.tramiteKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const moduloOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.moduloKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const agenteOptions = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.agenteKey));
    return ["ALL", ...Array.from(set).sort()];
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    const t = searchText.trim().toLowerCase();
    return allRecords.filter((r) => {
      if (originFilter !== "ALL" && r.__origen !== originFilter) return false;
      if (tramiteFilter !== "ALL" && r.tramiteKey !== tramiteFilter) return false;
      if (moduloFilter !== "ALL" && r.moduloKey !== moduloFilter) return false;
      if (agenteFilter !== "ALL" && r.agenteKey !== agenteFilter) return false;

      if (t) {
        const blob = JSON.stringify(r).toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [allRecords, originFilter, tramiteFilter, moduloFilter, agenteFilter, searchText]);

  const filteredCitas = useMemo(() => filteredRecords.filter((r) => r.__origen === "WEB"), [filteredRecords]);
  const filteredTurnos = useMemo(() => filteredRecords.filter((r) => r.__origen === "KIOSKO"), [filteredRecords]);

  const overview = useMemo(() => {
    const total = filteredRecords.length;
    const totalWeb = filteredCitas.length;
    const totalKiosko = filteredTurnos.length;

    const atendidas = filteredRecords.filter((r) => r.estadoKey === "completado").length;
    const noPresento = filteredRecords.filter((r) => (r.clasificacion || r.estadoKey) === "NO_SE_PRESENTO").length;

    return { total, totalWeb, totalKiosko, atendidas, noPresento };
  }, [filteredRecords, filteredCitas, filteredTurnos]);

  const tiempos = useMemo(() => {
    const esperaVals = [];
    const atVals = [];
    filteredRecords.forEach((r) => {
      if (Number.isFinite(Number(r.esperaMs))) esperaVals.push(Number(r.esperaMs));
      if (Number.isFinite(Number(r.atencionMs))) atVals.push(Number(r.atencionMs));
    });

    const min = (arr) => (arr.length ? Math.min(...arr) : null);
    const max = (arr) => (arr.length ? Math.max(...arr) : null);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    return {
      espera: { minMs: min(esperaVals), avgMs: avg(esperaVals), maxMs: max(esperaVals) },
      atencion: { minMs: min(atVals), avgMs: avg(atVals), maxMs: max(atVals) }
    };
  }, [filteredRecords]);

  const byAgente = useMemo(() => countBy(filteredRecords, (r) => r.agenteKey), [filteredRecords]);
  const byModulo = useMemo(() => countBy(filteredRecords, (r) => r.moduloKey), [filteredRecords]);

  const byTramiteStats = useMemo(() => {
    const m = new Map();
    filteredRecords.forEach((r) => {
      const k = r.tramiteKey || "SIN_TRAMITE";
      const prev = m.get(k) || { tramite: k, count: 0, espera: [], atencion: [], atencionMax: 0 };
      prev.count += 1;
      if (Number.isFinite(Number(r.esperaMs))) prev.espera.push(Number(r.esperaMs));
      if (Number.isFinite(Number(r.atencionMs))) {
        const v = Number(r.atencionMs);
        prev.atencion.push(v);
        if (v > prev.atencionMax) prev.atencionMax = v;
      }
      m.set(k, prev);
    });

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const rows = Array.from(m.values()).map((x) => ({
      tramite: x.tramite,
      count: x.count,
      esperaAvgMs: avg(x.espera),
      atencionAvgMs: avg(x.atencion),
      atencionMaxMs: x.atencionMax || null
    }));

    // ordenamos por atención promedio, pero si no hay tiempos, igual quedan
    rows.sort((a, b) => (b.atencionAvgMs || 0) - (a.atencionAvgMs || 0));
    return rows;
  }, [filteredRecords]);

  const kpiMayorAtencion = useMemo(() => msToHMS(tiempos.atencion.maxMs), [tiempos]);
  const kpiAtencionProm = useMemo(() => msToHMS(tiempos.atencion.avgMs), [tiempos]);
  const kpiEsperaProm = useMemo(() => msToHMS(tiempos.espera.avgMs), [tiempos]);

  const kpiMenorEsperaPorTramite = useMemo(() => {
    const candidates = byTramiteStats.filter((x) => Number.isFinite(Number(x.esperaAvgMs)) && x.count >= 3);
    if (!candidates.length) return { label: "—", value: "--:--:--" };
    candidates.sort((a, b) => (a.esperaAvgMs || 0) - (b.esperaAvgMs || 0));
    return { label: candidates[0].tramite, value: msToHMS(candidates[0].esperaAvgMs) };
  }, [byTramiteStats]);

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
    setSelectedRecord(record);
    setModalOpen(true);
  };
  const closeDetails = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  const openTramite = (tramiteName) => {
    const list = filteredRecords.filter((r) => r.tramiteKey === tramiteName);
    setTramiteModalName(tramiteName);
    setTramiteModalRecords(list);
    setTramiteModalOpen(true);
  };
  const closeTramite = () => {
    setTramiteModalOpen(false);
    setTramiteModalName("");
    setTramiteModalRecords([]);
  };

  const getAgentLabel = (uid) => {
    const ag = agentsMap?.[uid] || {};
    return ag.nombreCompleto || ag.email || (uid === "SIN_AGENTE" ? "SIN AGENTE" : uid);
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

  const exportExcel = async () => {
    await exportAllToExcelPro({
      filename: `metrics_${startDateISO}_a_${endDateISO}.xlsx`,
      overview,
      tiempos,
      byAgente,
      byModulo,
      byTramiteStats,
      detalleCitas: filteredCitas,
      detalleTurnos: filteredTurnos,
      agentsMap
    });
  };

  // ✅ Chart model con fallback:
  // - Si estás en "Atención promedio" pero NO hay datos de atención, cambia automáticamente a "Volumen"
  const chartModel = useMemo(() => {
    const groupMap = new Map();

    const getGroupKey = (r) => {
      if (chartGroup === "AGENTE") return r.agenteKey;
      if (chartGroup === "MODULO") return r.moduloKey;
      if (chartGroup === "DIA") {
        const d = safeToDate(r.fechaHora || r.fechaHoraGenerado || r.createdAt);
        return d ? format(d, "yyyy-MM-dd") : "SIN_FECHA";
      }
      return r.tramiteKey;
    };

    filteredRecords.forEach((r) => {
      const k = String(getGroupKey(r) || "-");
      const prev = groupMap.get(k) || { key: k, count: 0, espera: [], atencion: [] };
      prev.count += 1;
      if (Number.isFinite(Number(r.esperaMs))) prev.espera.push(Number(r.esperaMs));
      if (Number.isFinite(Number(r.atencionMs))) prev.atencion.push(Number(r.atencionMs));
      groupMap.set(k, prev);
    });

    const avgOrNull = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    let rows = Array.from(groupMap.values()).map((x) => ({
      key: x.key,
      count: x.count,
      esperaAvgMin: avgOrNull(x.espera) != null ? avgOrNull(x.espera) / 60000 : null,
      atencionAvgMin: avgOrNull(x.atencion) != null ? avgOrNull(x.atencion) / 60000 : null
    }));

    rows = rows.map((r) => ({
      ...r,
      label: chartGroup === "AGENTE" ? getAgentLabel(r.key) : r.key
    }));

    // detecta si hay tiempos reales
    const hasAnyAtencion = rows.some((r) => Number.isFinite(r.atencionAvgMin) && r.atencionAvgMin > 0);
    const hasAnyEspera = rows.some((r) => Number.isFinite(r.esperaAvgMin) && r.esperaAvgMin > 0);

    // orden
    if (chartType === "VOLUMEN") rows.sort((a, b) => (b.count || 0) - (a.count || 0));
    else if (chartType === "ESPERA_PROM") rows.sort((a, b) => (b.esperaAvgMin || 0) - (a.esperaAvgMin || 0));
    else rows.sort((a, b) => (b.atencionAvgMin || 0) - (a.atencionAvgMin || 0));

    rows = rows.slice(0, 12);

    let effectiveType = chartType;
    if (chartType === "ATENCION_PROM" && !hasAnyAtencion) effectiveType = "VOLUMEN";
    if (chartType === "ESPERA_PROM" && !hasAnyEspera) effectiveType = "VOLUMEN";

    let title = "Atención promedio (min)";
    let values = rows.map((x) => (Number.isFinite(x.atencionAvgMin) ? Math.round(x.atencionAvgMin * 10) / 10 : 0));

    if (effectiveType === "ESPERA_PROM") {
      title = "Espera promedio (min)";
      values = rows.map((x) => (Number.isFinite(x.esperaAvgMin) ? Math.round(x.esperaAvgMin * 10) / 10 : 0));
    } else if (effectiveType === "VOLUMEN") {
      title = "Volumen (cantidad)";
      values = rows.map((x) => x.count || 0);
    } else if (effectiveType === "MIX") {
      title = "MIX";
    }

    const labels = rows.map((x) => x.label);

    return { labels, values, rows, title, effectiveType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRecords, chartGroup, chartType, agentsMap]);

  const rangeText = useMemo(() => {
    return `Rango: ${startDateISO} → ${endDateISO} · Origen=${originFilter} · Trámite=${tramiteFilter} · Módulo=${moduloFilter} · Agente=${agenteFilter}`;
  }, [startDateISO, endDateISO, originFilter, tramiteFilter, moduloFilter, agenteFilter]);

  const exportPDFDashboard = () => {
    const sections = [];

    sections.push({
      title: "KPIs Resumen",
      kpis: [
        { label: "Total", value: overview.total, hint: `WEB: ${overview.totalWeb} · KIOSKO: ${overview.totalKiosko}` },
        { label: "Completadas", value: overview.atendidas, hint: "Estado = completado" },
        { label: "No se presentó", value: overview.noPresento, hint: "Clasificación = NO_SE_PRESENTO" },
        { label: "Espera promedio", value: msToHMS(tiempos.espera.avgMs), hint: `Min ${msToHMS(tiempos.espera.minMs)} · Max ${msToHMS(tiempos.espera.maxMs)}` }
      ]
    });

    // gráfico seleccionado
    if (chartModel.effectiveType !== "MIX") {
      sections.push({
        title: `Gráfico: ${chartModel.title} · Agrupar por ${chartGroup}`,
        chartBase64: makeChartImageBase64({
          type: "bar",
          labels: chartModel.labels,
          values: chartModel.values,
          title: `${chartModel.title}`
        })
      });
    } else {
      const rows = chartModel.rows || [];
      sections.push({
        title: `Gráfico: Atención promedio (min) · Agrupar por ${chartGroup}`,
        chartBase64: makeChartImageBase64({
          type: "bar",
          labels: rows.map((x) => x.label),
          values: rows.map((x) => (Number.isFinite(x.atencionAvgMin) ? Math.round(x.atencionAvgMin * 10) / 10 : 0)),
          title: "Atención promedio (min)"
        })
      });
      sections.push({
        title: `Gráfico: Espera promedio (min) · Agrupar por ${chartGroup}`,
        chartBase64: makeChartImageBase64({
          type: "bar",
          labels: rows.map((x) => x.label),
          values: rows.map((x) => (Number.isFinite(x.esperaAvgMin) ? Math.round(x.esperaAvgMin * 10) / 10 : 0)),
          title: "Espera promedio (min)"
        })
      });
    }

    sections.push({
      title: "Ranking por Trámite (Atención promedio)",
      table: {
        headers: ["Trámite", "Cantidad", "Espera Prom.", "Atención Prom.", "Atención Máx."],
        rows: byTramiteStats.slice(0, 20).map((t) => [
          t.tramite,
          t.count,
          msToHMS(t.esperaAvgMs),
          msToHMS(t.atencionAvgMs),
          msToHMS(t.atencionMaxMs)
        ])
      }
    });

    const html = buildPrintableHTML({
      title: "Métricas de Atención",
      subtitle: rangeText,
      sections
    });

    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up bloqueado. Permite ventanas emergentes para imprimir.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!isAdmin) {
    return (
      <div className="metrics-page">
        <div className="metrics-header">
          <h1 className="metrics-title">Métricas</h1>
          <span className="metrics-pill">No autorizado</span>
        </div>
        <div className="metrics-card">Tu rol no permite acceder a métricas.</div>
      </div>
    );
  }

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <div>
          <h1 className="metrics-title">Métricas</h1>
          <p className="metrics-sub">Dashboard ejecutivo + gráficos bajo demanda + reporte imprimible por trámite/caso.</p>
        </div>

        <div className="metrics-actions">
          <button className="metrics-btn secondary" onClick={fetchMetrics} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button className="metrics-btn" onClick={exportExcel} disabled={!canExport}>
            Exportar Excel
          </button>
          <button className="metrics-btn secondary" onClick={exportPDFDashboard} disabled={!canExport}>
            Imprimir / PDF (Dashboard)
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="metrics-card">
        <div className="metrics-filters">
          <div className="metrics-field">
            <div className="metrics-label">Desde</div>
            <input className="metrics-input" type="date" value={startDateISO} onChange={(e) => setStartDateISO(e.target.value)} />
          </div>
          <div className="metrics-field">
            <div className="metrics-label">Hasta</div>
            <input className="metrics-input" type="date" value={endDateISO} onChange={(e) => setEndDateISO(e.target.value)} />
          </div>
          <div className="metrics-field">
            <div className="metrics-label">Origen</div>
            <select className="metrics-input" value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="WEB">WEB</option>
              <option value="KIOSKO">Kiosko</option>
            </select>
          </div>
          <div className="metrics-field">
            <div className="metrics-label">Trámite</div>
            <select className="metrics-input" value={tramiteFilter} onChange={(e) => setTramiteFilter(e.target.value)}>
              {tramiteOptions.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>

          <div className="metrics-field">
            <div className="metrics-label">Módulo</div>
            <select className="metrics-input" value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)}>
              {moduloOptions.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>

          <div className="metrics-field">
            <div className="metrics-label">Agente</div>
            <select className="metrics-input" value={agenteFilter} onChange={(e) => setAgenteFilter(e.target.value)}>
              {agenteOptions.map((x) => (
                <option key={x} value={x}>{x === "ALL" ? "Todos" : getAgentLabel(x)}</option>
              ))}
            </select>
          </div>

          <div className="metrics-field metrics-search">
            <div className="metrics-label">Buscar</div>
            <input className="metrics-input" placeholder="Código, DNI, trámite, módulo..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
        </div>

        <div className="metrics-mini">
          Total: <b>{overview.total}</b> · WEB: <b>{overview.totalWeb}</b> · Kiosko: <b>{overview.totalKiosko}</b>
        </div>
      </div>

      {/* KPIs */}
      <div className="metrics-kpiGrid">
        <div className="metrics-kpi">
          <div className="metrics-kpiLabel">Mayor tiempo de atención</div>
          <div className="metrics-kpiValue">{kpiMayorAtencion}</div>
          <div className="metrics-kpiHint">Máximo dentro del rango/filtrado</div>
        </div>

        <div className="metrics-kpi">
          <div className="metrics-kpiLabel">Tiempo de atención promedio</div>
          <div className="metrics-kpiValue">{kpiAtencionProm}</div>
          <div className="metrics-kpiHint">Promedio general</div>
        </div>

        <div className="metrics-kpi">
          <div className="metrics-kpiLabel">Menor espera promedio</div>
          <div className="metrics-kpiValue">{kpiMenorEsperaPorTramite.value}</div>
          <div className="metrics-kpiHint">Trámite: {kpiMenorEsperaPorTramite.label}</div>
        </div>

        <div className="metrics-kpi">
          <div className="metrics-kpiLabel">Tiempo de espera promedio</div>
          <div className="metrics-kpiValue">{kpiEsperaProm}</div>
          <div className="metrics-kpiHint">Promedio general</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="metrics-card">
        <div className="metrics-sectionHead">
          <div>
            <div className="metrics-sectionTitle">Gráficos interactivos</div>
            <div className="metrics-sub">Si no hay tiempos cargados, se mostrará Volumen automáticamente.</div>
          </div>

          <button className="metrics-btn ghost" onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? "Ocultar detalles" : "Ver detalles"}
          </button>
        </div>

        <div className="metrics-chartControls">
          <div className="metrics-field">
            <div className="metrics-label">Agrupar por</div>
            <select className="metrics-input" value={chartGroup} onChange={(e) => setChartGroup(e.target.value)}>
              <option value="TRAMITE">Trámite</option>
              <option value="AGENTE">Agente</option>
              <option value="MODULO">Módulo</option>
              <option value="DIA">Día</option>
            </select>
          </div>

          <div className="metrics-field">
            <div className="metrics-label">Gráfico</div>
            <select className="metrics-input" value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="ATENCION_PROM">Atención promedio</option>
              <option value="ESPERA_PROM">Espera promedio</option>
              <option value="VOLUMEN">Volumen (cantidad)</option>
              <option value="MIX">MIX (Atención + Espera)</option>
            </select>
          </div>
        </div>

        {chartModel.effectiveType !== "MIX" ? (
          <div className="metrics-chartBox" style={{ marginTop: 12 }}>
            <ReportChart
              type="bar"
              title={`${chartModel.title} · Agrupar por ${chartGroup}`}
              labels={chartModel.labels}
              values={chartModel.values}
              height={300}
            />
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div className="metrics-chartBox">
              <ReportChart
                type="bar"
                title={`Atención promedio (min) · Agrupar por ${chartGroup}`}
                labels={chartModel.rows.map((x) => x.label)}
                values={chartModel.rows.map((x) => (Number.isFinite(x.atencionAvgMin) ? Math.round(x.atencionAvgMin * 10) / 10 : 0))}
                height={260}
              />
            </div>
            <div className="metrics-chartBox">
              <ReportChart
                type="bar"
                title={`Espera promedio (min) · Agrupar por ${chartGroup}`}
                labels={chartModel.rows.map((x) => x.label)}
                values={chartModel.rows.map((x) => (Number.isFinite(x.esperaAvgMin) ? Math.round(x.esperaAvgMin * 10) / 10 : 0))}
                height={260}
              />
            </div>
          </div>
        )}
      </div>

      {/* Ranking por trámite */}
      <div className="metrics-card">
        <div className="metrics-sectionHead">
          <div>
            <div className="metrics-sectionTitle">Ranking por Trámite</div>
            <div className="metrics-sub">Click en “Ver” para abrir reporte imprimible por trámite.</div>
          </div>
        </div>

        <div className="metrics-tramiteGrid">
          {byTramiteStats.slice(0, 12).map((t) => (
            <div key={t.tramite} className="metrics-tramiteCard">
              <div className="metrics-tramiteTop">
                <div className="metrics-tramiteName">{t.tramite}</div>
                <div className="metrics-pill">{t.count} casos</div>
              </div>

              <div className="metrics-tramiteTime">{msToHMS(t.atencionAvgMs)}</div>
              <div className="metrics-tramiteSub">
                Espera prom.: <b>{msToHMS(t.esperaAvgMs)}</b> · Máx. atención: <b>{msToHMS(t.atencionMaxMs)}</b>
              </div>

              <div style={{ marginTop: 10 }}>
                <button className="metrics-btn tiny secondary" onClick={() => openTramite(t.tramite)}>
                  Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalles */}
      {advancedOpen ? (
        <div className="metrics-card">
          <div className="metrics-sectionHead">
            <div>
              <div className="metrics-sectionTitle">Detalle</div>
              <div className="metrics-sub">Tabla (top 80). “Ver” abre caso imprimible.</div>
            </div>
          </div>

          <div className="metrics-tableWrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Código</th>
                  <th>Trámite</th>
                  <th>Módulo</th>
                  <th>Agente</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Espera</th>
                  <th>Atención</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 80).map((r) => (
                  <tr key={`${r.__origen}_${r.id}`}>
                    <td>{r.__origen}</td>
                    <td>{r.codigo || r.id}</td>
                    <td>{r.tramiteKey}</td>
                    <td>{r.moduloKey}</td>
                    <td>{getAgentLabel(r.agenteKey)}</td>
                    <td>{r.estadoKey}</td>
                    <td>{fmtDate(r.fechaHora || r.fechaHoraGenerado || r.createdAt)}</td>
                    <td>{msToHMS(r.esperaMs)}</td>
                    <td>{msToHMS(r.atencionMs)}</td>
                    <td>
                      <button className="metrics-btn tiny secondary" onClick={() => openDetails(r)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ color: "#666", fontWeight: 800, padding: 12 }}>
                      Sin datos con los filtros actuales.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="metrics-mini" style={{ marginTop: 10 }}>
              Mostrando {Math.min(80, filteredRecords.length)} de {filteredRecords.length} registros.
            </div>
          </div>
        </div>
      ) : null}

      <RecordModal open={modalOpen} onClose={closeDetails} record={selectedRecord} agentsMap={agentsMap} />
      <TramiteModal
        open={tramiteModalOpen}
        onClose={closeTramite}
        tramiteName={tramiteModalName}
        records={tramiteModalRecords}
        agentsMap={agentsMap}
        rangeText={rangeText}
      />
    </div>
  );
}
