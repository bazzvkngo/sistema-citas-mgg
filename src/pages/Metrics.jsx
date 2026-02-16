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

const FUNCTIONS_REGION = "southamerica-west1";

const styles = {
  page: { padding: 20, maxWidth: 1200, margin: "0 auto", fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  title: { margin: 0, fontSize: 24, fontWeight: "bold", color: "#C8102E" },
  card: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    padding: 16,
    marginBottom: 14,
  },
  controlsRow: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  input: { border: "1px solid #ccc", borderRadius: 10, padding: "8px 12px", fontSize: 14 },
  button: {
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: "bold",
    backgroundColor: "#C8102E",
    color: "#fff",
    cursor: "pointer",
  },
  small: { fontSize: 12, color: "#666", marginBottom: 4 },
  tabs: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  tab: {
    border: "1px solid #ddd",
    background: "#f9f9f9",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
  },
  tabActive: { borderColor: "#C8102E", color: "#C8102E", fontWeight: "bold" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", borderBottom: "2px solid #eee", padding: "10px 8px", fontSize: 12, color: "#444" },
  td: { borderBottom: "1px solid #eee", padding: "10px 8px", fontSize: 13, color: "#222", verticalAlign: "top" },
  badge: (bg, color) => ({
    display: "inline-block",
    background: bg,
    color,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  }),
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#C8102E",
    fontWeight: "bold",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  modalCard: {
    width: "min(980px, 96vw)",
    maxHeight: "92vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  },
  modalHeader: { padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", gap: 10, alignItems: "start" },
  modalTitle: { margin: 0, fontSize: 18, color: "#C8102E" },
  modalClose: {
    marginLeft: "auto",
    border: "none",
    background: "#fff",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
    color: "#444",
  },
  modalBody: { padding: 18 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  box: { border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" },
  boxTitle: { margin: 0, fontSize: 11, letterSpacing: 0.6, color: "#666" },
  boxValue: { margin: "6px 0 0 0", fontSize: 14, fontWeight: "bold", color: "#222" },
  modalFooter: {
    padding: 14,
    borderTop: "1px solid #eee",
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  modalBtn: {
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
  },
  modalBtnPrimary: { background: "#C8102E", color: "#fff" },
  modalBtnGhost: { background: "#f3f4f6", color: "#111" },
  modalBtnExcel: { background: "#0f7a2a", color: "#fff" },
};

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function safeFileName(name) {
  return String(name || "reporte")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

async function exportRecordToExcelPro(record, agentsMap) {
  if (!record) return;

  const ag = agentsMap?.[record.agenteID] || {};
  const origen = record.__origen || "-";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Consulado del Perú";
  wb.created = new Date();

  const ws = wb.addWorksheet("Detalle", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 24 }, // A
    { width: 44 }, // B
    { width: 4 }, // C
    { width: 24 }, // D
    { width: 44 }, // E
  ];

  const border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8102E" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  const titleFont = { bold: true, color: { argb: "FFC8102E" }, size: 18 };

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `${origen}: ${record.codigo || record.id || "Detalle"}`;
  ws.getCell("A1").font = titleFont;
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  ws.mergeCells("A2:E2");
  ws.getCell("A2").value = `ID Doc: ${record.id || "-"}  |  Trámite: ${record.tramiteID || "-"}`;
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("A2").font = { color: { argb: "FF374151" } };

  ws.mergeCells("A4:B4");
  ws.getCell("A4").value = record.clasificacion || "";
  ws.getCell("A4").font = { bold: true, color: { argb: "FF111827" } };
  ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
  ws.getCell("A4").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("A4").border = border;

  ws.mergeCells("D4:E4");
  ws.getCell("D4").value = `Estado: ${record.estado || "-"}`;
  ws.getCell("D4").font = { bold: true, color: { argb: "FF1D4ED8" } };
  ws.getCell("D4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  ws.getCell("D4").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("D4").border = border;

  const addPair = (r, c, label, value) => {
    const lab = ws.getCell(r, c);
    const val = ws.getCell(r + 1, c);

    ws.mergeCells(r, c, r, c + 1);
    ws.mergeCells(r + 1, c, r + 1, c + 1);

    lab.value = label;
    lab.font = { bold: true, size: 10, color: { argb: "FF6B7280" } };
    lab.alignment = { vertical: "middle", horizontal: "left" };

    val.value = value ?? "";
    val.font = { bold: true, size: 12, color: { argb: "FF111827" } };
    val.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    val.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    val.border = border;
  };

  addPair(6, 1, "CÓDIGO", record.codigo || "");
  addPair(6, 4, "DNI CIUDADANO", record.dni || "");

  addPair(8, 1, "MÓDULO", record.modulo ?? "");
  addPair(8, 4, "AGENTE (UID)", record.agenteID || "");

  addPair(10, 1, "AGENTE (EMAIL)", ag.email || "");
  addPair(10, 4, "AGENTE (DNI)", ag.dni || "");

  addPair(12, 1, "AGENTE (NOMBRE)", ag.nombre || "");
  addPair(12, 4, "ORIGEN", origen);

  addPair(14, 1, "HORA AGENDADA", record.fechaHora ? format(new Date(record.fechaHora), "dd/MM/yyyy HH:mm") : "");
  addPair(
    14,
    4,
    "HORA CREACIÓN",
    record.fechaHoraCreacion ? format(new Date(record.fechaHoraCreacion), "dd/MM/yyyy HH:mm") : ""
  );

  addPair(
    16,
    1,
    "HORA FIN",
    record.fechaHoraAtencionFin ? format(new Date(record.fechaHoraAtencionFin), "dd/MM/yyyy HH:mm") : ""
  );
  addPair(16, 4, "CIERRE MASIVO", record.cierreMasivo ? "Sí" : "No");

  addPair(18, 1, "MOTIVO CIERRE", record.motivoCierre || "");
  addPair(20, 1, "COMENTARIO / OBSERVACIÓN", record.comentario || "");

  for (let r = 6; r <= 21; r++) ws.getRow(r).height = 22;

  ws.getCell("A23").value = "Generado:";
  ws.getCell("B23").value = format(new Date(), "dd/MM/yyyy HH:mm");
  ws.getCell("A23").font = { bold: true, color: { argb: "FF6B7280" } };
  ws.getCell("B23").font = { color: { argb: "FF374151" } };

  ws.getCell("A1").fill = headerFill;
  ws.getCell("A1").font = headerFont;
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 26;

  const fileName = safeFileName(`${origen}_${record.codigo || record.id || "detalle"}`) + ".xlsx";
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), fileName);
}

function buildResumenFromRecords(detalleCitas = [], detalleTurnos = []) {
  const resumen = {
    total: detalleCitas.length + detalleTurnos.length,
    citas: detalleCitas.length,
    turnos: detalleTurnos.length,
  };

  const countBy = (arr, keyFn) => {
    const m = new Map();
    arr.forEach((r) => {
      const k = keyFn(r);
      if (!k) return;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };

  const byTramite = countBy([...detalleCitas, ...detalleTurnos], (r) => r.tramiteID || "SIN_TRAMITE");
  const byAgente = countBy([...detalleCitas, ...detalleTurnos], (r) => r.agenteID || "SIN_AGENTE");
  const byEstado = countBy([...detalleCitas, ...detalleTurnos], (r) => r.estado || "SIN_ESTADO");

  return { resumen, byTramite, byAgente, byEstado };
}

function makeChartImageBase64({ type, labels, values, title }) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");

  const chart = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label: title || "",
          data: values,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        title: { display: !!title, text: title },
      },
      scales: type === "pie" ? {} : { y: { beginAtZero: true } },
    },
  });

  const base64 = chart.toBase64Image("image/png", 1);
  chart.destroy();
  return base64;
}

function applyHeaderRowStyle(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8102E" } };
  row.border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };
}

function addTableSheet(workbook, name, columns, rows) {
  const ws = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));

  const headerRow = ws.getRow(1);
  applyHeaderRowStyle(headerRow);

  rows.forEach((r) => ws.addRow(r));

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  ws.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 22 : 18;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      if (rowNumber !== 1) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    });
  });

  return ws;
}

async function exportAllToExcelPro({
  startDateISO,
  endDateISO,
  detalleCitas,
  detalleTurnos,
  agentsMap,
  searchText,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Consulado del Perú";
  wb.created = new Date();

  const now = new Date();
  const safeFrom = String(startDateISO || "").slice(0, 10);
  const safeTo = String(endDateISO || "").slice(0, 10);
  const filtroTexto = (searchText || "").trim();

  const { resumen, byTramite, byAgente, byEstado } = buildResumenFromRecords(detalleCitas, detalleTurnos);

  const wsResumen = wb.addWorksheet("Resumen", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  wsResumen.columns = [
    { width: 26 },
    { width: 42 },
    { width: 3 },
    { width: 26 },
    { width: 42 },
  ];

  wsResumen.mergeCells("A1:E1");
  wsResumen.getCell("A1").value = "Reporte de Métricas";
  wsResumen.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFC8102E" } };
  wsResumen.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  wsResumen.getCell("A3").value = "Rango:";
  wsResumen.getCell("B3").value = `${safeFrom} a ${safeTo}`;
  wsResumen.getCell("D3").value = "Generado:";
  wsResumen.getCell("E3").value = format(now, "dd/MM/yyyy HH:mm");

  wsResumen.getCell("A4").value = "Filtro texto:";
  wsResumen.getCell("B4").value = filtroTexto ? filtroTexto : "(sin filtro)";

  const kpi = [
    ["Total registros", resumen.total],
    ["Citas web", resumen.citas],
    ["Turnos kiosko", resumen.turnos],
  ];

  let row = 6;
  wsResumen.getCell(`A${row}`).value = "Indicador";
  wsResumen.getCell(`B${row}`).value = "Valor";
  applyHeaderRowStyle(wsResumen.getRow(row));
  row += 1;
  kpi.forEach(([k, v]) => {
    wsResumen.getCell(`A${row}`).value = k;
    wsResumen.getCell(`B${row}`).value = v;
    row += 1;
  });

  const topTramites = byTramite.slice(0, 8);
  const topAgentes = byAgente.slice(0, 8);
  const topEstados = byEstado.slice(0, 8);

  const tramiteLabels = topTramites.map(([k]) => k);
  const tramiteValues = topTramites.map(([, v]) => v);

  const agenteLabels = topAgentes.map(([uid]) => {
    const ag = agentsMap?.[uid] || {};
    return ag.email || uid;
  });
  const agenteValues = topAgentes.map(([, v]) => v);

  const estadoLabels = topEstados.map(([k]) => k);
  const estadoValues = topEstados.map(([, v]) => v);

  const imgTramite = makeChartImageBase64({
    type: "bar",
    labels: tramiteLabels,
    values: tramiteValues,
    title: "Atenciones por Trámite (Top)",
  });

  const imgAgente = makeChartImageBase64({
    type: "bar",
    labels: agenteLabels,
    values: agenteValues,
    title: "Atenciones por Agente (Top)",
  });

  const imgEstado = makeChartImageBase64({
    type: "pie",
    labels: estadoLabels,
    values: estadoValues,
    title: "Distribución por Estado (Top)",
  });

  const imgId1 = wb.addImage({ base64: imgTramite, extension: "png" });
  const imgId2 = wb.addImage({ base64: imgAgente, extension: "png" });
  const imgId3 = wb.addImage({ base64: imgEstado, extension: "png" });

  wsResumen.addImage(imgId1, { tl: { col: 0, row: 11 }, ext: { width: 900, height: 420 } });
  wsResumen.addImage(imgId2, { tl: { col: 0, row: 32 }, ext: { width: 900, height: 420 } });
  wsResumen.addImage(imgId3, { tl: { col: 0, row: 53 }, ext: { width: 900, height: 420 } });

  const columns = [
    { header: "Origen", key: "origen", width: 12 },
    { header: "Código", key: "codigo", width: 14 },
    { header: "Trámite", key: "tramiteID", width: 22 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Clasificación", key: "clasificacion", width: 18 },
    { header: "Módulo", key: "modulo", width: 10 },
    { header: "Agente (email)", key: "agenteEmail", width: 24 },
    { header: "Agente (dni)", key: "agenteDni", width: 16 },
    { header: "Agente (nombre)", key: "agenteNombre", width: 20 },
    { header: "Hora Agendada", key: "fechaHora", width: 18 },
    { header: "Hora Creación", key: "fechaHoraCreacion", width: 18 },
    { header: "Hora Fin", key: "fechaHoraAtencionFin", width: 18 },
    { header: "Cierre masivo", key: "cierreMasivo", width: 14 },
    { header: "Motivo cierre", key: "motivoCierre", width: 22 },
    { header: "Comentario/Observación", key: "comentario", width: 28 },
  ];

  const mapRow = (r, origen) => {
    const ag = agentsMap?.[r.agenteID] || {};
    return {
      origen,
      codigo: r.codigo || "",
      tramiteID: r.tramiteID || "",
      dni: r.dni || "",
      estado: r.estado || "",
      clasificacion: r.clasificacion || "",
      modulo: r.modulo ?? "",
      agenteEmail: ag.email || "",
      agenteDni: ag.dni || "",
      agenteNombre: ag.nombre || "",
      fechaHora: r.fechaHora ? format(new Date(r.fechaHora), "dd/MM/yyyy HH:mm") : "",
      fechaHoraCreacion: r.fechaHoraCreacion ? format(new Date(r.fechaHoraCreacion), "dd/MM/yyyy HH:mm") : "",
      fechaHoraAtencionFin: r.fechaHoraAtencionFin ? format(new Date(r.fechaHoraAtencionFin), "dd/MM/yyyy HH:mm") : "",
      cierreMasivo: r.cierreMasivo ? "Sí" : "No",
      motivoCierre: r.motivoCierre || "",
      comentario: r.comentario || "",
    };
  };

  const sheetAllRows = [
    ...detalleCitas.map((r) => mapRow(r, "WEB")),
    ...detalleTurnos.map((r) => mapRow(r, "KIOSKO")),
  ];

  addTableSheet(wb, "Registros", columns, sheetAllRows);
  addTableSheet(wb, "Citas Web", columns, detalleCitas.map((r) => mapRow(r, "WEB")));
  addTableSheet(wb, "Turnos Kiosko", columns, detalleTurnos.map((r) => mapRow(r, "KIOSKO")));

  const meta = wb.addWorksheet("Meta");
  meta.columns = [{ width: 26 }, { width: 80 }];
  meta.addRow(["Desde", safeFrom]);
  meta.addRow(["Hasta", safeTo]);
  meta.addRow(["Filtro texto", filtroTexto ? filtroTexto : "(sin filtro)"]);
  meta.addRow(["Total exportado", String(sheetAllRows.length)]);
  meta.addRow(["Generado", format(now, "dd/MM/yyyy HH:mm")]);

  const fileName = safeFileName(`reporte_${safeFrom}_a_${safeTo}`) + ".xlsx";
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}

function openPrintWindowForRecord(record, agentsMap) {
  if (!record) return;
  const ag = agentsMap?.[record.agenteID] || {};
  const origen = record.__origen || "-";
  const titulo = `${origen}: ${record.codigo || record.id || "Detalle"}`;

  const rows = [
    ["Código", record.codigo || record.id || ""],
    ["DNI Ciudadano", record.dni || ""],
    ["Trámite", record.tramiteID || ""],
    ["Estado", record.estado || ""],
    ["Clasificación", record.clasificacion || ""],
    ["Módulo", record.modulo ?? ""],
    ["Agente (email)", ag.email || ""],
    ["Agente (dni)", ag.dni || ""],
    ["Agente (nombre)", ag.nombre || ""],
    ["Origen", origen],
    ["Hora agendada", record.fechaHora ? format(new Date(record.fechaHora), "dd/MM/yyyy HH:mm") : ""],
    ["Hora creación", record.fechaHoraCreacion ? format(new Date(record.fechaHoraCreacion), "dd/MM/yyyy HH:mm") : ""],
    ["Hora fin", record.fechaHoraAtencionFin ? format(new Date(record.fechaHoraAtencionFin), "dd/MM/yyyy HH:mm") : ""],
    ["Cierre masivo", record.cierreMasivo ? "Sí" : "No"],
    ["Motivo cierre", record.motivoCierre || ""],
    ["Comentario / Observación", record.comentario || ""],
  ];

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;

  const htmlRows = rows
    .map(
      ([k, v]) => `
      <tr>
        <td class="k">${String(k)}</td>
        <td class="v">${String(v ?? "")}</td>
      </tr>`
    )
    .join("");

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#111;}
          h1{margin:0 0 6px 0;font-size:20px;color:#C8102E;}
          .sub{margin:0 0 18px 0;color:#444;font-size:12px;}
          table{width:100%;border-collapse:collapse;}
          td{border:1px solid #e5e7eb;padding:10px;vertical-align:top;font-size:13px;}
          td.k{width:220px;background:#f9fafb;font-weight:700;}
          .foot{margin-top:18px;color:#666;font-size:12px;}
          @media print { body{margin:0;} }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        <p class="sub">Documento: ${record.id || ""} | Trámite: ${record.tramiteID || ""}</p>
        <table>${htmlRows}</table>
        <p class="foot">Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        <script>
          window.onload = function(){ window.focus(); window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

function RecordModal({ open, onClose, record, agentsMap }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
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

  const stop = (e) => e.stopPropagation();

  return (
    <div style={styles.modalOverlay} onMouseDown={onClose} role="dialog" aria-modal="true">
      <div style={styles.modalCard} onMouseDown={stop}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>{titulo}</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
              ID Doc: {record.id || "-"} | Trámite: {record.tramiteID || "-"}
            </p>
          </div>

          <button style={styles.modalClose} onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {clasificacion ? <span style={badgeStyle}>{clasificacion}</span> : null}
            <span style={styles.badge("#e5e7eb", "#111")}>Estado: {record.estado || "-"}</span>
          </div>

          <div style={styles.grid}>
            <div style={styles.box}>
              <p style={styles.boxTitle}>CÓDIGO</p>
              <p style={styles.boxValue}>{record.codigo || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>DNI CIUDADANO</p>
              <p style={styles.boxValue}>{record.dni || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>MÓDULO</p>
              <p style={styles.boxValue}>{record.modulo ?? "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>AGENTE (UID)</p>
              <p style={styles.boxValue}>{record.agenteID || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>AGENTE (EMAIL)</p>
              <p style={styles.boxValue}>{ag.email || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>AGENTE (DNI)</p>
              <p style={styles.boxValue}>{ag.dni || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>AGENTE (NOMBRE)</p>
              <p style={styles.boxValue}>{ag.nombre || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>ORIGEN</p>
              <p style={styles.boxValue}>{origen}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>HORA AGENDADA</p>
              <p style={styles.boxValue}>
                {record.fechaHora ? format(new Date(record.fechaHora), "dd/MM/yyyy HH:mm") : "-"}
              </p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>HORA CREACIÓN</p>
              <p style={styles.boxValue}>
                {record.fechaHoraCreacion ? format(new Date(record.fechaHoraCreacion), "dd/MM/yyyy HH:mm") : "-"}
              </p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>HORA FIN</p>
              <p style={styles.boxValue}>
                {record.fechaHoraAtencionFin ? format(new Date(record.fechaHoraAtencionFin), "dd/MM/yyyy HH:mm") : "-"}
              </p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>CIERRE MASIVO</p>
              <p style={styles.boxValue}>{record.cierreMasivo ? "Sí" : "No"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>MOTIVO CIERRE</p>
              <p style={styles.boxValue}>{record.motivoCierre || "-"}</p>
            </div>

            <div style={styles.box}>
              <p style={styles.boxTitle}>COMENTARIO / OBSERVACIÓN</p>
              <p style={styles.boxValue}>{record.comentario || "-"}</p>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            style={{ ...styles.modalBtn, ...styles.modalBtnExcel }}
            onClick={() => exportRecordToExcelPro(record, agentsMap)}
            title="Descargar ficha en Excel"
          >
            Descargar Excel
          </button>

          <button
            style={{ ...styles.modalBtn, ...styles.modalBtnGhost }}
            onClick={() => openPrintWindowForRecord(record, agentsMap)}
            title="Imprimir ficha"
          >
            Imprimir
          </button>

          <button style={{ ...styles.modalBtn, ...styles.modalBtnGhost }} onClick={onClose}>
            Cerrar
          </button>
          <button style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }} onClick={onClose}>
            OK
          </button>
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
  const [showCharts, setShowCharts] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [agentsMap, setAgentsMap] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const isAdmin = useMemo(() => {
    const rol = currentUser?.rol || currentUser?.role;
    return rol === "admin";
  }, [currentUser]);

  const fetchAgentsInfo = async (uids) => {
    try {
      const groups = chunk(uids, 10);
      const map = {};
      for (const g of groups) {
        const q = query(collection(db, "usuarios"), where(documentId(), "in", g));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          const u = d.data() || {};
          map[d.id] = {
            email: u.email || "",
            dni: u.dni || "",
            nombre: u.nombre || u.displayName || "",
            rol: u.rol || u.role || "",
          };
        });
      }
      setAgentsMap(map);
    } catch (err) {
      console.error("Error al cargar agentes:", err);
    }
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

      if (agenteIds.size > 0) {
        await fetchAgentsInfo(Array.from(agenteIds));
      }
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

  const resumenRows = useMemo(() => {
    if (!stats) return [];
    return [
      {
        origen: "Citas Agendadas (Web)",
        atendidas: stats?.citas?.atendido_total ?? 0,
        fallidas: stats?.citas?.fallo_accion ?? 0,
        noPresento: stats?.citas?.no_presento ?? 0,
      },
      {
        origen: "Turnos Kiosko (Presencial)",
        atendidas: stats?.turnos?.atendido_total ?? 0,
        fallidas: stats?.turnos?.fallo_accion ?? 0,
        noPresento: stats?.turnos?.no_presento ?? 0,
      },
    ];
  }, [stats]);

  const filtered = (arr) => {
    const t = (searchText || "").trim().toLowerCase();
    if (!t) return arr;

    return arr.filter((r) => {
      const ag = agentsMap[r.agenteID] || {};
      const haystack = [
        r.id,
        r.codigo,
        r.dni,
        r.tramiteID,
        r.clasificacion,
        r.comentario,
        r.modulo,
        r.agenteID,
        ag.email,
        ag.dni,
        ag.nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(t);
    });
  };

  const detalleCitas = useMemo(() => filtered(stats?.detalleCitas || []), [stats, searchText, agentsMap]);
  const detalleTurnos = useMemo(() => filtered(stats?.detalleTurnos || []), [stats, searchText, agentsMap]);

  const chartData = useMemo(() => {
    const countBy = (arr, keyFn) => {
      const m = new Map();
      arr.forEach((r) => {
        const k = keyFn(r);
        if (!k) return;
        m.set(k, (m.get(k) || 0) + 1);
      });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    };

    const topN = (pairs, n = 10) => pairs.slice(0, n);

    const totalPie = [
      ["CITAS", detalleCitas.length],
      ["TURNOS", detalleTurnos.length],
    ];

    const clasifCitas = topN(countBy(detalleCitas, (r) => r.clasificacion || "SIN_CLASIFICAR"), 8);
    const clasifTurnos = topN(countBy(detalleTurnos, (r) => r.clasificacion || "SIN_CLASIFICAR"), 8);

    const byTramite = topN(countBy([...detalleCitas, ...detalleTurnos], (r) => r.tramiteID || "SIN_TRAMITE"), 10);

    const byAgenteRaw = topN(countBy([...detalleCitas, ...detalleTurnos], (r) => r.agenteID || "SIN_AGENTE"), 10);
    const byAgente = byAgenteRaw.map(([id, n]) => {
      const info = agentsMap?.[id];
      const label = info?.email || id;
      return [label, n];
    });

    const byEstado = topN(countBy([...detalleCitas, ...detalleTurnos], (r) => r.estado || "SIN_ESTADO"), 10);

    return {
      totalPie,
      clasifCitas,
      clasifTurnos,
      byTramite,
      byAgente,
      byEstado,
    };
  }, [detalleCitas, detalleTurnos, agentsMap]);


  const openDetails = (record, origenLabel) => {
    setSelectedRecord({ ...record, __origen: origenLabel });
    setModalOpen(true);
  };

  const closeDetails = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  if (!isAdmin) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Métricas</h1>
        <div style={styles.card}>
          <p>No tienes permisos para ver métricas.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Métricas</h1>
      </div>

      <RecordModal open={modalOpen} onClose={closeDetails} record={selectedRecord} agentsMap={agentsMap} />

      <div style={styles.card}>
        <div style={styles.controlsRow}>
          <div>
            <div style={styles.small}>Desde</div>
            <input
              type="date"
              value={startDateISO}
              onChange={(e) => setStartDateISO(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <div style={styles.small}>Hasta</div>
            <input type="date" value={endDateISO} onChange={(e) => setEndDateISO(e.target.value)} style={styles.input} />
          </div>

          <button onClick={fetchMetrics} style={styles.button} disabled={loading}>
            {loading ? "Cargando..." : "Buscar"}
          </button>

          <button
            onClick={() =>
              stats &&
              exportAllToExcelPro({
                startDateISO,
                endDateISO,
                detalleCitas,
                detalleTurnos,
                agentsMap,
                searchText,
              })
            }
            style={{
              ...styles.button,
              backgroundColor: stats ? "#0f7a2a" : "#9ca3af",
              cursor: stats ? "pointer" : "not-allowed",
            }}
            disabled={!stats || loading}
            title="Exporta todos los registros del rango actual (respeta el filtro de búsqueda)"
          >
            Exportar Excel (Todo)
          </button>

          <button
            onClick={() => setShowCharts((v) => !v)}
            style={{ ...styles.button, backgroundColor: showCharts ? "#374151" : "#0d6efd" }}
            disabled={!stats}
          >
            {showCharts ? "Ocultar gráficos" : "Ver gráficos"}
          </button>


          <div style={{ flex: 1 }} />

          <div style={{ minWidth: 280 }}>
            <div style={styles.small}>Buscar por: (código, dni, trámite o correo)</div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Ej: AP-002, 123..., pasaportes, gmail..."
              style={{ ...styles.input, width: "100%" }}
            />
          </div>
        </div>
      </div>

      {showCharts && stats && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Gráficos</h2>
            <div style={{ fontSize: 12, color: "#666" }}>
              Rango: {startDateISO} a {endDateISO}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="pie"
                title="Citas vs Turnos"
                labels={chartData.totalPie.map((x) => x[0])}
                values={chartData.totalPie.map((x) => x[1])}
                height={260}
              />
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="bar"
                title="Top trámites (Total)"
                labels={chartData.byTramite.map((x) => x[0])}
                values={chartData.byTramite.map((x) => x[1])}
                height={260}
              />
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="bar"
                title="Top agentes (Total)"
                labels={chartData.byAgente.map((x) => x[0])}
                values={chartData.byAgente.map((x) => x[1])}
                height={260}
              />
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="bar"
                title="Estados (Total)"
                labels={chartData.byEstado.map((x) => x[0])}
                values={chartData.byEstado.map((x) => x[1])}
                height={260}
              />
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="pie"
                title="Clasificación Citas"
                labels={chartData.clasifCitas.map((x) => x[0])}
                values={chartData.clasifCitas.map((x) => x[1])}
                height={260}
              />
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <ReportChart
                type="pie"
                title="Clasificación Turnos"
                labels={chartData.clasifTurnos.map((x) => x[0])}
                values={chartData.clasifTurnos.map((x) => x[1])}
                height={260}
              />
            </div>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === "resumen" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("resumen")}
          >
            Resumen
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "detalleCitas" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("detalleCitas")}
          >
            Detalle Citas (Web)
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "detalleTurnos" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("detalleTurnos")}
          >
            Detalle Turnos (Presencial)
          </button>
        </div>

        {!stats && !loading && <p>Selecciona un rango y presiona “Buscar”.</p>}
        {loading && <p>Cargando métricas...</p>}

        {stats && activeTab === "resumen" && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Origen</th>
                  <th style={styles.th}>Atendidas</th>
                  <th style={styles.th}>Fallidas / Derivadas</th>
                  <th style={styles.th}>No se presentó</th>
                </tr>
              </thead>
              <tbody>
                {resumenRows.map((r) => (
                  <tr key={r.origen}>
                    <td style={styles.td}>{r.origen}</td>
                    <td style={styles.td}>
                      <span style={styles.badge("#d4edda", "#155724")}>{r.atendidas}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge("#fff3cd", "#856404")}>{r.fallidas}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge("#f8d7da", "#721c24")}>{r.noPresento}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stats && activeTab === "detalleCitas" && (
          <>
            <p style={styles.small}>Mostrando {detalleCitas.length} registros (Web).</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Origen</th>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>DNI Ciudadano</th>
                    <th style={styles.th}>Trámite</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Agente (email)</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleCitas.map((r) => {
                    const ag = agentsMap[r.agenteID] || {};
                    return (
                      <tr key={r.id}>
                        <td style={styles.td}>WEB</td>
                        <td style={styles.td}>
                          <button style={styles.linkBtn} onClick={() => openDetails(r, "WEB")}>
                            {r.codigo || r.id}
                          </button>
                        </td>
                        <td style={styles.td}>{r.dni || "-"}</td>
                        <td style={styles.td}>{r.tramiteID || "-"}</td>
                        <td style={styles.td}>{r.estado || "-"}</td>
                        <td style={styles.td}>{ag.email || "-"}</td>
                        <td style={styles.td}>
                          <button style={styles.linkBtn} onClick={() => openDetails(r, "WEB")}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {detalleCitas.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...styles.td, textAlign: "center", color: "#666" }}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {stats && activeTab === "detalleTurnos" && (
          <>
            <p style={styles.small}>Mostrando {detalleTurnos.length} registros (Presencial).</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Origen</th>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>DNI Ciudadano</th>
                    <th style={styles.th}>Trámite</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Agente (email)</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleTurnos.map((r) => {
                    const ag = agentsMap[r.agenteID] || {};
                    return (
                      <tr key={r.id}>
                        <td style={styles.td}>KIOSKO</td>
                        <td style={styles.td}>
                          <button style={styles.linkBtn} onClick={() => openDetails(r, "KIOSKO")}>
                            {r.codigo || r.id}
                          </button>
                        </td>
                        <td style={styles.td}>{r.dni || "-"}</td>
                        <td style={styles.td}>{r.tramiteID || "-"}</td>
                        <td style={styles.td}>{r.estado || "-"}</td>
                        <td style={styles.td}>{ag.email || "-"}</td>
                        <td style={styles.td}>
                          <button style={styles.linkBtn} onClick={() => openDetails(r, "KIOSKO")}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {detalleTurnos.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...styles.td, textAlign: "center", color: "#666" }}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
