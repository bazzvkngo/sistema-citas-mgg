// src/pages/CitizenProfile.jsx
import React, { useMemo, useState } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const styles = {
  wrap: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
    border: '1px solid #eee'
  },
  h2: { margin: 0, color: '#C8102E', fontWeight: 900, fontSize: 22 },
  label: { fontSize: 12, fontWeight: 800, color: '#333', marginTop: 12 },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #ddd',
    outline: 'none',
    marginTop: 6,
    fontWeight: 700
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  btn: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 900,
    cursor: 'pointer'
  },
  btnSearch: { background: '#6c757d', color: '#fff' },
  btnSave: { background: '#0d6efd', color: '#fff' },
  btnClear: { background: '#f3f4f6', color: '#111', border: '1px solid #e5e7eb' },
  btnDelete: { background: '#dc3545', color: '#fff' },

  statusBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#fafafa',
    fontSize: 12,
    fontWeight: 700,
    color: '#333',
    whiteSpace: 'pre-wrap'
  },
  rightTitle: { margin: 0, fontWeight: 900, fontSize: 18, color: '#111' },
  recentItem: {
    border: '1px solid #eee',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    cursor: 'pointer',
    background: '#fff'
  }
};

function normalizeId(v) {
  return String(v || '').trim();
}

export default function CitizenProfile() {
  const [docId, setDocId] = useState('');
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [status, setStatus] = useState({
    exists: false,
    lastId: '',
    lastName: '',
    message: 'Ingresa un DNI/RUT y presiona Buscar.'
  });

  const [recent, setRecent] = useState([]);

  const computedFullName = useMemo(() => {
    const full = (nombreCompleto || '').trim();
    if (full) return full;
    const nn = (nombres || '').trim();
    const aa = (apellidos || '').trim();
    const built = `${nn} ${aa}`.trim();
    return built || '';
  }, [nombreCompleto, nombres, apellidos]);

  const limpiar = () => {
    setDocId('');
    setTipoDoc('DNI');
    setNombres('');
    setApellidos('');
    setNombreCompleto('');
    setTelefono('');
    setEmail('');
    setStatus({
      exists: false,
      lastId: '',
      lastName: '',
      message: 'Limpio. Ingresa un DNI/RUT y presiona Buscar.'
    });
  };

  const pushRecent = (id, name) => {
    if (!id) return;
    setRecent((prev) => {
      const next = [{ id, name }, ...prev.filter(x => x.id !== id)];
      return next.slice(0, 10);
    });
  };

  const buscar = async () => {
    const id = normalizeId(docId);
    if (!id) {
      setStatus(s => ({ ...s, message: 'Debes ingresar un DNI/RUT.' }));
      return;
    }

    try {
      const ref = doc(db, 'ciudadanos', id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setStatus({
          exists: false,
          lastId: id,
          lastName: '',
          message: `No existe. Puedes crear el perfil y guardar.`
        });
        return;
      }

      const data = snap.data();
      setTipoDoc(data.tipoDoc || 'DNI');
      setNombres(data.nombres || '');
      setApellidos(data.apellidos || '');
      setNombreCompleto(data.nombreCompleto || '');
      setTelefono(data.telefono || '');
      setEmail(data.email || '');

      const finalName = (data.nombreCompleto || `${data.nombres || ''} ${data.apellidos || ''}`.trim()).trim();

      setStatus({
        exists: true,
        lastId: id,
        lastName: finalName || '',
        message: `Encontrado. Puedes editar y guardar.`
      });

      pushRecent(id, finalName);
    } catch (e) {
      console.error('Error buscando ciudadano:', e);
      setStatus(s => ({ ...s, message: 'Error buscando ciudadano. Revisa consola.' }));
    }
  };

  const guardar = async () => {
    const id = normalizeId(docId);
    if (!id) {
      setStatus(s => ({ ...s, message: 'Debes ingresar un DNI/RUT.' }));
      return;
    }

    try {
      const payload = {
        tipoDoc: tipoDoc || 'DNI',
        docId: id,
        nombres: (nombres || '').trim(),
        apellidos: (apellidos || '').trim(),
        nombreCompleto: (computedFullName || '').trim(),
        telefono: (telefono || '').trim(),
        email: (email || '').trim(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'ciudadanos', id), payload, { merge: true });

      setStatus({
        exists: true,
        lastId: id,
        lastName: payload.nombreCompleto,
        message: `Guardado correctamente.`
      });

      pushRecent(id, payload.nombreCompleto);
    } catch (e) {
      console.error('Error guardando ciudadano:', e);
      setStatus(s => ({ ...s, message: 'Error guardando. Revisa consola.' }));
    }
  };

  const eliminar = async () => {
    const id = normalizeId(docId);
    if (!id) return;

    const ok = window.confirm(`Eliminar perfil del ciudadano ${id}?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'ciudadanos', id));
      setStatus({
        exists: false,
        lastId: id,
        lastName: '',
        message: `Eliminado.`
      });
    } catch (e) {
      console.error('Error eliminando ciudadano:', e);
      setStatus(s => ({ ...s, message: 'Error eliminando. Revisa consola.' }));
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Perfil de Ciudadano</h2>

        <div style={styles.row2}>
          <div>
            <div style={styles.label}>DNI/RUT (ID del documento)</div>
            <input
              style={styles.input}
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="Ej: 12345678-9"
            />
          </div>

          <div>
            <div style={styles.label}>Tipo Documento</div>
            <select style={styles.input} value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
              <option value="DNI">DNI</option>
              <option value="RUT">RUT</option>
              <option value="PASAPORTE">PASAPORTE</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>
        </div>

        <div style={styles.actions}>
          <button style={{ ...styles.btn, ...styles.btnSearch }} onClick={buscar}>Buscar</button>
          <button style={{ ...styles.btn, ...styles.btnSave }} onClick={guardar}>Guardar</button>
          <button style={{ ...styles.btn, ...styles.btnClear }} onClick={limpiar}>Limpiar</button>
          <button style={{ ...styles.btn, ...styles.btnDelete }} onClick={eliminar}>Eliminar</button>
        </div>

        <div style={styles.row2}>
          <div>
            <div style={styles.label}>Nombres</div>
            <input
              style={styles.input}
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Ej: Juan Carlos"
            />
          </div>
          <div>
            <div style={styles.label}>Apellidos</div>
            <input
              style={styles.input}
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="Ej: Pérez Gómez"
            />
          </div>
        </div>

        <div>
          <div style={styles.label}>Nombre completo (opcional)</div>
          <input
            style={styles.input}
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            placeholder="Si se deja vacío, se arma con Nombres + Apellidos"
          />
        </div>

        <div style={styles.row2}>
          <div>
            <div style={styles.label}>Teléfono (opcional)</div>
            <input
              style={styles.input}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: +56 9 1234 5678"
            />
          </div>
          <div>
            <div style={styles.label}>Email (opcional)</div>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej: correo@dominio.com"
            />
          </div>
        </div>

        <div style={styles.statusBox}>
          {`Estado: ${status.exists ? 'Existe' : 'No existe'}
Último cargado: ${status.lastId || '-'}
Nombre final: ${status.lastName || '-'}
Mensaje: ${status.message}`}
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={styles.rightTitle}>Recientes</h3>
        </div>

        {recent.length === 0 ? (
          <div style={{ marginTop: 10, color: '#666', fontWeight: 700, fontSize: 13 }}>
            Sin registros recientes.
          </div>
        ) : (
          recent.map((r) => (
            <div
              key={r.id}
              style={styles.recentItem}
              onClick={() => {
                setDocId(r.id);
                setStatus(s => ({ ...s, message: 'Seleccionado desde recientes. Presiona Buscar.' }));
              }}
              title="Cargar este ID"
            >
              <div style={{ fontWeight: 900 }}>{r.id}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4, fontWeight: 700 }}>
                {r.name || '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
