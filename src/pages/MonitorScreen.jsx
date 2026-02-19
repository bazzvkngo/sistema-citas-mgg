import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const UI = {
  bg: "#e9eff7",
  panel: "#ffffff",
  ink: "#0b1220",
  muted: "#6b7280",
  brand2: "#0b3d91",
  border: "rgba(15, 23, 42, 0.12)",
  shadow: "0 16px 45px rgba(0,0,0,0.12)",
};

const styles = {
  root: {
    height: "100vh",
    width: "100vw",
    background: UI.bg,
    color: UI.ink,
    fontFamily: "Arial, sans-serif",
    overflow: "hidden",
  },

  // ✅ Sin header global, solo contenido
  content: {
    height: "100%",
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 18,
    padding: 18,
    minHeight: 0,
  },

  leftPanel: {
    background: UI.panel,
    borderRadius: 18,
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  leftHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background:
      "linear-gradient(180deg, rgba(31,111,235,0.10), rgba(31,111,235,0.00))",
  },
  leftHeaderTitle: { fontSize: 14, fontWeight: 900 },
  leftHeaderHint: { fontSize: 12, fontWeight: 800, color: UI.muted },

  gridCalls: {
    flex: 1,
    display: "grid",
    gridTemplateRows: "repeat(4, 1fr)",
    gap: 12,
    padding: 14,
    minHeight: 0,
  },

  callCard: {
    borderRadius: 16,
    border: `1px solid ${UI.border}`,
    background: "#0b1220",
    color: "#fff",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "1fr 86px",
    alignItems: "stretch",
  },

  callMain: { padding: 16, display: "flex", flexDirection: "column" },
  callRowTop: { display: "flex", alignItems: "baseline", gap: 12 },
  callTurno: {
    fontSize: "clamp(34px, 4.6vw, 74px)",
    fontWeight: 900,
    lineHeight: 1,
  },
  callArrow: {
    fontSize: "clamp(18px, 2vw, 28px)",
    fontWeight: 900,
    opacity: 0.9,
  },

  callName: {
    marginTop: 10,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    fontSize: "clamp(12px, 1.25vw, 18px)",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  callSide: {
    background: "rgba(255,255,255,0.08)",
    borderLeft: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 6,
  },
  callSideLabel: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  callModulo: {
    fontSize: "clamp(26px, 3vw, 52px)",
    fontWeight: 900,
    lineHeight: 1,
  },

  emptyCard: {
    borderRadius: 16,
    border: `1px dashed ${UI.border}`,
    background: "#fff",
    color: UI.muted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 14,
  },

  rightPanel: {
    background: UI.panel,
    borderRadius: 18,
    border: `1px solid ${UI.border}`,
    boxShadow: UI.shadow,
    overflow: "hidden",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  rightHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background:
      "linear-gradient(180deg, rgba(15,118,110,0.10), rgba(15,118,110,0.00))",
  },
  rightHeaderTitle: { fontSize: 14, fontWeight: 900 },
  rightHeaderMeta: { fontSize: 12, fontWeight: 900, color: UI.muted },

  // ✅ lista arriba
  rightList: { padding: 10, overflow: "auto", flex: 1, minHeight: 0 },

  row: {
    display: "grid",
    gridTemplateColumns: "110px 40px 70px 1fr",
    gap: 10,
    alignItems: "center",
    background: "#f8fafc",
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    padding: "10px 12px",
    marginBottom: 10,
  },
  rowTurno: { fontWeight: 900, fontSize: 22, color: UI.ink },
  rowArrow: { textAlign: "center", fontWeight: 900, color: UI.muted },
  rowModulo: {
    fontWeight: 900,
    fontSize: 20,
    textAlign: "center",
    color: UI.brand2,
  },
  rowName: {
    fontWeight: 900,
    color: UI.ink,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  // ✅ publicidad abajo centrada
  adArea: {
    borderTop: `1px solid ${UI.border}`,
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
  adBox: {
    width: "100%",
    height: "100%",
    maxWidth: 720,
    aspectRatio: "16/9",
    borderRadius: 18,
    overflow: "hidden",
    background: "#111",
    boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
    border: "2px solid rgba(255,255,255,0.18)",
    position: "relative",
  },
  adMedia: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    background: "#111",
  },
  adFallback: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    color: "#fff",
    fontWeight: 900,
    textAlign: "center",
    background: "rgba(0,0,0,0.55)",
    fontSize: 14,
  },
};

function cleanDoc(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "");
}

function trimName(name) {
  const s = (name || "").toString().trim();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first[0].toUpperCase()}. ${last}`;
}

function pickDni(call) {
  const candidates = [call?.dni, call?.dniCiudadano, call?.rut, call?.documento];
  const found = candidates.find((x) => (x || "").toString().trim());
  return (found || "").toString().trim();
}

function pickNombre(call) {
  const candidates = [
    call?.userNombre,
    call?.nombre,
    call?.nombreCiudadano,
    call?.ciudadanoNombre,
  ];
  const found = candidates.find((x) => (x || "").toString().trim());
  return (found || "").toString().trim();
}

async function lookupNombreEnUsuariosPorDni(dniRaw) {
  try {
    const dniClean = cleanDoc(dniRaw);
    if (!dniClean) return "";

    const variants = Array.from(
      new Set([dniRaw, dniClean, dniClean.slice(0, -1)])
    ).filter(Boolean);

    for (const v of variants) {
      const q1 = query(
        collection(db, "usuarios"),
        where("rol", "==", "ciudadano"),
        where("dni", "==", v),
        limit(1)
      );
      const qs1 = await getDocs(q1);
      if (!qs1.empty) {
        const d = qs1.docs[0].data() || {};
        return (d.nombre || d.nombreCompleto || d.fullName || "")
          .toString()
          .trim();
      }
    }

    return "";
  } catch (e) {
    console.error("lookupNombreEnUsuariosPorDni error:", e);
    return "";
  }
}

export default function MonitorScreen() {
  const [llamadaActual, setLlamadaActual] = useState(null);

  // ✅ este nombre es solo para el llamado actual
  const [nombreCiudadano, setNombreCiudadano] = useState("");

  // ✅ historial con nombre persistente
  const [history, setHistory] = useState([]);
  const lastCodeRef = useRef("");

  const [adConfig, setAdConfig] = useState(null);
  const [adError, setAdError] = useState("");

  useEffect(() => {
    const mountedAt = Date.now();
    let firstSnap = true;

    const ref = doc(db, "estadoSistema", "llamadaActual");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLlamadaActual(null);
        return;
      }

      const data = snap.data() || {};

      const tsMs = data.timestamp?.toMillis
        ? data.timestamp.toMillis()
        : data.timestamp?.seconds
        ? data.timestamp.seconds * 1000
        : null;

      if (firstSnap) {
        firstSnap = false;
        if (tsMs && tsMs < mountedAt) {
          setLlamadaActual(null);
          return;
        }
      }

      setLlamadaActual(data);

      const codigo = (data.codigoLlamado || data.codigo || "").toString().trim();
      if (!codigo) return;
      if (lastCodeRef.current === codigo) return;
      lastCodeRef.current = codigo;

      const item = {
        codigo,
        modulo: (data.modulo || "").toString(),
        dni: pickDni(data),
        // si viene el nombre desde la llamada, se guarda
        displayName: pickNombre(data) || "",
        ts: Date.now(),
      };

      // ✅ aquí el “desplazamiento” real: insertamos al inicio y mantenemos nombres
      setHistory((prev) => {
        const next = [item, ...prev];
        const seen = new Set();
        const cleaned = [];
        for (const it of next) {
          if (seen.has(it.codigo)) continue;
          seen.add(it.codigo);
          cleaned.push(it);
        }
        return cleaned.slice(0, 16);
      });
    });

    return () => unsubscribe();
  }, []);

  // ✅ resolver nombre del llamado actual y guardarlo en history[0] para que NO se pierda al bajar
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!llamadaActual) {
        setNombreCiudadano("");
        return;
      }

      const nombreDirecto = pickNombre(llamadaActual);
      if (nombreDirecto) {
        setNombreCiudadano(nombreDirecto);

        // persistir en historial
        const codigo = (llamadaActual.codigoLlamado || llamadaActual.codigo || "")
          .toString()
          .trim();
        if (codigo) {
          setHistory((prev) =>
            prev.map((h) =>
              h.codigo === codigo ? { ...h, displayName: nombreDirecto } : h
            )
          );
        }
        return;
      }

      const dniRaw = pickDni(llamadaActual);
      if (!dniRaw) {
        setNombreCiudadano("");
        return;
      }

      const found = await lookupNombreEnUsuariosPorDni(dniRaw);
      if (cancelled) return;

      setNombreCiudadano(found || "");

      // ✅ persistir nombre encontrado en el item del historial (para que se “desplace” con nombre)
      const codigo = (llamadaActual.codigoLlamado || llamadaActual.codigo || "")
        .toString()
        .trim();
      if (codigo && found) {
        setHistory((prev) =>
          prev.map((h) => (h.codigo === codigo ? { ...h, displayName: found } : h))
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [llamadaActual]);

  // publicidad desde Firestore
  useEffect(() => {
    const ref = doc(db, "config", "pantallaTV");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setAdConfig(null);
        return;
      }
      setAdConfig(snap.data());
      setAdError("");
    });
    return () => unsub();
  }, []);

  const adEnabled = !!(adConfig?.enabled && adConfig?.url);
  const adType = (adConfig?.type || "video").toLowerCase();

  // ✅ izquierda usa el historial, por eso ahora se desplaza con nombre
  const current4 = useMemo(() => history.slice(0, 4), [history]);
  const previous = useMemo(() => history.slice(0, 8), [history]); // lista derecha: últimos 8

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        <div style={styles.leftPanel}>
          <div style={styles.leftHeader}>
            <div style={styles.leftHeaderTitle}>TURNO</div>
            <div style={styles.leftHeaderHint}>MÓDULO</div>
          </div>

          <div style={styles.gridCalls}>
            {Array.from({ length: 4 }).map((_, idx) => {
              const item = current4[idx];
              if (!item)
                return (
                  <div key={idx} style={styles.emptyCard}>
                    Esperando llamado…
                  </div>
                );

              const isFirst = idx === 0;
              const name = isFirst
                ? trimName(nombreCiudadano || item.displayName || "")
                : trimName(item.displayName || "");

              return (
                <div
                  key={item.codigo + "_" + idx}
                  style={{
                    ...styles.callCard,
                    background: isFirst
                      ? "linear-gradient(135deg, #0b1220, #0b3d91)"
                      : "#0b1220",
                  }}
                >
                  <div style={styles.callMain}>
                    <div style={styles.callRowTop}>
                      <div style={styles.callTurno}>{item.codigo}</div>
                      <div style={styles.callArrow}>›</div>
                    </div>
                    <div style={styles.callName}>{name || "—"}</div>
                  </div>

                  <div style={styles.callSide}>
                    <div style={styles.callSideLabel}>MÓDULO</div>
                    <div style={styles.callModulo}>{item.modulo || "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.rightHeader}>
            <div style={styles.rightHeaderTitle}>Llamados anteriores</div>
            <div style={styles.rightHeaderMeta}>Últimos {previous.length}</div>
          </div>

          <div style={styles.rightList}>
            {previous.length === 0 ? (
              <div style={{ padding: 12, fontWeight: 900, color: UI.muted }}>
                Aún no hay historial. En cuanto llamen un turno, aparecerá aquí.
              </div>
            ) : (
              previous.map((it, i) => (
                <div key={it.codigo + "_" + i} style={styles.row}>
                  <div style={styles.rowTurno}>{it.codigo}</div>
                  <div style={styles.rowArrow}>›</div>
                  <div style={styles.rowModulo}>{it.modulo || "—"}</div>
                  <div style={styles.rowName}>
                    {trimName(it.displayName) || "—"}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.adArea}>
            {adEnabled ? (
              <div style={styles.adBox}>
                {adType === "image" ? (
                  <img
                    src={adConfig.url}
                    alt="Publicidad"
                    style={styles.adMedia}
                    onError={() => setAdError("No se pudo cargar la imagen.")}
                  />
                ) : (
                  <video
                    src={adConfig.url}
                    style={styles.adMedia}
                    autoPlay={adConfig.autoplay !== false}
                    loop={adConfig.loop !== false}
                    muted={adConfig.mute !== false}
                    playsInline
                    controls={false}
                    onError={() => setAdError("No se pudo reproducir el video.")}
                  />
                )}
                {adError && <div style={styles.adFallback}>{adError}</div>}
              </div>
            ) : (
              <div style={{ color: UI.muted, fontWeight: 900 }}>
                Publicidad desactivada (config/pantallaTV)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
