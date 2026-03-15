import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import useImmersiveFullscreen from "../hooks/useImmersiveFullscreen";

const UI = {
  bg: "#f4f6f8",
  panel: "#ffffff",
  ink: "#0f172a",
  muted: "#5f6b7a",
  brand: "#c8102e",
  brand2: "#123b7a",
  borderSoft: "rgba(148, 163, 184, 0.16)",
  shadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
};

const LOCAL_DEMO_VIDEO_URL = "/media/monitor-demo.mp4";

const styles = {
  root: {
    height: "100vh",
    width: "100vw",
    background: "linear-gradient(180deg, #f4f6f8 0%, #eef2f6 100%)",
    color: UI.ink,
    fontFamily: '"Segoe UI", Arial, sans-serif',
    overflow: "hidden",
    position: "relative",
  },

  content: {
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.75fr) minmax(340px, 0.72fr)",
    gap: 18,
    padding: 18,
    minHeight: 0,
  },

  leftPanel: {
    background: UI.panel,
    borderRadius: 20,
    border: `1px solid ${UI.borderSoft}`,
    boxShadow: UI.shadow,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    position: "relative",
  },
  rightPanel: {
    background: UI.panel,
    borderRadius: 20,
    border: `1px solid ${UI.borderSoft}`,
    boxShadow: UI.shadow,
    overflow: "hidden",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  panelAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: "linear-gradient(90deg, #c8102e 0%, #123b7a 100%)",
  },

  leftHeader: {
    padding: "22px 26px 14px",
    borderBottom: `1px solid ${UI.borderSoft}`,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    background: UI.panel,
  },
  rightHeader: {
    padding: "22px 22px 12px",
    borderBottom: `1px solid ${UI.borderSoft}`,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    background: UI.panel,
  },
  panelTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  leftHeaderTitle: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  leftHeaderHint: {
    fontSize: 12,
    fontWeight: 800,
    color: UI.muted,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  rightHeaderTitle: {
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  rightHeaderMeta: {
    fontSize: 11,
    fontWeight: 900,
    color: UI.muted,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  leftBody: {
    flex: 1,
    display: "flex",
    padding: "0 22px 22px",
    minHeight: 0,
  },
  heroCard: {
    width: "100%",
    borderRadius: 30,
    border: "1px solid rgba(18,59,122,0.12)",
    background:
      "linear-gradient(180deg, rgba(244,247,251,0.92) 0%, rgba(255,255,255,1) 58%)",
    color: UI.ink,
    padding: "36px 40px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 30,
    minHeight: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 18px 36px rgba(15,23,42,0.07)",
  },
  heroMain: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: UI.muted,
  },
  heroTurno: {
    marginTop: 18,
    fontSize: "clamp(120px, 15vw, 220px)",
    fontWeight: 900,
    lineHeight: 0.88,
    letterSpacing: "-0.08em",
    color: UI.brand2,
  },
  heroContext: {
    marginTop: 16,
    fontSize: "clamp(18px, 2vw, 28px)",
    lineHeight: 1.3,
    fontWeight: 700,
    color: UI.muted,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  heroSide: {
    borderLeft: `1px solid ${UI.borderSoft}`,
    paddingLeft: 30,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 220,
  },
  heroSideLabel: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: UI.muted,
    textAlign: "center",
  },
  heroModulo: {
    fontSize: "clamp(110px, 10vw, 160px)",
    lineHeight: 0.9,
    fontWeight: 900,
    letterSpacing: "-0.06em",
    color: UI.brand,
  },

  emptyCard: {
    width: "100%",
    borderRadius: 24,
    border: `1px dashed ${UI.borderSoft}`,
    background: "linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%)",
    color: UI.muted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 24,
    textAlign: "center",
    padding: 32,
  },

  rightList: {
    padding: "0 20px",
    overflow: "auto",
    flex: 1,
    minHeight: 0,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
    borderBottom: `1px solid ${UI.borderSoft}`,
    padding: "14px 0",
  },
  rowStack: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: UI.muted,
  },
  rowTurno: {
    fontWeight: 900,
    fontSize: "clamp(28px, 2.8vw, 42px)",
    color: UI.ink,
    letterSpacing: "-0.05em",
  },
  rowModulo: {
    fontWeight: 900,
    fontSize: 18,
    textAlign: "center",
    color: UI.brand2,
    background: "#f1f5fb",
    border: "1px solid rgba(18,59,122,0.10)",
    borderRadius: 999,
    padding: "8px 14px",
    minWidth: 76,
  },
  rowName: {
    fontWeight: 700,
    color: UI.muted,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  adArea: {
    borderTop: `1px solid ${UI.borderSoft}`,
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  adBox: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: "16/9",
    borderRadius: 16,
    overflow: "hidden",
    background: "#111",
    boxShadow: "0 10px 22px rgba(15,23,42,0.16)",
    border: "1px solid rgba(255,255,255,0.12)",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  adImageMedia: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    background: "#111",
  },
  adVideoMedia: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    background: "#111",
  },
  adFallback: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    color: UI.ink,
    fontWeight: 900,
    textAlign: "center",
    background: "rgba(244,246,248,0.94)",
    fontSize: 14,
  },
  adEmpty: {
    color: UI.muted,
    fontWeight: 900,
    fontSize: 12,
    textAlign: "center",
    padding: 12,
  },
};

const DIGIT_WORDS_ES = {
  0: "cero",
  1: "uno",
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
  9: "nueve",
};

const LETTER_WORDS_ES = {
  A: "a",
  B: "be",
  C: "ce",
  D: "de",
  E: "e",
  F: "efe",
  G: "ge",
  H: "hache",
  I: "i",
  J: "jota",
  K: "ka",
  L: "ele",
  M: "eme",
  N: "ene",
  O: "o",
  P: "pe",
  Q: "cu",
  R: "erre",
  S: "ese",
  T: "te",
  U: "u",
  V: "uve",
  W: "doble uve",
  X: "equis",
  Y: "ye",
  Z: "zeta",
};

function formatTurnCodeForSpeech(code) {
  return (code || "")
    .toString()
    .trim()
    .split("")
    .map((char) => {
      if (/\d/.test(char)) return DIGIT_WORDS_ES[char] || char;
      if (/[A-Za-z]/.test(char)) return LETTER_WORDS_ES[char.toUpperCase()] || char;
      return char;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSpanishVoice(voices) {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  return (
    voices.find((voice) => /^es([-_]|$)/i.test(voice.lang || "")) ||
    voices.find((voice) => /spanish|espa[nñ]ol/i.test(`${voice.name || ""} ${voice.lang || ""}`)) ||
    null
  );
}

function pickSpanishVoiceSafe(voices) {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  return (
    voices.find((voice) => /^es([-_]|$)/i.test(voice.lang || "")) ||
    voices.find((voice) => /spanish|espanol/i.test(`${voice.name || ""} ${voice.lang || ""}`)) ||
    null
  );
}

function announceTurn({ codigo, modulo }) {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }

  const codigoSpeech = formatTurnCodeForSpeech(codigo) || "sin codigo";
  const moduloSpeech = (modulo || "").toString().trim() || "sin modulo";
  const phrase = `Turno ${codigoSpeech}, pasar al modulo ${moduloSpeech}`;
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const voice = pickSpanishVoiceSafe(voices) || pickSpanishVoice(voices);

  synth.cancel();

  for (let i = 0; i < 2; i += 1) {
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = voice?.lang || "es-ES";
    utterance.voice = voice || null;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.speak(utterance);
  }
}

function buildPublicContext(call) {
  const tipo = (call?.tipo || "").toString().trim();
  const tramiteID = (call?.tramiteID || "").toString().trim();

  if (tipo && tramiteID) return `${tipo} · ${tramiteID}`;
  if (tipo) return tipo;
  if (tramiteID) return `Tramite ${tramiteID}`;
  return "";
}

export default function MonitorScreen() {
  const rootRef = useRef(null);
  const { toggleFullscreen } = useImmersiveFullscreen(rootRef, {
    styleId: "cp-tv-fullscreen-style",
    bodyClassName: "cp-tv-fullscreen",
  });

  const [history, setHistory] = useState([]);
  const lastCodeRef = useRef("");
  const lastAnnouncedCallRef = useRef("");

  const [adConfig, setAdConfig] = useState(null);
  const [adError, setAdError] = useState("");
  const [adVideoRemoteFailed, setAdVideoRemoteFailed] = useState(false);

  useEffect(() => {
    const mountedAt = Date.now();
    let firstSnap = true;

    const ref = doc(db, "estadoSistema", "llamadaActual");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
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
          return;
        }
      }

      const codigo = (data.codigoLlamado || data.codigo || "").toString().trim();
      if (!codigo) return;
      if (lastCodeRef.current === codigo) return;
      lastCodeRef.current = codigo;

      const item = {
        codigo,
        modulo: (data.modulo || "").toString(),
        contextLabel: buildPublicContext(data),
        ts: Date.now(),
      };

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

  useEffect(() => {
    const ref = doc(db, "config", "pantallaTV");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setAdConfig(null);
        setAdError("");
        setAdVideoRemoteFailed(false);
        return;
      }
      setAdConfig(snap.data());
      setAdError("");
      setAdVideoRemoteFailed(false);
    });
    return () => unsub();
  }, []);

  const adType = (adConfig?.type || "video").toLowerCase();
  const configuredAdUrl = (adConfig?.url || "").toString().trim();
  const useLocalDemoVideo = adType === "video" && (!configuredAdUrl || adVideoRemoteFailed);
  const adMediaUrl = useLocalDemoVideo ? LOCAL_DEMO_VIDEO_URL : configuredAdUrl;
  const adEnabled = !!(adConfig?.enabled && (configuredAdUrl || adType === "video"));

  const currentCall = useMemo(() => history[0] || null, [history]);
  const previous = useMemo(() => history.slice(1, 8), [history]);

  useEffect(() => {
    const codigo = (currentCall?.codigo || "").toString().trim();
    const modulo = (currentCall?.modulo || "").toString().trim();

    if (!codigo) return;

    const announcedKey = `${codigo}|${modulo}`;
    if (lastAnnouncedCallRef.current === announcedKey) return;

    lastAnnouncedCallRef.current = announcedKey;
    announceTurn({ codigo, modulo });
  }, [currentCall?.codigo, currentCall?.modulo]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div ref={rootRef} style={styles.root} onDoubleClick={toggleFullscreen}>
      <div style={styles.content}>
        <div style={styles.leftPanel}>
          <div style={styles.panelAccent} />
          <div style={styles.leftHeader}>
            <div style={styles.panelTitleWrap}>
              <div style={styles.leftHeaderTitle}>Pantalla de llamados</div>
              <div style={styles.leftHeaderHint}>Visualizacion publica</div>
            </div>
          </div>

          <div style={styles.leftBody}>
            {currentCall ? (
              <div style={styles.heroCard}>
                <div style={styles.heroMain}>
                  <div style={styles.heroLabel}>Turno actual</div>
                  <div style={styles.heroTurno}>{currentCall.codigo}</div>
                  <div style={styles.heroContext}>
                    {currentCall.contextLabel || "Seguimiento publico"}
                  </div>
                </div>

                <div style={styles.heroSide}>
                  <div style={styles.heroSideLabel}>Modulo asignado</div>
                  <div style={styles.heroModulo}>{currentCall.modulo || "-"}</div>
                </div>
              </div>
            ) : (
              <div style={styles.emptyCard}>Esperando llamado...</div>
            )}
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.panelAccent} />
          <div style={styles.rightHeader}>
            <div style={styles.rightHeaderTitle}>Llamados anteriores</div>
            <div style={styles.rightHeaderMeta}>Recientes</div>
          </div>

          <div style={styles.rightList}>
            {previous.length === 0 ? (
              <div style={{ padding: 12, fontWeight: 900, color: UI.muted }}>
                Aun no hay historial. En cuanto llamen un turno, aparecera aqui.
              </div>
            ) : (
                previous.map((it, i) => (
                  <div key={it.codigo + "_" + i} style={styles.row}>
                    <div style={styles.rowStack}>
                      <div style={styles.rowTurno}>{it.codigo}</div>
                      <div style={styles.rowName}>{it.contextLabel || "-"}</div>
                    </div>
                    <div style={styles.rowModulo}>Mod. {it.modulo || "-"}</div>
                  </div>
              ))
            )}
          </div>

          <div style={styles.adArea}>
            {adEnabled ? (
              <div style={styles.adBox}>
                {adType === "image" ? (
                  <img
                    src={adMediaUrl}
                    alt="Publicidad"
                    style={styles.adImageMedia}
                    onError={() => setAdError("No se pudo cargar la imagen.")}
                  />
                ) : (
                  <video
                    src={adMediaUrl}
                    style={styles.adVideoMedia}
                    autoPlay={adConfig.autoplay !== false}
                    loop={adConfig.loop !== false}
                    muted={adConfig.mute !== false}
                    playsInline
                    controls={false}
                    onError={() => {
                      if (!useLocalDemoVideo && configuredAdUrl) {
                        setAdVideoRemoteFailed(true);
                        setAdError("");
                        return;
                      }
                      setAdError("No se pudo reproducir el video demo local en /media/monitor-demo.mp4.");
                    }}
                  />
                )}
                {adError && <div style={styles.adFallback}>{adError}</div>}
              </div>
            ) : (
              <div style={styles.adEmpty}>Publicidad desactivada (config/pantallaTV)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
