// src/components/common/ReportChart.jsx
import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";

const DONUT_COLORS = [
  "#C8102E",
  "#1D4ED8",
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#0891B2",
  "#475569",
  "#DC2626",
];

function truncateLabel(label, limit = 28) {
  const text = String(label ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export default function ReportChart({
  type = "bar",
  title = "",
  labels = [],
  values = [],
  height = 320,
  horizontal = false,
  suffix = "",
  showLegend = false,
}) {
  const canvasRef = useRef(null);

  const safe = useMemo(() => {
    const safeLabels = Array.isArray(labels) ? labels.map((x) => truncateLabel(x)) : [];
    const safeValues = Array.isArray(values) ? values.map((n) => Number(n) || 0) : [];
    return { safeLabels, safeValues };
  }, [labels, values]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const ctx = el.getContext("2d");
    if (!ctx) return;

    const isDoughnut = type === "doughnut";
    const isLine = type === "line";
    const barGradient = !isDoughnut && !isLine
      ? ctx.createLinearGradient(0, 0, 0, el.height || 320)
      : null;
    const lineGradient = isLine
      ? ctx.createLinearGradient(0, 0, 0, el.height || 320)
      : null;

    if (barGradient) {
      barGradient.addColorStop(0, "rgba(200, 16, 46, 0.96)");
      barGradient.addColorStop(1, "rgba(239, 68, 68, 0.58)");
    }

    if (lineGradient) {
      lineGradient.addColorStop(0, "rgba(200, 16, 46, 0.28)");
      lineGradient.addColorStop(1, "rgba(200, 16, 46, 0.02)");
    }

    const dataset = isDoughnut
      ? {
          label: title || "",
          data: safe.safeValues,
          backgroundColor: safe.safeLabels.map((_, index) => DONUT_COLORS[index % DONUT_COLORS.length]),
          borderColor: "#ffffff",
          borderWidth: 3,
          spacing: 3,
          hoverOffset: 8,
        }
      : isLine
        ? {
            label: title || "",
            data: safe.safeValues,
            borderColor: "#C8102E",
            backgroundColor: lineGradient || "rgba(200, 16, 46, 0.12)",
            pointBackgroundColor: "#C8102E",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 5,
            borderWidth: 3,
            tension: 0.38,
            fill: true,
          }
        : {
            label: title || "",
            data: safe.safeValues,
            backgroundColor: barGradient || "rgba(200, 16, 46, 0.82)",
            borderColor: "#C8102E",
            borderWidth: 0,
            borderRadius: 12,
            borderSkipped: false,
            maxBarThickness: 36,
          };

    const chart = new Chart(ctx, {
      type,
      data: {
        labels: safe.safeLabels,
        datasets: [dataset],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 350,
        },
        layout: {
          padding: {
            top: 10,
            right: 12,
            bottom: 2,
            left: 6,
          },
        },
        indexAxis: !isDoughnut && horizontal ? "y" : "x",
        cutout: isDoughnut ? "68%" : undefined,
        plugins: {
          legend: {
            display: isDoughnut || showLegend,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 10,
              padding: 18,
              color: "#475569",
              font: {
                size: 11,
                weight: 700,
              },
            },
          },
          title: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 12,
            cornerRadius: 12,
            titleColor: "#f8fafc",
            bodyColor: "#f8fafc",
            displayColors: isDoughnut,
            callbacks: {
              label: (context) => {
                const value = Number(context.parsed?.x ?? context.parsed?.y ?? context.parsed ?? 0);
                const labelText = context.label ? `${context.label}: ` : "";
                return `${labelText}${value}${suffix}`;
              },
            },
          },
        },
        scales: isDoughnut
          ? {}
          : {
              x: {
                beginAtZero: true,
                grid: {
                  display: false,
                  drawBorder: false,
                },
                ticks: {
                  color: "#64748b",
                  font: {
                    size: 11,
                    weight: 700,
                  },
                },
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: "rgba(148, 163, 184, 0.16)",
                  drawBorder: false,
                },
                ticks: {
                  color: "#64748b",
                  font: {
                    size: 11,
                    weight: 700,
                  },
                },
              },
            },
      },
    });

    return () => chart.destroy();
  }, [type, title, safe.safeLabels, safe.safeValues, horizontal, suffix, showLegend]);

  const isEmpty = safe.safeLabels.length === 0 || safe.safeValues.every((x) => !x);

  if (isEmpty) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
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
