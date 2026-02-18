import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

// --- ESTILOS EN LÍNEA PARA LA PANTALLA TV ---
const styles = {
  tvScreen: {
    backgroundColor: '#FFFFFF',
    color: '#333333',
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },

  // Sección principal (turno grande)
  mainSection: {
    flex: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInner: {
    textAlign: 'center',
  },
  turnoLabel: {
    fontSize: '3vw',
    letterSpacing: '0.6vw',
    marginBottom: '1.5vw',
  },
  turnoCodigo: {
    fontSize: '11vw',
    fontWeight: 'bold',
    color: '#C8102E',
    lineHeight: 1,
  },
  moduloText: {
    marginTop: '1.4vw',
    fontSize: '2.4vw',
    fontWeight: 'bold',
  },

  citizenRow: {
    marginTop: '1.2vw',
    display: 'flex',
    gap: '1.4vw',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  citizenChip: {
    padding: '0.8vw 1.2vw',
    borderRadius: '999px',
    background: '#f3f4f6',
    fontSize: '1.2vw',
    fontWeight: 'bold',
  },

  // Sección lateral (turnos por trámite)
  sideSection: {
    flex: 1.3,
    backgroundColor: '#f9fafb',
    borderLeft: '2px solid #e5e7eb',
    padding: '2vw',
    overflowY: 'auto',
  },
  sideTitle: {
    fontSize: '1.6vw',
    fontWeight: 'bold',
    marginBottom: '1vw',
    color: '#111',
  },
  tramiteItem: {
    backgroundColor: '#ffffff',
    padding: '1vw',
    marginBottom: '1vw',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  },
  tramiteName: {
    fontSize: '1.2vw',
    fontWeight: 'bold',
    marginBottom: '0.6vw',
  },
  tramiteCodigo: {
    fontSize: '2.2vw',
    fontWeight: 'bold',
    color: '#0d6efd',
    lineHeight: 1,
  },
  tramiteModulo: {
    marginTop: '0.5vw',
    fontSize: '1.1vw',
    fontWeight: 'bold',
    color: '#444',
  },

  // Publicidad flotante
  adBox: {
    position: 'fixed',
    zIndex: 20,
    borderRadius: 14,
    overflow: 'hidden',
    background: '#111',
    boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
    border: '2px solid rgba(255,255,255,0.18)',
  },
  adMedia: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'cover',
    background: '#111',
  },
  adFallback: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    color: '#fff',
    fontWeight: 800,
    textAlign: 'center',
    background: 'rgba(0,0,0,0.55)',
    fontSize: 14
  },
};

function getAdPositionStyle(pos, pad = 16) {
  const p = (pos || 'br').toLowerCase();
  const base = { right: pad, bottom: pad };
  if (p === 'bl') return { left: pad, bottom: pad };
  if (p === 'tr') return { right: pad, top: pad, bottom: 'auto' };
  if (p === 'tl') return { left: pad, top: pad, bottom: 'auto', right: 'auto' };
  return base; // br
}

function normalizeDocId(text) {
  return (text || '').toString().trim().replace(/\s+/g, '').toUpperCase();
}

export default function MonitorScreen() {
  const [tramites, setTramites] = useState([]);
  const [tramitesEstado, setTramitesEstado] = useState({});
  const [llamadaActual, setLlamadaActual] = useState(null);

  const [nombreCiudadano, setNombreCiudadano] = useState('');

  const [adConfig, setAdConfig] = useState(null);
  const [adError, setAdError] = useState('');

  // Buscar nombre por DNI/RUT en ciudadanos
  async function lookupNombrePorDni(dniRaw) {
    try {
      const dni = normalizeDocId(dniRaw);
      if (!dni) return '';

      // Intento 1: doc id = dni
      const ref = doc(db, 'ciudadanos', dni);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data() || {};
        return (d.nombre || d.nombres || d.fullName || '').toString().trim();
      }

      // Intento 2: query por campo dni
      const q = query(
        collection(db, 'ciudadanos'),
        where('dni', '==', dniRaw),
        limit(1)
      );
      const qs = await getDocs(q);
      if (!qs.empty) {
        const d = qs.docs[0].data() || {};
        return (d.nombre || d.nombres || d.fullName || '').toString().trim();
      }

      return '';
    } catch (e) {
      console.error('lookupNombrePorDni error:', e);
      return '';
    }
  }

  // Llamada actual
  useEffect(() => {
    const mountedAt = Date.now();
    let firstSnap = true;

    const ref = doc(db, 'estadoSistema', 'llamadaActual');
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
    });

    return () => unsubscribe();
  }, []);

  // Nombre ciudadano
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const dniRaw = (llamadaActual?.dni || '').toString().trim();
      const nombreDirecto = (llamadaActual?.userNombre || '').toString().trim();

      const codigo = (llamadaActual?.codigoLlamado || llamadaActual?.codigo || '').toString().trim();
      if (!llamadaActual || !codigo) {
        setNombreCiudadano('');
        return;
      }

      if (nombreDirecto) {
        setNombreCiudadano(nombreDirecto);
        return;
      }

      if (!dniRaw) {
        setNombreCiudadano('');
        return;
      }

      const found = await lookupNombrePorDni(dniRaw);
      if (!cancelled) setNombreCiudadano(found || '');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [llamadaActual]);

  // Trámites
  useEffect(() => {
    const tramitesRef = collection(db, 'tramites');
    const unsubscribe = onSnapshot(tramitesRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTramites(list);
    });

    return () => unsubscribe();
  }, []);

  // Estado por trámite
  useEffect(() => {
    if (!tramites || tramites.length === 0) return;

    const unsubscribes = tramites.map((tramite) => {
      const estadoId = `tramite_${tramite.id}`;
      const ref = doc(db, 'estadoSistema', estadoId);

      return onSnapshot(ref, (snap) => {
        setTramitesEstado((prev) => ({
          ...prev,
          [tramite.id]: snap.exists() ? snap.data() : null,
        }));
      });
    });

    return () => unsubscribes.forEach((u) => u && u());
  }, [tramites]);

  // Publicidad flotante config
  useEffect(() => {
    const ref = doc(db, 'config', 'pantallaTV');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setAdConfig(null);
        return;
      }
      setAdConfig(snap.data());
      setAdError('');
    });
    return () => unsub();
  }, []);

  const codigoCentral = (llamadaActual?.codigoLlamado || llamadaActual?.codigo || '');
  const moduloCentral = llamadaActual?.modulo || '';
  const dniCentralRaw = (llamadaActual?.dni || '').toString().trim();
  const dniCentralNorm = normalizeDocId(dniCentralRaw);
  const hayLlamada = !!codigoCentral;

  const adEnabled = !!(adConfig?.enabled && adConfig?.url);
  const adType = (adConfig?.type || 'video').toLowerCase();
  const adPos = (adConfig?.position || 'br').toLowerCase();
  const adWidthVW = Number.isFinite(adConfig?.widthVW) ? adConfig.widthVW : 28;
  const adAspect = adConfig?.aspect || '16/9';

  const adStyle = {
    ...styles.adBox,
    ...getAdPositionStyle(adPos, 18),
    width: `${adWidthVW}vw`,
    maxWidth: '520px',
    minWidth: '280px',
    aspectRatio: adAspect
  };

  return (
    <div style={styles.tvScreen}>
      {adEnabled && (
        <div style={adStyle}>
          {adType === 'image' ? (
            <img
              src={adConfig.url}
              alt="Publicidad"
              style={styles.adMedia}
              onError={() => setAdError('No se pudo cargar la imagen.')}
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
              onError={() => setAdError('No se pudo reproducir el video.')}
            />
          )}

          {adError && <div style={styles.adFallback}>{adError}</div>}
        </div>
      )}

      <div style={styles.mainSection}>
        <div style={styles.mainInner}>
          <div style={styles.turnoLabel}>TURNO</div>

          <div style={styles.turnoCodigo}>
            {hayLlamada ? codigoCentral : '—'}
          </div>

          <div style={styles.moduloText}>
            {hayLlamada ? `Módulo ${moduloCentral || '—'}` : 'Esperando llamado...'}
          </div>

          {hayLlamada && (
            <div style={styles.citizenRow}>
              <div style={styles.citizenChip}>
                {dniCentralNorm ? `DNI/RUT: ${dniCentralNorm}` : 'DNI/RUT: —'}
              </div>

              <div style={styles.citizenChip}>
                {nombreCiudadano ? `Nombre: ${nombreCiudadano}` : 'Nombre: —'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.sideSection}>
        <div style={styles.sideTitle}>Siguientes por Trámite</div>

        {tramites.map((t) => {
          const est = tramitesEstado[t.id];
          const codigo = est?.codigoLlamado || '—';
          const modulo = est?.modulo || '—';

          return (
            <div key={t.id} style={styles.tramiteItem}>
              <div style={styles.tramiteName}>{t.nombre || t.id}</div>
              <div style={styles.tramiteCodigo}>{codigo}</div>
              <div style={styles.tramiteModulo}>Módulo: {modulo}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
