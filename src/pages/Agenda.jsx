import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './Agenda.css';

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
  return d
    .toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

function normalize(v) {
  return String(v || '').toLowerCase().trim();
}

function badgeClass(estado) {
  const e = String(estado || '').toLowerCase().trim();
  if (e === 'activa') return 'badge badge--activa';
  if (e === 'en-espera') return 'badge badge--espera';
  if (e === 'llamado') return 'badge badge--llamado';
  if (e === 'atendido') return 'badge badge--atendido';
  if (e === 'cerrado') return 'badge badge--cerrado';
  if (e === 'cancelado') return 'badge badge--cancelado';
  if (e === 'completado') return 'badge badge--completado';
  return 'badge';
}

export default function Agenda() {
  const { currentUser } = useAuth();
  const rol = String(currentUser?.rol || '').toLowerCase().trim();

  const isAgent = rol === 'agente' || rol === 'agent';
  const isAdmin = rol === 'admin';

  const moduloAsignado = currentUser?.moduloAsignado ?? null;
  const habilidades = Array.isArray(currentUser?.habilidades)
    ? currentUser.habilidades.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const [tab, setTab] = useState('citas'); // 'citas' | 'turnos'
  const [monthsAhead, setMonthsAhead] = useState(2);
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [tramitesMap, setTramitesMap] = useState({});

  const [citasRaw, setCitasRaw] = useState([]);
  const [turnosRaw, setTurnosRaw] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const range = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addMonths(start, Number(monthsAhead) || 1);
    return { start, end };
  }, [monthsAhead]);

  // Tramites (solo para mapear IDs -> nombre)
  useEffect(() => {
    const qT = query(collection(db, 'tramites'));
    const unsub = onSnapshot(
      qT,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = data?.nombre || d.id;
        });
        setTramitesMap(map);
      },
      () => {
        // silencioso: no bloquea agenda si falla el mapa
      }
    );

    return () => unsub();
  }, []);

  // Importante para costos: escuchar solo la pestaña activa.
  useEffect(() => {
    setLoadError('');
    setLoading(true);

    if (tab === 'citas') {
      const qC = query(
        collection(db, 'citas'),
        where('fechaHora', '>=', Timestamp.fromDate(range.start)),
        where('fechaHora', '<', Timestamp.fromDate(range.end)),
        orderBy('fechaHora', 'asc')
      );

      const unsub = onSnapshot(
        qC,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setCitasRaw(list);
          setLoading(false);
        },
        (err) => {
          setLoadError('No se pudieron cargar las citas web.');
          console.error('Agenda citas onSnapshot error:', err);
          setLoading(false);
        }
      );

      return () => unsub();
    }

    if (tab === 'turnos') {
      const qT = query(
        collection(db, 'turnos'),
        where('fechaHoraGenerado', '>=', Timestamp.fromDate(range.start)),
        where('fechaHoraGenerado', '<', Timestamp.fromDate(range.end)),
        orderBy('fechaHoraGenerado', 'asc')
      );

      const unsub = onSnapshot(
        qT,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setTurnosRaw(list);
          setLoading(false);
        },
        (err) => {
          setLoadError('No se pudieron cargar los turnos de kiosko.');
          console.error('Agenda turnos onSnapshot error:', err);
          setLoading(false);
        }
      );

      return () => unsub();
    }

    setLoading(false);
    return undefined;
  }, [tab, range.start, range.end]);

  const currentRows = tab === 'citas' ? citasRaw : turnosRaw;

  const uniqueModules = useMemo(() => {
    const set = new Set();
    currentRows.forEach((x) => {
      if (x.moduloAsignado != null && x.moduloAsignado !== '') set.add(String(x.moduloAsignado));
      if (x.modulo != null && x.modulo !== '') set.add(String(x.modulo));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [currentRows]);

  const passesFilters = (item) => {
    // Restricciones por agente (módulo + habilidades)
    if (isAgent) {
      if (habilidades.length > 0) {
        if (!habilidades.includes(String(item.tramiteID || item.tramiteId || ''))) return false;
      }
      const mod = item.moduloAsignado ?? item.modulo;
      if (mod != null && mod !== '' && moduloAsignado != null) {
        if (String(mod) !== String(moduloAsignado)) return false;
      }
    }

    // Admin: filtro por módulo
    if (isAdmin && moduleFilter !== 'all') {
      const mod = item.moduloAsignado ?? item.modulo ?? '';
      if (String(mod) !== String(moduleFilter)) return false;
    }

    // Estado
    if (statusFilter !== 'all') {
      if (String(item.estado ?? '') !== statusFilter) return false;
    }

    // Búsqueda: codigo / dni / tramite
    if (search) {
      const s = normalize(search);
      const codigo = normalize(item.codigo || item.id);
      const dni = normalize(item.dni);
      const tramite = normalize(tramitesMap[item.tramiteID] || item.tramiteID || item.tramiteId);
      if (!codigo.includes(s) && !dni.includes(s) && !tramite.includes(s)) return false;
    }

    return true;
  };

  const rows = useMemo(() => currentRows.filter(passesFilters), [
    currentRows,
    tab,
    statusFilter,
    moduleFilter,
    search,
    rol,
    moduloAsignado,
    tramitesMap,
    habilidades,
  ]);

  const subtitle = useMemo(() => {
    const start = range.start.toLocaleDateString('es-CL');
    const end = range.end.toLocaleDateString('es-CL');
    return `Rango: ${start} → ${end}`;
  }, [range.start, range.end]);

  const clearFilters = () => {
    setStatusFilter('all');
    setModuleFilter('all');
    setSearch('');
  };

  return (
    <div className="agenda-page">
      <div className="agenda-header">
        <div>
          <h2 className="agenda-title">Agenda</h2>
          <p className="agenda-subtitle">{subtitle}</p>

          {isAgent && (
            <p className="agenda-hint">
              Vista restringida por agente{moduloAsignado ? ` (módulo ${moduloAsignado})` : ''}.
            </p>
          )}
        </div>

        <div className="agenda-headerActions">
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="agenda-card">
        <div className="agenda-controls">
          <div className="agenda-field">
            <label>Rango</label>
            <select value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))}>
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
            </select>
          </div>

          <div className="agenda-field">
            <label>Estado</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="activa">activa</option>
              <option value="en-espera">en-espera</option>
              <option value="llamado">llamado</option>
              <option value="atendido">atendido</option>
              <option value="completado">completado</option>
              <option value="cerrado">cerrado</option>
              <option value="cancelado">cancelado</option>
            </select>
          </div>

          {isAdmin && (
            <div className="agenda-field">
              <label>Módulo</label>
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                <option value="all">Todos</option>
                {uniqueModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="agenda-field agenda-field--search">
            <label>Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, DNI o trámite"
              inputMode="search"
            />
          </div>
        </div>

        <div className="agenda-tabs" role="tablist" aria-label="Tipo de atención">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'citas'}
            className={`agenda-tab ${tab === 'citas' ? 'agenda-tab--active' : ''}`}
            onClick={() => setTab('citas')}
          >
            Citas Web
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'turnos'}
            className={`agenda-tab ${tab === 'turnos' ? 'agenda-tab--active' : ''}`}
            onClick={() => setTab('turnos')}
          >
            Turnos Kiosko
          </button>
        </div>

        {loadError ? <div className="agenda-empty">{loadError}</div> : null}

        {!loadError && loading ? <div className="agenda-empty">Cargando…</div> : null}

        {!loadError && !loading && rows.length === 0 ? (
          <div className="agenda-empty">Sin resultados para los filtros actuales.</div>
        ) : null}

        {!loadError && !loading && rows.length > 0 ? (
          <div className="agenda-tableWrap">
            <table className="agenda-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Trámite</th>
                  <th>{tab === 'citas' ? 'Fecha' : 'Generado'}</th>
                  <th>Estado</th>
                  <th>Módulo</th>
                  <th>DNI</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((x) => {
                  const codigo = x.codigo || x.id;
                  const tramiteId = x.tramiteID || x.tramiteId;
                  const tramiteNombre = tramitesMap[tramiteId] || tramiteId || '—';
                  const mod = x.moduloAsignado ?? x.modulo ?? '—';
                  const fecha = tab === 'citas' ? fmtTs(x.fechaHora) : fmtTs(x.fechaHoraGenerado);

                  return (
                    <tr key={x.id}>
                      <td>
                        <strong>{codigo}</strong>
                      </td>
                      <td>{tramiteNombre}</td>
                      <td>{fecha}</td>
                      <td>
                        <span className={badgeClass(x.estado)}>{x.estado || '—'}</span>
                      </td>
                      <td>{mod}</td>
                      <td>{x.dni || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}