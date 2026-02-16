import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';

const styles = {
  wrap: { padding: 10 },
  title: { margin: '0 0 12px', fontSize: 18, fontWeight: 900 },
  filters: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 10,
    marginBottom: 12
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #ddd',
    outline: 'none'
  },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { textAlign: 'left', padding: 10, background: '#f3f3f3', borderBottom: '1px solid #ddd', fontSize: 12 },
  td: { padding: 10, borderBottom: '1px solid #eee', fontSize: 13, verticalAlign: 'top' },
  btn: {
    padding: '8px 10px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 800,
    marginRight: 8
  },
  btnPrimary: { background: '#0d6efd', color: '#fff' },
  btnWarn: { background: '#ffc107', color: '#333' },
  btnDanger: { background: '#dc3545', color: '#fff' },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid #ddd',
    fontWeight: 800,
    fontSize: 12
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9999
  },
  modal: { width: 'min(720px, 100%)', background: '#fff', borderRadius: 14, padding: 16 },
  modalTitle: { margin: '0 0 10px', fontSize: 16, fontWeight: 900 },
  modalRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  textarea: {
    width: '100%',
    minHeight: 90,
    padding: 10,
    borderRadius: 10,
    border: '1px solid #ddd',
    resize: 'vertical'
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toInputDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTs(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export default function AdminClosedAppointments() {
  const [tramites, setTramites] = useState([]);
  const [rows, setRows] = useState([]);

  const [dateISO, setDateISO] = useState(() => toInputDate(new Date()));
  const [search, setSearch] = useState('');
  const [tramiteID, setTramiteID] = useState('');

  const [selected, setSelected] = useState(null);
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'tramites'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTramites(list);
    })();
  }, []);

  useEffect(() => {
    const day = new Date(dateISO + 'T00:00:00');
    const from = Timestamp.fromDate(startOfDay(day));
    const to = Timestamp.fromDate(endOfDay(day));

    // Cerradas reales del día: estado completado + fechaHoraAtencionFin dentro del día
    const qC = query(
      collection(db, 'citas'),
      where('estado', '==', 'completado'),
      where('fechaHoraAtencionFin', '>=', from),
      where('fechaHoraAtencionFin', '<=', to),
      orderBy('fechaHoraAtencionFin', 'desc'),
      limit(300)
    );

    const unsub = onSnapshot(qC, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(list);
    });

    return () => unsub();
  }, [dateISO]);

  const tramiteName = useMemo(() => {
    const map = {};
    tramites.forEach(t => { map[t.id] = t.nombre || t.id; });
    return map;
  }, [tramites]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows
      .filter(r => (tramiteID ? r.tramiteID === tramiteID : true))
      .filter(r => {
        if (!s) return true;
        const hay =
          String(r.codigo || '').toLowerCase().includes(s) ||
          String(r.dni || '').toLowerCase().includes(s) ||
          String(r.userNombre || '').toLowerCase().includes(s) ||
          String(r.nombre || '').toLowerCase().includes(s) ||
          String(r.apellido || '').toLowerCase().includes(s);
        return hay;
      });
  }, [rows, tramiteID, search]);

  const openEdit = (r) => {
    setSelected(r);
    setEditObs(String(r.observacion || r.obs || r.comentariosAgente || ''));
  };

  const closeModal = () => {
    setSelected(null);
    setEditObs('');
  };

  const handleSave = async () => {
    if (!selected) return;

    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'adminUpdateClosedCita');
      await fn({
        citaId: selected.id,
        observacion: editObs
      });
      closeModal();
      alert('Guardado.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error guardando.');
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async (r) => {
    const ok = window.confirm(`Reabrir la cita ${r.codigo || r.id} y dejarla ACTIVA?`);
    if (!ok) return;

    try {
      const fn = httpsCallable(functions, 'adminReopenCita');
      await fn({ citaId: r.id });
      alert('Cita reabierta.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error reabriendo.');
    }
  };

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>Citas Cerradas / Concluidas</h3>

      <div style={styles.filters}>
        <input
          style={styles.input}
          type="date"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
        />

        <select style={styles.input} value={tramiteID} onChange={(e) => setTramiteID(e.target.value)}>
          <option value="">Todos los trámites</option>
          {tramites.map(t => (
            <option key={t.id} value={t.id}>{t.nombre || t.id}</option>
          ))}
        </select>

        <input style={{ ...styles.input, visibility: 'hidden' }} readOnly />

        <input
          style={styles.input}
          placeholder="Buscar por código, DNI, nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Código</th>
            <th style={styles.th}>Trámite</th>
            <th style={styles.th}>Fecha Programada</th>
            <th style={styles.th}>Fecha Cierre</th>
            <th style={styles.th}>DNI</th>
            <th style={styles.th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              <td style={styles.td}><strong>{r.codigo || r.id}</strong></td>
              <td style={styles.td}>{tramiteName[r.tramiteID] || r.tramiteID || '—'}</td>
              <td style={styles.td}>{fmtTs(r.fechaHora)}</td>
              <td style={styles.td}>{fmtTs(r.fechaHoraAtencionFin)}</td>
              <td style={styles.td}>{r.dni || '—'}</td>
              <td style={styles.td}>
                <button style={{ ...styles.btn, ...styles.btnWarn }} onClick={() => openEdit(r)}>
                  Editar
                </button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => handleReopen(r)}>
                  Reabrir
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td style={styles.td} colSpan={6}>No hay citas cerradas para los filtros seleccionados.</td>
            </tr>
          )}
        </tbody>
      </table>

      {selected && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>Editar cita cerrada: {selected.codigo || selected.id}</h4>

            <div style={styles.modalRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Estado</div>
                <input style={styles.input} value={String(selected.estado || '')} disabled />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Trámite</div>
                <input
                  style={styles.input}
                  value={tramiteName[selected.tramiteID] || selected.tramiteID || ''}
                  disabled
                />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Observación</div>
            <textarea
              style={styles.textarea}
              value={editObs}
              onChange={(e) => setEditObs(e.target.value)}
            />

            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnDanger }}
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
