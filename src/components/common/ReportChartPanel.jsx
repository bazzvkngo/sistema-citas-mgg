// src/components/common/ReportChartPanel.jsx
import React, { useMemo, useState } from "react";
import ReportChart from "./ReportChart";

function buildCounts(records, getKey) {
  const m = new Map();
  records.forEach((r) => {
    const key = String(getKey(r) || "").trim() || "SIN_DATO";
    m.set(key, (m.get(key) || 0) + 1);
  });

  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export default function ReportChartPanel({ title = "Reporte", records = [], agentsMap = {}, defaultGroupKey = "clasificacion" }) {
  const [groupKey, setGroupKey] = useState(defaultGroupKey);
  const [chartType, setChartType] = useState("bar");
  const [topN, setTopN] = useState(12);

  const groups = useMemo(
    () => [
      {
        key: "clasificacion",
        label: "Clasificación",
        get: (r) => r?.clasificacion || "SIN_CLASIFICAR",
      },
      {
        key: "tramite",
        label: "Trámite",
        get: (r) => r?.tramiteID || "SIN_TRAMITE",
      },
      {
        key: "estado",
        label: "Estado",
        get: (r) => r?.estado || "SIN_ESTADO",
      },
      {
        key: "modulo",
        label: "Módulo",
        get: (r) => r?.modulo || "SIN_MODULO",
      },
      {
        key: "agente",
        label: "Agente",
        get: (r) => {
          const uid = r?.agenteID || "";
          const ag = agentsMap?.[uid] || {};
          return ag.email || uid || "SIN_AGENTE";
        },
      },
    ],
    [agentsMap]
  );

  const activeGroup = groups.find((g) => g.key === groupKey) || groups[0];

  const series = useMemo(() => {
    const base = buildCounts(records, activeGroup.get);
    const n = Math.max(3, Math.min(30, Number(topN) || 12));

    const head = base.slice(0, n);
    const tail = base.slice(n);
    const others = tail.reduce((acc, [, v]) => acc + v, 0);

    const labels = head.map(([k]) => k);
    const values = head.map(([, v]) => v);

    if (others > 0) {
      labels.push("Otros");
      values.push(others);
    }

    return { labels, values, totalGroups: base.length };
  }, [records, activeGroup, topN]);

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: "bold", color: "#C8102E" }}>{title}</div>
        <div style={{ flex: 1 }} />

        <label style={{ fontSize: 12, color: "#444", display: "flex", gap: 6, alignItems: "center" }}>
          Agrupar por
          <select
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value)}
            style={{ border: "1px solid #ccc", borderRadius: 10, padding: "6px 10px" }}
          >
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12, color: "#444", display: "flex", gap: 6, alignItems: "center" }}>
          Tipo
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            style={{ border: "1px solid #ccc", borderRadius: 10, padding: "6px 10px" }}
          >
            <option value="bar">Barras</option>
            <option value="pie">Torta</option>
          </select>
        </label>

        <label style={{ fontSize: 12, color: "#444", display: "flex", gap: 6, alignItems: "center" }}>
          Top
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{ border: "1px solid #ccc", borderRadius: 10, padding: "6px 10px" }}
          >
            {[8, 10, 12, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
        Registros: <strong>{records.length}</strong> · Grupos: <strong>{series.totalGroups}</strong>
      </div>

      {records.length === 0 ? (
        <div style={{ padding: 16, color: "#666" }}>Sin datos para graficar.</div>
      ) : (
        <ReportChart type={chartType} title={`${title} · ${activeGroup.label}`} labels={series.labels} values={series.values} height={360} />
      )}
    </div>
  );
}
