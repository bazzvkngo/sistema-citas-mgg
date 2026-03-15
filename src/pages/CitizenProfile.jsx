// src/pages/CitizenProfile.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/AuthContext';
import { db, functions } from '../firebase';
import {
  buildCitizenFullName,
  buildCitizenPayload,
  mapCitizenDocToForm,
  mapUserBootstrapToForm,
  normalizeCitizenDoc,
} from '../utils/citizenProfileData';

const styles = {
  container: {
    padding: '16px',
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '12px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px'
  },
  title: { margin: 0, color: '#C8102E', fontSize: '20px', fontWeight: 900 },
  badge: {
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid #e9ecef',
    background: '#f8f9fa',
    fontSize: '12px',
    color: '#333',
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },

  row: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '260px', flex: 1 },
  label: { fontSize: '12px', color: '#666', fontWeight: 800 },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    outline: 'none',
    fontSize: '14px'
  },
  select: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    outline: 'none',
    fontSize: '14px',
    background: '#fff'
  },

  actions: { display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' },
  btn: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: '14px'
  },
  btnPrimary: { background: '#0d6efd', color: '#fff' },
  btnSecondary: { background: '#6c757d', color: '#fff' },
  btnDanger: { background: '#dc3545', color: '#fff' },
  btnMuted: { background: '#f3f4f6', color: '#222', border: '1px solid #e5e7eb' },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },

  helper: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #eee',
    background: '#fafafa',
    color: '#333',
    fontSize: '13px'
  },

  split: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '16px',
    marginTop: '14px'
  },
  rightBox: {
    border: '1px solid #eee',
    borderRadius: '12px',
    padding: '12px',
    background: '#fff'
  },
  rightTitle: { margin: 0, marginBottom: '10px', fontWeight: 900, color: '#333' },
  recentList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  recentCard: {
    padding: '10px',
    border: '1px solid #eee',
    borderRadius: '10px',
    background: '#fafafa'
  },
  recentName: { fontWeight: 900, color: '#222', marginBottom: '2px' },
  recentLine: { fontSize: '12px', color: '#555' }
};

const lookupCitizenUserByDoc = httpsCallable(functions, 'lookupCitizenUserByDoc');

async function findCitizenUserByDoc(docNorm) {
  const result = await lookupCitizenUserByDoc({ doc: docNorm });
  const payload = result?.data || {};
  return payload?.found ? payload.user || null : null;
}

export default function CitizenProfile() {
  const { currentUser } = useAuth();

  const [docIdInput, setDocIdInput] = useState('');
  const [tipoDoc, setTipoDoc] = useState('DNI');

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastLoadedId, setLastLoadedId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [recent, setRecent] = useState([]);

  const computedNombreCompleto = useMemo(() => {
    return buildCitizenFullName({ nombres, apellidos, nombreCompleto });
  }, [nombreCompleto, nombres, apellidos]);

  const role = useMemo(() => {
    return currentUser?.rol || currentUser?.role || currentUser?.tipoUsuario || currentUser?.perfil || '';
  }, [currentUser]);

  const canUse = useMemo(() => {
    return role === 'admin' || role === 'agente' || currentUser?.isAdmin === true;
  }, [role, currentUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecent() {
      try {
        const q = query(collection(db, 'ciudadanos'), orderBy('updatedAt', 'desc'), limit(8));
        const snap = await getDocs(q);
        if (cancelled) return;

        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecent(list);
      } catch (e) {
        console.error('Error cargando recientes ciudadanos:', e);
      }
    }

    if (canUse) loadRecent();
    return () => {
      cancelled = true;
    };
  }, [canUse]);

  const resetForm = () => {
    setTipoDoc('DNI');
    setNombres('');
    setApellidos('');
    setNombreCompleto('');
    setTelefono('');
    setEmail('');
    setExists(false);
    setLastLoadedId('');
    setStatusMsg('');
  };

  // ✅ NUEVO: busca en ciudadanos, y si no existe, autocompleta desde usuarios
  const loadCitizen = async (docIdRaw) => {
    setStatusMsg('');
    const idNorm = normalizeCitizenDoc(docIdRaw || docIdInput);

    if (!idNorm) {
      setStatusMsg('Ingresa un DNI/RUT válido para buscar.');
      return;
    }

    setLoading(true);
    try {
      // 1) ciudadanos/{idNorm}
      const ref = doc(db, 'ciudadanos', idNorm);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() || {};
        const mapped = mapCitizenDocToForm(idNorm, data);
        setDocIdInput(mapped.docIdInput);
        setTipoDoc(mapped.tipoDoc);
        setNombres(mapped.nombres);
        setApellidos(mapped.apellidos);
        setNombreCompleto(mapped.nombreCompleto);
        setTelefono(mapped.telefono);
        setEmail(mapped.email);
        setExists(mapped.exists);
        setLastLoadedId(idNorm);

        const nombreFinal = buildCitizenFullName(data).trim();
        if (!nombreFinal && !data.telefono && !data.email) {
          setStatusMsg('⚠️ Existe la ficha, pero está incompleta. Completa y presiona Guardar.');
        } else {
          setStatusMsg('✅ Perfil cargado. Puedes editar y Guardar.');
        }
        return;
      }

      // 2) fallback a usuarios (registro)
      const userData = await findCitizenUserByDoc(idNorm);
      if (userData) {
        const mapped = mapUserBootstrapToForm(idNorm, userData);
        setDocIdInput(mapped.docIdInput);
        setTipoDoc(mapped.tipoDoc);
        setNombres(mapped.nombres);
        setApellidos(mapped.apellidos);
        setNombreCompleto(mapped.nombreCompleto);
        setTelefono(mapped.telefono);
        setEmail(mapped.email);
        setExists(mapped.exists);
        setLastLoadedId(idNorm);
        setStatusMsg('✅ Datos cargados desde REGISTRO. Presiona Guardar para crear la ficha del ciudadano.');
        return;
      }

      // 3) no existe en ningún lado
      resetForm();
      setDocIdInput(docIdRaw || docIdInput);
      setExists(false);
      setLastLoadedId(idNorm);
      setStatusMsg('No existe. Puedes crear el perfil y guardar.');
    } catch (e) {
      console.error('Error cargando ciudadano:', e);
      setStatusMsg('Error al cargar. Revisa consola.');
    } finally {
      setLoading(false);
    }
  };

  const saveCitizen = async () => {
    setStatusMsg('');

    if (!canUse) {
      setStatusMsg('No autorizado.');
      return;
    }

    const idNorm = normalizeCitizenDoc(docIdInput);
    if (!idNorm) {
      setStatusMsg('Ingresa un DNI/RUT válido.');
      return;
    }

    const nombreCompletoV = (computedNombreCompleto || '').toString().trim();

    if (!nombreCompletoV) {
      setStatusMsg('Debes ingresar al menos nombres y/o apellidos.');
      return;
    }

    setLoading(true);
    try {
      const ref = doc(db, 'ciudadanos', idNorm);
      const payload = {
        ...buildCitizenPayload({
          docNorm: idNorm,
          docDisplay: docIdInput,
          tipoDoc,
          nombres,
          apellidos,
          nombreCompleto: nombreCompletoV,
          telefono,
          email,
        }),
        updatedAt: serverTimestamp()
      };

      if (!exists) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser?.uid || '';
      } else {
        payload.updatedBy = currentUser?.uid || '';
      }

      await setDoc(ref, payload, { merge: true });

      setExists(true);
      setLastLoadedId(idNorm);
      setStatusMsg('Guardado correctamente.');

      const q = query(collection(db, 'ciudadanos'), orderBy('updatedAt', 'desc'), limit(8));
      const snap = await getDocs(q);
      setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error guardando ciudadano:', e);
      setStatusMsg('Error al guardar. Revisa consola.');
    } finally {
      setLoading(false);
    }
  };

  const deleteCitizen = async () => {
    setStatusMsg('');

    if (!canUse) {
      setStatusMsg('No autorizado.');
      return;
    }

    const idNorm = normalizeCitizenDoc(docIdInput);
    if (!exists || !idNorm) {
      setStatusMsg('No hay perfil cargado para eliminar.');
      return;
    }

    const ok = window.confirm('Eliminar este perfil de ciudadano.\nEsta acción no se puede deshacer.');
    if (!ok) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'ciudadanos', idNorm));
      setStatusMsg('Eliminado.');
      resetForm();
      setDocIdInput('');

      const q = query(collection(db, 'ciudadanos'), orderBy('updatedAt', 'desc'), limit(8));
      const snap = await getDocs(q);
      setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error eliminando ciudadano:', e);
      setStatusMsg('Error al eliminar. Revisa consola.');
    } finally {
      setLoading(false);
    }
  };

  const onPickRecent = (id) => {
    setDocIdInput(id);
    loadCitizen(id);
  };

  if (!canUse) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Perfil de Ciudadano</h2>
          <div style={styles.badge}>No autorizado</div>
        </div>
        <div style={styles.helper}>Tu rol actual no permite administrar perfiles de ciudadanos.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Perfil de Ciudadano</h2>
        <div style={styles.badge}>Acceso: {role || 'staff'}</div>
      </div>

      <div style={styles.split}>
        <div>
          <div style={styles.row}>
            <div style={styles.field}>
              <div style={styles.label}>DNI/RUT (puedes escribir con puntos y guion)</div>
              <input
                style={styles.input}
                value={docIdInput}
                onChange={(e) => setDocIdInput(e.target.value)}
                placeholder="Ej: 13.214.213-0"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadCitizen();
                }}
              />
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 800 }}>
                Normalizado: {normalizeCitizenDoc(docIdInput) || '--'}
              </div>
            </div>

            <div style={styles.field}>
              <div style={styles.label}>Tipo Documento</div>
              <select
                style={styles.select}
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                disabled={loading}
              >
                <option value="DNI">DNI</option>
                <option value="RUT">RUT</option>
                <option value="PASAPORTE">PASAPORTE</option>
                <option value="OTRO">OTRO</option>
              </select>
            </div>
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => loadCitizen()}
              disabled={loading}
              style={{ ...styles.btn, ...styles.btnSecondary, ...(loading ? styles.btnDisabled : {}) }}
            >
              Buscar
            </button>

            <button
              onClick={saveCitizen}
              disabled={loading}
              style={{ ...styles.btn, ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
            >
              Guardar
            </button>

            <button
              onClick={() => {
                resetForm();
                setDocIdInput('');
              }}
              disabled={loading}
              style={{ ...styles.btn, ...styles.btnMuted, ...(loading ? styles.btnDisabled : {}) }}
            >
              Limpiar
            </button>

            <button
              onClick={deleteCitizen}
              disabled={loading || !exists}
              style={{
                ...styles.btn,
                ...styles.btnDanger,
                ...((loading || !exists) ? styles.btnDisabled : {})
              }}
            >
              Eliminar
            </button>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <div style={styles.label}>Nombres</div>
              <input
                style={styles.input}
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Ej: Juan Carlos"
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <div style={styles.label}>Apellidos</div>
              <input
                style={styles.input}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ej: Pérez Gómez"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <div style={styles.label}>Nombre completo (opcional)</div>
              <input
                style={styles.input}
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Si se deja vacío, se arma con Nombres + Apellidos"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <div style={styles.label}>Teléfono (opcional)</div>
              <input
                style={styles.input}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +56 9 1234 5678"
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <div style={styles.label}>Email (opcional)</div>
              <input
                style={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ej: correo@dominio.com"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.helper}>
            <div><strong>Estado:</strong> {exists ? 'Existe' : 'No existe en ciudadanos'}</div>
            <div><strong>Último cargado (ID norm):</strong> {lastLoadedId || '--'}</div>
            <div><strong>Nombre final:</strong> {computedNombreCompleto || '--'}</div>
            {statusMsg && (
              <div style={{ marginTop: '8px' }}>
                <strong>Mensaje:</strong> {statusMsg}
              </div>
            )}
          </div>
        </div>

        <div style={styles.rightBox}>
          <h3 style={styles.rightTitle}>Recientes</h3>

          {recent.length === 0 ? (
            <div style={{ color: '#666', fontSize: '13px' }}>Sin registros recientes.</div>
          ) : (
            <div style={styles.recentList}>
              {recent.map((c) => {
                const nombre = buildCitizenFullName(c).toString();
                return (
                  <div key={c.id} style={styles.recentCard}>
                    <div style={styles.recentName}>{nombre || 'Sin nombre'}</div>
                    <div style={styles.recentLine}>Doc (ID): {c.id}</div>
                    <div style={styles.recentLine}>Tipo: {c.tipoDoc || '--'}</div>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => onPickRecent(c.id)}
                        disabled={loading}
                        style={{ ...styles.btn, ...styles.btnMuted, ...(loading ? styles.btnDisabled : {}) }}
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
