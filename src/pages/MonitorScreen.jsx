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

const styles = {
  tvScreen: {
    backgroundColor: '#FFFFFF',
    color: '#333333',
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
    position: 'relative' // para overlay flotante
  },

  mainSection: {
    flex: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInner: { textAlign: 'center' },
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
    marginBottom: '1.2vw',
  },
  turnoModulo: {
    fontSize: '4vw',
    fontWeight: 'bold',
    marginTop: '0.4vw'
  },
  turnoPlaceholder: {
    fontSize: '4vw',
    color: '#999999',
  },

  citizenBox: {
    marginTop: '1.2vw',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35vw',
    alignItems: 'center',
    justifyContent: 'center'
  },
  citizenLine: {
    fontSize: '2.3vw',
    fontWeight: 800,
    color: '#222'
  },
  citizenSubLine: {
    fontSize: '1.8vw',
    color: '#444',
    fontWeight: 700
  },

  sidePanel: {
    flex: 1.6,
    borderLeft: '8px solid #C8102E',
    backgroundColor: '#f8f8f8',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5vw 1.8vw',
    boxSizing: 'border-box',
  },
  sideHeader: {
    fontSize: '2.2vw',
    fontWeight: 'bold',
    color: '#C8102E',
    marginBottom: '0.6vw',
  },
  sideSubHeader: {
    borderBottom: '4px solid #C8102E',
    marginBottom: '1.2vw',
  },
  cardsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6vw',
    overflowY: 'auto',
    paddingRight: '0.4vw',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '0.6vw 0.9vw',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    borderLeft: '4px solid #C8102E',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '4vw',
  },
  cardNombre: {
    fontSize: '1.2vw',
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: '0.2vw',
  },
  cardPrefijo: {
    fontSize: '0.9vw',
    color: '#666666',
    marginBottom: '0.1vw',
  },
  cardLinea: {
    fontSize: '1.0vw',
    color: '#333333',
  },
  cardLineaCita: {
    fontSize: '0.9vw',
    color: '#555555',
    marginTop: '0.15vw',
  },
  cardSinLlamados: {
    fontSize: '0.95vw',
    color: '#777777',
  },

  // --- Publicidad flotante ---
  adBox: {
    position: 'absolute',
    zIndex: 50,
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    background: '#000'
  },
  adMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  adFallback: {
    color: '#fff',
    padding: '10px',
    fontSize: '14px',
    fontWeight: 700
  }
};

function normalizeDocId(v) {
  return (v || '').toString().trim().toUpperCase().replace(/[^0-9K]/g, '');
}

function buildNombreCompleto(nombres, apellidos) {
  const a = (nombres || '').toString().trim();
  const b = (apellidos || '').toString().trim();
  return [a, b].filter(Boolean).join(' ').trim();
}

async function lookupNombrePorDni(dniRaw) {
  try {
    const dniNorm = normalizeDocId(dniRaw);
    if (!dniNorm) return '';

    const refCitizen = doc(db, 'ciudadanos', dniNorm);
    const snapCitizen = await getDoc(refCitizen);
    if (snapCitizen.exists()) {
      const data = snapCitizen.data() || {};
      const nombre =
        data.nombreCompleto ||
        data.userNombre ||
        data.nombre ||
        buildNombreCompleto(data.nombres, data.apellidos);
      return (nombre || '').toString().trim();
    }

    const qExact = query(collection(db, 'usuarios'), where('dni', '==', dniNorm), limit(1));
    const snapExact = await getDocs(qExact);
    if (!snapExact.empty) {
      const data = snapExact.docs[0].data() || {};
      const nombre =
        data.nombreCompleto ||
        data.userNombre ||
        data.nombre ||
        buildNombreCompleto(data.nombres, data.apellidos);
      return (nombre || '').toString().trim();
    }

    return '';
  } catch (err) {
    console.error('lookupNombrePorDni error:', err);
    return '';
  }
}

function getAdPositionStyle(position, marginPx = 18) {
  const base = { margin: `${marginPx}px` };
  switch ((position || 'br').toLowerCase()) {
    case 'tl':
      return { top: marginPx, left: marginPx };
    case 'tr':
      return { top: marginPx, right: marginPx };
    case 'bl':
      return { bottom: marginPx, left: marginPx };
    case 'br':
    default:
      return { bottom: marginPx, right: marginPx };
  }
}

export default function MonitorScreen() {
  const [llamadaActual, setLlamadaActual] = useState(null);
  const [tramites, setTramites] = useState([]);
  const [tramitesEstado, setTramitesEstado] = useState({});
  const [nombreCiudadano, setNombreCiudadano] = useState('');

  const [adConfig, setAdConfig] = useState(null);
  const [adError, setAdError] = useState('');

  // Llamada actual
  useEffect(() => {
    const ref = doc(db, 'estadoSistema', 'llamadaActual');

    const mountedAt = Date.now();
    let firstSnap = true;

    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : null;

      if (!data || !data.codigoLlamado) {
        setLlamadaActual(null);
        firstSnap = false;
        return;
      }

      const tsMs =
        data.timestamp && typeof data.timestamp.toMillis === 'function'
          ? data.timestamp.toMillis()
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

      if (!llamadaActual || !llamadaActual.codigoLlamado) {
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

  const codigoCentral = llamadaActual?.codigoLlamado || '';
  const moduloCentral = llamadaActual?.modulo || '';
  const dniCentralRaw = (llamadaActual?.dni || '').toString().trim();
  const dniCentralNorm = normalizeDocId(dniCentralRaw);
  const hayLlamada = !!codigoCentral;

  const adEnabled = !!(adConfig?.enabled && adConfig?.url);
  const adType = (adConfig?.type || 'video').toLowerCase();
  const adPos = (adConfig?.position || 'br').toLowerCase();
  const adWidthVW = Number.isFinite(adConfig?.widthVW) ? adConfig.widthVW : 28;
  const adAspect = adConfig?.aspect || '16/9';

  // tamaño: usamos width en vw y calculamos height por aspect ratio con CSS aspectRatio
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
          <div style={styles.turnoLabel}>TURNO LLAMADO</div>

          {hayLlamada ? (
            <>
              <div style={styles.turnoCodigo}>{codigoCentral}</div>

              {moduloCentral && (
                <div style={styles.turnoModulo}>MÓDULO {moduloCentral}</div>
              )}

              {(dniCentralRaw || nombreCiudadano) && (
                <div style={styles.citizenBox}>
                  <div style={styles.citizenLine}>DNI/RUT: {dniCentralRaw || dniCentralNorm}</div>
                  {nombreCiudadano && <div style={styles.citizenSubLine}>{nombreCiudadano}</div>}
                </div>
              )}
            </>
          ) : (
            <div style={styles.turnoPlaceholder}>ESPERANDO LLAMADA…</div>
          )}
        </div>
      </div>

      <div style={styles.sidePanel}>
        <div style={styles.sideHeader}>ESTADO DE TURNOS</div>
        <div style={styles.sideHeader}>POR TRÁMITE</div>
        <div style={styles.sideSubHeader} />

        <div style={styles.cardsContainer}>
          {tramites.map((tramite) => {
            const estado = tramitesEstado[tramite.id];
            const tieneLlamado = !!(estado && estado.codigoLlamado);
            const codigo = estado?.codigoLlamado || '';
            const esCitaWeb = (estado?.tipo && String(estado.tipo).toLowerCase() === 'cita') || false;
            const prefijo = tramite.prefijo || tramite.codigo || tramite.abreviatura || '--';

            return (
              <div key={tramite.id} style={styles.card}>
                <div style={styles.cardNombre}>{tramite.nombre || tramite.id}</div>
                <div style={styles.cardPrefijo}>Prefijo: {prefijo}</div>

                {tieneLlamado && !esCitaWeb && (
                  <div style={styles.cardLinea}>
                    Vamos en: <strong>{codigo}</strong> — Módulo {estado.modulo}
                  </div>
                )}

                {!tieneLlamado && (
                  <div style={styles.cardSinLlamados}>Sin llamados aún para este trámite.</div>
                )}

                {tieneLlamado && esCitaWeb && (
                  <div style={styles.cardLineaCita}>
                    Cita web en atención: <strong>{codigo}</strong> — Módulo {estado.modulo}
                  </div>
                )}
              </div>
            );
          })}

          {tramites.length === 0 && (
            <div style={styles.cardSinLlamados}>No hay trámites configurados en el sistema.</div>
          )}
        </div>
      </div>
    </div>
  );
}
