// src/components/agent/CitizenProfile.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from '../../firebase';

const styles = {
  container: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' },
  card: { border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' },
  title: { margin: 0, fontSize: 20, fontWeight: 900, color: '#c8102e' },
  sub: { margin: '6px 0 0', color: '#555', fontWeight: 700, fontSize: 12 },

  label: { fontWeight: 900, fontSize: 12, marginTop: 10, marginBottom: 6, color: '#333' },
  input: { width: '100%', padding: 10, borderRadius: 12, border: '1px solid #e5e7eb', fontWeight: 800 },
  select: { width: '100%', padding: 10, borderRadius: 12, border: '1px solid #e5e7eb', fontWeight: 800, background: '#fff' },

  btnRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 },
  btn: (variant) => {
    const base = { padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900 };
    if (variant === 'primary') return { ...base, background: '#0d6efd', color: '#fff' };
    if (variant === 'dark') return { ...base, background: '#6c757d', color: '#fff' };
    if (variant === 'danger') return { ...base, background: '#f08a93', color: '#fff' };
    return { ...base, background: '#f3f4f6', color: '#111' };
  },

  statusBox: { marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 800, color: '#333', whiteSpace: 'pre-line' },
  recTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: '#111' },
  recSub: { margin: '6px 0 0', color: '#666', fontWeight: 700, fontSize: 12 },
  recItem: { border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, marginTop: 10, background: '#fff' }
};

// Normaliza a solo dígitos (y K si viene), para DNI/RUT.
function normalizeDniRut(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().replace(/[^0-9K]/g, '');
}

function buildNombreFinal({ nombres, apellidos, nombreCompleto }) {
  const n = (nombres || '').trim();
  const a = (apellidos || '').trim();
  const c = (nombreCompleto || '').trim();
  if (c) return c;
  return `${n} ${a}`.trim();
}

function splitNombreCompleto(full) {
  const t = (full || '').trim();
  if (!t) return { nombres: '', apellidos: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  return { nombres: parts.slice(0, -1).join(' '), apellidos: parts.slice(-1).join(' ') };
}

export default function CitizenProfile({ role = 'agente' }) {
  const isAdmin = role === 'admin';

  const [dniRaw, setDniRaw] = useState('');
  const dniNorm = useMemo(() => normalizeDniRut(dniRaw), [dniRaw]);

  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [exists, setExists] = useState(false);
  const [source, setSource] = useState(''); // 'ciudadanos' | 'usuarios' | ''
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [recientes, setRecientes] = useState([]);

  const resetForm = () => {
    setTipoDoc('DNI');
    setNombres('');
    setApellidos('');
    setNombreCompleto('');
    setTelefono('');
    setEmail('');
    setExists(false);
    setSource('');
  };

  // Recientes (colecciónGroup citas) -> requiere índice (el error que te salía)
  useEffect(() => {
    if (!dniNorm) {
      setRecientes([]);
      return;
    }

    const qRec = query(
      collectionGroup(db, 'citas'),
      where('dni', '==', dniNorm),
      where('estado', 'in', ['completado', 'cerrada', 'cerrado', 'no_asistio', 'NO_SE_PRESENTO', 'NO_SE_PRESENTÓ']),
      orderBy('fechaHoraAtencionFin', 'desc'),
      limit(8)
    );

    const unsub = onSnapshot(
      qRec,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecientes(rows);
      },
      (err) => {
        console.error('Recientes error:', err);
        // no matamos la UI por esto:
        setMsg((prev) => prev || `⚠️ Recientes: ${err?.message || 'error'}`);
      }
    );

    return () => unsub();
  }, [dniNorm]);

  const buscar = async () => {
    setMsg('');
    if (!dniNorm) return setMsg('Ingresa DNI/RUT.');

    setBusy(true);
    try {
      // 1) Primario: ciudadanos/{dniNorm} (ficha Siebel)
      const refC = doc(db, 'ciudadanos', dniNorm);
      const snapC = await getDoc(refC);

      if (snapC.exists()) {
        const data = snapC.data() || {};
        setTipoDoc(data.tipoDoc || 'DNI');
        setNombres(data.nombres || '');
        setApellidos(data.apellidos || '');
        setNombreCompleto(data.nombreCompleto || '');
        setTelefono(data.telefono || '');
        setEmail(data.email || '');
        setExists(true);
        setSource('ciudadanos');
        setMsg('✅ Encontrado en “ciudadanos”.');
        return;
      }

      // 2) Secundario: si es admin, intentar en usuarios (Auth)
      if (isAdmin) {
        const qU = query(
          collection(db, 'usuarios'),
          where('rol', '==', 'ciudadano'),
          where('dni', '==', dniNorm),
          limit(1)
        );
        const uSnap = await getDocs(qU);
        if (!uSnap.empty) {
          const d = uSnap.docs[0];
          const data = d.data() || {};
          const full = data.nombre || data.nombreCompleto || '';
          const parts = splitNombreCompleto(full);

          setTipoDoc('DNI');
          setNombres(parts.nombres);
          setApellidos(parts.apellidos);
          setNombreCompleto(full || '');
          setTelefono(data.telefono || '');
          setEmail(data.email || '');
          setExists(true);
          setSource('usuarios');
          setMsg('✅ Encontrado en “usuarios” (Auth). Puedes GUARDAR para crear/actualizar ficha en “ciudadanos”.');
          return;
        }
      }

      setExists(false);
      setSource('');
      setMsg('❌ No existe. Puedes crear el perfil y guardar.');
    } catch (e) {
      console.error(e);
      setMsg(`❌ Error al buscar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const guardar = async () => {
    setMsg('');
    if (!dniNorm) return setMsg('Ingresa DNI/RUT.');

    setBusy(true);
    try {
      const nombreFinal = buildNombreFinal({ nombres, apellidos, nombreCompleto });

      // Guardamos SIEMPRE en ciudadanos/{dniNorm}
      const ref = doc(db, 'ciudadanos', dniNorm);
      const payload = {
        dni: dniNorm,
        tipoDoc,
        nombres: (nombres || '').trim(),
        apellidos: (apellidos || '').trim(),
        nombreCompleto: (nombreFinal || '').trim(),
        telefono: (telefono || '').trim(),
        email: (email || '').trim(),
        updatedAt: serverTimestamp()
      };

      // si no existía, le ponemos createdAt
      const before = await getDoc(ref);
      if (!before.exists()) payload.createdAt = serverTimestamp();

      await setDoc(ref, payload, { merge: true });

      setExists(true);
      setSource('ciudadanos');
      setMsg('✅ Guardado en “ciudadanos”.');
    } catch (e) {
      console.error(e);
      setMsg(`❌ Error al guardar: ${e?.code ? `[${e.code}] ` : ''}${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async () => {
    setMsg('');
    if (!dniNorm) return setMsg('Ingresa DNI/RUT.');
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'ciudadanos', dniNorm));
      resetForm();
      setMsg('🗑️ Eliminado de “ciudadanos”.');
    } catch (e) {
      console.error(e);
      setMsg(`❌ Error al eliminar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const limpiar = () => {
    setDniRaw('');
    resetForm();
    setMsg('');
    setRecientes([]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <h2 style={styles.title}>Perfil de Ciudadano</h2>
            <p style={styles.sub}>Busca por DNI/RUT, edita o crea si no existe. La ficha se guarda en “ciudadanos”.</p>
          </div>
          <div style={{ fontWeight: 900, fontSize: 12, color: '#444', background: '#f3f4f6', padding: '6px 10px', borderRadius: 999 }}>
            Acceso: {isAdmin ? 'admin' : 'agente'}
          </div>
        </div>

        <div style={styles.label}>DNI/RUT (puedes escribir con puntos y guion)</div>
        <input style={styles.input} value={dniRaw} onChange={(e) => setDniRaw(e.target.value)} placeholder="18.373.138-1" />

        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: '#666' }}>
          Normalizado: <span style={{ color: '#111' }}>{dniNorm || '-'}</span>
        </div>

        <div style={styles.label}>Tipo Documento</div>
        <select style={styles.select} value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
          <option value="DNI">DNI</option>
          <option value="RUT">RUT</option>
          <option value="PASAPORTE">PASAPORTE</option>
        </select>

        <div style={styles.btnRow}>
          <button style={styles.btn('dark')} onClick={buscar} disabled={busy}>Buscar</button>
          <button style={styles.btn('primary')} onClick={guardar} disabled={busy}>Guardar</button>
          <button style={styles.btn()} onClick={limpiar} disabled={busy}>Limpiar</button>
          <button style={styles.btn('danger')} onClick={eliminar} disabled={busy}>Eliminar</button>
        </div>

        <div style={styles.label}>Nombres</div>
        <input style={styles.input} value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Ej: Juan Carlos" />

        <div style={styles.label}>Apellidos</div>
        <input style={styles.input} value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Ej: Pérez Gómez" />

        <div style={styles.label}>Nombre completo (opcional)</div>
        <input style={styles.input} value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Si se deja vacío, se arma con Nombre + Apellido" />

        <div style={styles.label}>Teléfono (opcional)</div>
        <input style={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: +56 9 1234 5678" />

        <div style={styles.label}>Email (opcional)</div>
        <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ej: correo@dominio.com" />

        <div style={styles.statusBox}>
          {`Estado: ${exists ? 'Existe' : 'No existe'}\n` +
            `Fuente: ${source || '--'}\n` +
            `ID norm: ${dniNorm || '--'}\n` +
            `Nombre final: ${buildNombreFinal({ nombres, apellidos, nombreCompleto }) || '--'}\n\n` +
            `Mensaje: ${msg || (exists ? 'Listo.' : 'No existe. Puedes crear el perfil y guardar.')}`}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.recTitle}>Recientes</h3>
        <p style={styles.recSub}>Últimas atenciones del ciudadano (según “citas”).</p>

        {recientes.length === 0 ? (
          <div style={{ marginTop: 10, color: '#666', fontWeight: 800, fontSize: 12 }}>
            Sin registros recientes.
          </div>
        ) : (
          recientes.map((r) => (
            <div key={r.id} style={styles.recItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 900 }}>{r.codigo || '-'}</div>
                <div style={{ fontWeight: 900, color: '#666' }}>{r.estado || '-'}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#444' }}>
                Trámite: {r.tramiteNombre || r.tramiteID || '-'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
