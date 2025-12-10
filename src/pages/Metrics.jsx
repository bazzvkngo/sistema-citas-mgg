// src/pages/Metrics.jsx
import React, { useState, useEffect, useMemo } from "react";
import { app } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as XLSX from "xlsx";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import "./Metrics.css";

// Helpers de fechas
const todayISO = () => new Date().toISOString().slice(0, 10);

function getWeekRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

// Clasificar las atenciones según la clasificación almacenada
function clasificarEstado(clasificacionRaw) {
  const c = (clasificacionRaw || "").toUpperCase();

  // Atendidas / éxito
  if (
    c === "ATENDIDO_OK" ||
    c === "ATENDIDO" ||
    c === "TRAMITE_OK" ||
    c === "CONSULTA_RESUELTA" ||
    c === "ENTREGA_OK" ||
    c === "OTRO"
  ) {
    return "atendidas";
  }

  // Fallidas / derivadas / incompletas
  if (
    c === "FALLO_ACCION" ||
    c === "RECHAZADO" ||
    c === "FALTAN_DOCUMENTOS" ||
    c === "DERIVADO_INTERNO"
  ) {
    return "fallidas";
  }

  // No se presentó
  if (c === "NO_SE_PRESENTO") {
    return "noPresento";
  }

  // SIN_CLASIFICAR u otros → los ignoramos para los gráficos
  return null;
}

export default function Metrics() {
  const week = getWeekRange();

  const [startDate, setStartDate] = useState(week.start);
  const [endDate, setEndDate] = useState(week.end);

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("global"); // 'global' | 'tramite' | 'modulo'

  // nuevo: para marcar el rango rápido activo
  // 'today' | 'week' | 'month' | 'custom'
  const [selectedRange, setSelectedRange] = useState("week");

  // Instancia de Functions (región Santiago)
  const functions = getFunctions(app, "southamerica-west1");
  const getMetricsData = httpsCallable(functions, "getMetricsData");

  // Cambios rápidos de rango
  const handlePresetRange = (type) => {
    const today = todayISO();
    setSelectedRange(type);

    if (type === "today") {
      setStartDate(today);
      setEndDate(today);
      return;
    }

    if (type === "week") {
      const { start, end } = getWeekRange();
      setStartDate(start);
      setEndDate(end);
      return;
    }

    if (type === "month") {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const toISO = (x) => x.toISOString().slice(0, 10);
      setStartDate(toISO(first));
      setEndDate(toISO(last));
    }
  };

  // cambios manuales de fecha => rango personalizado
  const handleStartDateChange = (value) => {
    setStartDate(value);
    setSelectedRange("custom");
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setSelectedRange("custom");
  };

  // Cargar métricas automáticamente cuando cambian las fechas
  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      if (!startDate || !endDate) return;
      try {
        setError("");
        setLoading(true);
        const res = await getMetricsData({
          startDateISO: startDate,
          endDateISO: endDate,
        });
        if (!cancelled) {
          setMetrics(res.data || null);
        }
      } catch (err) {
        console.error("Error al obtener métricas:", err);
        if (!cancelled) {
          setMetrics(null);
          setError(
            "No se pudieron cargar las métricas. Revise la consola por más detalles."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetrics();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Exportar a Excel (usa el payload crudo de la función)
  const handleExportExcel = () => {
    if (!metrics) {
      alert("Primero debe cargar métricas.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Hoja 1: resumen por origen
    const resumenData = [
      ["Origen", "Atendidas", "Fallidas / Derivadas", "No se presentó"],
      [
        "Citas Agendadas",
        metrics.citas?.atendido_total || 0,
        metrics.citas?.fallo_accion || 0,
        metrics.citas?.no_presento || 0,
      ],
      [
        "Turnos Kiosko",
        metrics.turnos?.atendido_total || 0,
        metrics.turnos?.fallo_accion || 0,
        metrics.turnos?.no_presento || 0,
      ],
    ];
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, resumenSheet, "Resumen");

    // Hoja 2: detalle citas
    const detalleCitas = metrics.detalleCitas || [];
    if (detalleCitas.length > 0) {
      const sheetCitas = XLSX.utils.json_to_sheet(detalleCitas);
      XLSX.utils.book_append_sheet(wb, sheetCitas, "Detalle Citas");
    }

    // Hoja 3: detalle turnos
    const detalleTurnos = metrics.detalleTurnos || [];
    if (detalleTurnos.length > 0) {
      const sheetTurnos = XLSX.utils.json_to_sheet(detalleTurnos);
      XLSX.utils.book_append_sheet(wb, sheetTurnos, "Detalle Turnos");
    }

    const fileName = `metricas_${startDate}_a_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // === GLOBAL: Citas vs Turnos (buckets grandes) ===
  const chartDataGlobal = useMemo(() => {
    if (!metrics) return null;
    const citas = metrics.citas || {};
    const turnos = metrics.turnos || {};

    return {
      labels: ["Atendidas", "Fallidas / Derivadas", "No se presentó"],
      datasets: [
        {
          label: "Citas Agendadas",
          data: [
            citas.atendido_total || 0,
            citas.fallo_accion || 0,
            citas.no_presento || 0,
          ],
          backgroundColor: "rgba(54, 162, 235, 0.6)",
        },
        {
          label: "Turnos Kiosko",
          data: [
            turnos.atendido_total || 0,
            turnos.fallo_accion || 0,
            turnos.no_presento || 0,
          ],
          backgroundColor: "rgba(255, 159, 64, 0.6)",
        },
      ],
    };
  }, [metrics]);

  // === POR TRÁMITE: Top 8 trámites con más movimiento ===
  const chartDataPorTramite = useMemo(() => {
    if (!metrics) return null;

    const detalleCitas = metrics.detalleCitas || [];
    const detalleTurnos = metrics.detalleTurnos || [];

    const agregados = new Map(); // key = tramiteID

    const acumular = (reg) => {
      const tramiteId = reg.tramiteID || "SIN_TRAMITE";
      const bucket = clasificarEstado(reg.clasificacion);
      if (!bucket) return;

      if (!agregados.has(tramiteId)) {
        agregados.set(tramiteId, {
          tramiteId,
          atendidas: 0,
          fallidas: 0,
          noPresento: 0,
        });
      }
      const obj = agregados.get(tramiteId);
      obj[bucket] += 1;
    };

    detalleCitas.forEach(acumular);
    detalleTurnos.forEach(acumular);

    const items = Array.from(agregados.values()).map((it) => ({
      ...it,
      total: it.atendidas + it.fallidas + it.noPresento,
    }));

    // Top 8 por total de atenciones
    items.sort((a, b) => b.total - a.total);
    const top = items.slice(0, 8);

    if (!top.length) return null;

    return {
      labels: top.map((t) => t.tramiteId),
      datasets: [
        {
          label: "Atendidas",
          data: top.map((t) => t.atendidas),
          backgroundColor: "rgba(40, 167, 69, 0.7)", // verde
        },
        {
          label: "Fallidas / Derivadas",
          data: top.map((t) => t.fallidas),
          backgroundColor: "rgba(220, 53, 69, 0.7)", // rojo
        },
        {
          label: "No se presentó",
          data: top.map((t) => t.noPresento),
          backgroundColor: "rgba(255, 193, 7, 0.8)", // amarillo
        },
      ],
    };
  }, [metrics]);

  // === POR MÓDULO: total de atenciones por módulo ===
  const chartDataPorModulo = useMemo(() => {
    if (!metrics) return null;

    const detalleCitas = metrics.detalleCitas || [];
    const detalleTurnos = metrics.detalleTurnos || [];

    const agregados = new Map(); // key = nombre módulo

    const acumular = (reg) => {
      const modulo =
        reg.modulo || reg.moduloAsignado || reg.moduloAtencion || null;
      const label = modulo ? `Módulo ${modulo}` : "Sin módulo";
      const bucket = clasificarEstado(reg.clasificacion);
      if (!bucket) return;

      if (!agregados.has(label)) {
        agregados.set(label, { label, total: 0 });
      }
      agregados.get(label).total += 1;
    };

    [...detalleCitas, ...detalleTurnos].forEach(acumular);

    const items = Array.from(agregados.values());
    if (!items.length) return null;

    // ordenar por total desc
    items.sort((a, b) => b.total - a.total);

    return {
      labels: items.map((m) => m.label),
      datasets: [
        {
          label: "Atenciones totales",
          data: items.map((m) => m.total),
          backgroundColor: "rgba(108, 117, 125, 0.6)", // gris
        },
      ],
    };
  }, [metrics]);

  const chartOptionsStacked = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
    },
  };

  const chartOptionsSimple = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
    },
  };

  return (
    <div className="page-container">
      <h2 className="metrics-title">Métricas del Servicio</h2>

      {/* Filtros de fechas + rangos + Excel */}
      <div className="metrics-filters">
        <div className="metrics-filters-left">
          <div className="metrics-date-row">
            <label>
              Desde:
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </label>
            <label>
              Hasta:
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </label>
          </div>

          <div className="metrics-quick">
            <span>Rangos rápidos:</span>
            <div className="metrics-quick-buttons">
              <button
                type="button"
                className={`metrics-btn metrics-btn-primary ${
                  selectedRange === "today" ? "active" : ""
                }`}
                onClick={() => handlePresetRange("today")}
              >
                Hoy
              </button>
              <button
                type="button"
                className={`metrics-btn metrics-btn-primary ${
                  selectedRange === "week" ? "active" : ""
                }`}
                onClick={() => handlePresetRange("week")}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                className={`metrics-btn metrics-btn-primary ${
                  selectedRange === "month" ? "active" : ""
                }`}
                onClick={() => handlePresetRange("month")}
              >
                Mes actual
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="metrics-btn metrics-btn-success"
          onClick={handleExportExcel}
        >
          Exportar a Excel
        </button>
      </div>

      {error && <p className="metrics-error">{error}</p>}

      {/* Resumen numérico */}
      {metrics && (
        <>
          <div className="metrics-summary-cards">
            <div className="metrics-card">
              <h4>Citas agendadas</h4>
              <p>
                <strong>Atendidas:</strong>{" "}
                {metrics.citas?.atendido_total || 0}
              </p>
              <p>
                <strong>Fallidas / Derivadas:</strong>{" "}
                {metrics.citas?.fallo_accion || 0}
              </p>
              <p>
                <strong>No se presentó:</strong>{" "}
                {metrics.citas?.no_presento || 0}
              </p>
            </div>

            <div className="metrics-card">
              <h4>Turnos por kiosko</h4>
              <p>
                <strong>Atendidos:</strong>{" "}
                {metrics.turnos?.atendido_total || 0}
              </p>
              <p>
                <strong>Fallidos / Derivados:</strong>{" "}
                {metrics.turnos?.fallo_accion || 0}
              </p>
              <p>
                <strong>No se presentó:</strong>{" "}
                {metrics.turnos?.noPresento ||
                  metrics.turnos?.no_presento ||
                  0}
              </p>
            </div>
          </div>

          {/* Tabs de vista */}
          <div className="metrics-view-toggle">
            <span>Ver detalle:</span>
            <button
              type="button"
              className={`metrics-view-btn ${
                viewMode === "global" ? "active" : ""
              }`}
              onClick={() => setViewMode("global")}
            >
              Resumen global
            </button>
            <button
              type="button"
              className={`metrics-view-btn ${
                viewMode === "tramite" ? "active" : ""
              }`}
              onClick={() => setViewMode("tramite")}
            >
              Por trámite
            </button>
            <button
              type="button"
              className={`metrics-view-btn ${
                viewMode === "modulo" ? "active" : ""
              }`}
              onClick={() => setViewMode("modulo")}
            >
              Por módulo
            </button>
          </div>

          {/* Secciones de gráficos */}
          {viewMode === "global" && chartDataGlobal && (
            <div className="metrics-chart-section">
              <h3>Comparativo Citas vs Turnos</h3>
              <Bar data={chartDataGlobal} options={chartOptionsStacked} />
            </div>
          )}

          {viewMode === "tramite" && chartDataPorTramite && (
            <div className="metrics-chart-section">
              <h3>Trámites más atendidos</h3>
              <Bar data={chartDataPorTramite} options={chartOptionsStacked} />
            </div>
          )}

          {viewMode === "modulo" && chartDataPorModulo && (
            <div className="metrics-chart-section">
              <h3>Atenciones por módulo</h3>
              <Bar data={chartDataPorModulo} options={chartOptionsSimple} />
            </div>
          )}
        </>
      )}

      {!metrics && !loading && !error && (
        <p style={{ marginTop: "15px" }}>
          Seleccione un rango de fechas para ver las métricas.
        </p>
      )}

      {loading && (
        <p style={{ marginTop: "10px" }}>Cargando datos del servidor...</p>
      )}
    </div>
  );
}
