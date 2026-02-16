// src/components/common/ReportChart.jsx
import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";

/**
 * ReportChart
 * - Componente reutilizable para mostrar gráficos en cualquier pantalla con filtros.
 * - Usa Chart.js (ya está en el proyecto).
 *
 * Props:
 * - type: "bar" | "pie" | "line" (por defecto "bar")
 * - title: string
 * - labels: string[]
 * - values: number[]
 * - height: number (px)
 */
export default function ReportChart({ type = "bar", title = "", labels = [], values = [], height = 280 }) {
  const canvasRef = useRef(null);

  const safe = useMemo(() => {
    const safeLabels = Array.isArray(labels) ? labels.map((x) => String(x)) : [];
    const safeValues = Array.isArray(values) ? values.map((n) => Number(n) || 0) : [];
    return { safeLabels, safeValues };
  }, [labels, values]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const ctx = el.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type,
      data: {
        labels: safe.safeLabels,
        datasets: [
          {
            label: title || "",
            data: safe.safeValues,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: type === "pie" },
          title: { display: !!title, text: title },
        },
        scales: type === "pie" ? {} : { y: { beginAtZero: true } },
      },
    });

    return () => chart.destroy();
  }, [type, title, safe.safeLabels, safe.safeValues]);

  const isEmpty = safe.safeLabels.length === 0 || safe.safeValues.every((x) => !x);

  if (isEmpty) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
        Sin datos para graficar.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
