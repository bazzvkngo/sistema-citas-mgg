import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const styles = {
  container: { padding: 20, maxWidth: 1200, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, margin: '6px 0 12px 0' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 14 },
  row: { display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 800 },
  select: { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 160 },
  input: { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 220 },
  tabs: { display: 'flex', gap: 8, marginTop: 14 },
  tab: (active) => ({
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#111827',
    fontWeight: 800
  }),
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 12 },
  th: { textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  td: { padding: 10, borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  empty: { padding: 12, border: '1px dashed #d1d5db', borderRadius: 10, marginTop: 12, background: '#fafafa' },
  badge: { padding: '4px 8px', borderRadius: 999, background: '#e5e7eb', fontWeight: 800, fontSize: 12, display: 'inline-block' }
};

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addMonths(d, months) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

function fmtTs(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
}

export default function Agenda() {
  const { currentUser } = useAuth();

  const rol = String(currentUser?.rol || '').toLowerCase().trim();
  const isAgent = rol === 'agente' || rol === 'agent';
  const isAdmin = rol === 'admin';

  const moduloAsignado = currentUser?.moduloAsignado ?? null;
  const habilidades = Array.isArray(currentUser?.habilidades)
    ? currentUser.habilidades.map(x => String(x))
    : [];

  const [tab, setTab] = useState('citas');
  const [monthsAhead, setMonthsAhead] = useState(2);
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [tramitesMap, setTramitesMap] = useState({});
  const [citasRaw, setCitasRaw] = useState([]);
  const [turnosRaw, setTurnosRaw] = useState([]);

  const range = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addMonths(start, Number(monthsAhead) || 1);
    return { start, end };
  }, [monthsAhead]);

  useEffect(() => {
    const qT = query(collection(db, 'tramites'));
    const unsub = onSnapshot(qT, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = data.nombre || d.id;
      });
      setTramitesMap(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const qC = query(
      collection(db, 'citas'),
      where('fechaHora', '>=', Timestamp.fromDate(range.start)),
      where('fechaHora', '<', Timestamp.fromDate(range.end)),
      orderBy('fechaHora', 'asc')
    );

    const unsub = onSnapshot(qC, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCitasRaw(list);
    });

    return () => unsub();
  }, [range.start, range.end]);

  useEffect(() => {
    const qT = query(
      collection(db, 'turnos'),
      where('fechaHoraGenerado', '>=', Timestamp.fromDate(range.start)),
      where('fechaHoraGenerado', '<', Timestamp.fromDate(range.end)),
      orderBy('fechaHoraGenerado', 'asc')
    );

    const unsub = onSnapshot(qT, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTurnosRaw(list);
    });

    return () => unsub();
  }, [range.start, range.end]);

  const uniqueModules = useMemo(() => {
    const set = new Set();
    [...citasRaw, ...turnosRaw].forEach(x => {
      if (x.moduloAsignado != null && x.moduloAsignado !== '') set.add(String(x.moduloAsignado));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [citasRaw, turnosRaw]);

  const normalize = (v) => String(v || '').toLowerCase().trim();

  const passesFilters = (item) => {
    if (isAgent) {
      if (habilidades.length > 0) {
        if (!habilidades.includes(String(item.tramiteID))) return false;
      }

      const mod = item.moduloAsignado;
      if (mod != null && mod !== '' && moduloAsignado != null) {
        if (String(mod) !== String(moduloAsignado)) return false;
      }
    }

    if (isAdmin && moduleFilter !== 'all') {
      if (String(item.moduloAsignado ?? '') !== String(moduleFilter)) return false;
    }

    if (statusFilter !== 'all') {
      if (String(item.estado ?? '') !== statusFilter) return false;
    }

    if (search) {
      const s = normalize(search);
      const codigo = normalize(item.codigo || item.id);
      const dni = normalize(item.dni);
      const tramite = normalize(tramitesMap[item.tramiteID] || item.tramiteID);
      if (!codigo.includes(s) && !dni.includes(s) && !tramite.includes(s)) return false;
    }

    return true;
  };

  const citas = useMemo(
    () => citasRaw.filter(passesFilters),
    [citasRaw, statusFilter, moduleFilter, search, rol, moduloAsignado, tramitesMap, habilidades]
  );

  const turnos = useMemo(
    () => turnosRaw.filter(passesFilters),
    [turnosRaw, statusFilter, moduleFilter, search, rol, moduloAsignado, tramitesMap, habilidades]
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Agenda</h2>

      <div style={styles.card}>
        <div style={styles.row}>
          <div style={styles.field}>
            <div style={styles.label}>Rango</div>
            <select value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))} style={styles.select}>
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
            </select>
          </div>

          <div style={styles.field}>
            <div style={styles.label}>Estado</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
              <option value="all">Todos</option>
              <option value="activa">activa</option>
              <option value="llamado">llamado</option>
              <option value="atendido">atendido</option>
              <option value="cerrado">cerrado</option>
              <option value="cancelado">cancelado</option>
            </select>
          </div>

          {isAdmin && (
            <div style={styles.field}>
              <div style={styles.label}>Módulo</div>
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={styles.select}>
                <option value="all">Todos</option>
                {uniqueModules.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.field}>
            <div style={styles.label}>Buscar</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
              placeholder="Código, DNI o trámite"
            />
          </div>
        </div>

        <div style={styles.tabs}>
          <button type="button" style={styles.tab(tab === 'citas')} onClick={() => setTab('citas')}>
            Citas Web
          </button>
          <button type="button" style={styles.tab(tab === 'turnos')} onClick={() => setTab('turnos')}>
            Turnos Kiosko
          </button>
        </div>

        {tab === 'citas' ? (
          citas.length === 0 ? (
            <div style={styles.empty}>Sin resultados.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Trámite</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Módulo</th>
                  <th style={styles.th}>DNI</th>
                </tr>
              </thead>
              <tbody>
                {citas.map(c => (
                  <tr key={c.id}>
                    <td style={styles.td}><strong>{c.codigo || c.id}</strong></td>
                    <td style={styles.td}>{tramitesMap[c.tramiteID] || c.tramiteID || '—'}</td>
                    <td style={styles.td}>{fmtTs(c.fechaHora)}</td>
                    <td style={styles.td}><span style={styles.badge}>{c.estado || '—'}</span></td>
                    <td style={styles.td}>{c.moduloAsignado ?? '—'}</td>
                    <td style={styles.td}>{c.dni || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          turnos.length === 0 ? (
            <div style={styles.empty}>Sin resultados.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Trámite</th>
                  <th style={styles.th}>Generado</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Módulo</th>
                  <th style={styles.th}>DNI</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map(t => (
                  <tr key={t.id}>
                    <td style={styles.td}><strong>{t.codigo || t.id}</strong></td>
                    <td style={styles.td}>{tramitesMap[t.tramiteID] || t.tramiteID || '—'}</td>
                    <td style={styles.td}>{fmtTs(t.fechaHoraGenerado)}</td>
                    <td style={styles.td}><span style={styles.badge}>{t.estado || '—'}</span></td>
                    <td style={styles.td}>{t.moduloAsignado ?? '—'}</td>
                    <td style={styles.td}>{t.dni || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
