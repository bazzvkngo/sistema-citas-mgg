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
      minute: '2-digit'
    })
    .replace(',', '');
}

function statusClass(estado) {
  const e = String(estado || '').toLowerCase().trim();
  if (e === 'activa') return 'st st--activa';
  if (e === 'llamado') return 'st st--llamado';
  if (e === 'atendido') return 'st st--atendido';
  if (e === 'cerrado') return 'st st--cerrado';
  if (e === 'cancelado') return 'st st--cancelado';
  return 'st';
}

export default function Agenda() {
  const { currentUser } = useAuth();

  const rol = String(currentUser?.rol || '').toLowerCase().trim();
  const isAgent = rol === 'agente' || rol === 'agent';
  const isAdmin = rol === 'admin';

  const moduloAsignado = currentUser?.moduloAsignado ?? null;
  const habilidades = Array.isArray(currentUser?.habilidades)
    ? currentUser.habilidades.map((x) => String(x))
    : [];

  const [tab, setTab] = useState('citas'); // 'citas' | 'turnos'
  const [monthsAhead, setMonthsAhead] = useState(2);
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [tramitesMap, setTramitesMap] = useState({});
  const [citasRaw, setCitasRaw] = useState([]);
  const [turnosRaw, setTurnosRaw] = useState([]);

  const [loadingTramites, setLoadingTramites] = useState(true);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [loadingTurnos, setLoadingTurnos] = useState(true);

  const range = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addMonths(start, Number(monthsAhead) || 1);
    return { start, end };
  }, [monthsAhead]);

  useEffect(() => {
    setLoadingTramites(true);
    const qT = query(collection(db, 'tramites'));
    const unsub = onSnapshot(
      qT,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = data.nombre || d.id;
        });
        setTramitesMap(map);
        setLoadingTramites(false);
      },
      (err) => {
        console.error('Agenda: error tramites', err);
        setLoadingTramites(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoadingCitas(true);
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
        setLoadingCitas(false);
      },
      (err) => {
        console.error('Agenda: error citas', err);
        setLoadingCitas(false);
      }
    );

    return () => unsub();
  }, [range.start, range.end]);

  useEffect(() => {
    setLoadingTurnos(true);
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
        setLoadingTurnos(false);
      },
      (err) => {
        console.error('Agenda: error turnos', err);
        setLoadingTurnos(false);
      }
    );

    return () => unsub();
  }, [range.start, range.end]);

  const uniqueModules = useMemo(() => {
    const set = new Set();
    [...citasRaw, ...turnosRaw].forEach((x) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [citasRaw, statusFilter, moduleFilter, search, rol, moduloAsignado, tramitesMap, habilidades]
  );

  const turnos = useMemo(
    () => turnosRaw.filter(passesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turnosRaw, statusFilter, moduleFilter, search, rol, moduloAsignado, tramitesMap, habilidades]
  );

  const activeList = tab === 'citas' ? citas : turnos;
  const activeLoading = tab === 'citas' ? loadingCitas : loadingTurnos;

  const rangeLabel = useMemo(() => {
    const from = range.start.toLocaleDateString('es-CL');
    const to = range.end.toLocaleDateString('es-CL');
    return `${from} → ${to}`;
  }, [range.start, range.end]);

  const totalCitas = citas.length;
  const totalTurnos = turnos.length;

  const counts = useMemo(() => {
    const c = { activa: 0, llamado: 0, atendido: 0, cerrado: 0, cancelado: 0, other: 0 };
    for (const x of activeList) {
      const e = String(x.estado || '').toLowerCase().trim();
      if (c[e] != null) c[e] += 1;
      else c.other += 1;
    }
    return c;
  }, [activeList]);

  const clearSearch = () => setSearch('');

  return (
    <div className="agenda-page">
      <div className="agenda-header">
        <div>
          <h1 className="agenda-title">Agenda</h1>
          <p className="agenda-subtitle">
            Consulta citas web y turnos kiosko por rango, estado y búsqueda.
          </p>
        </div>

        <div className="agenda-headerMeta">
          <span className="chip chip--soft">Rango: {rangeLabel}</span>
          {isAgent && moduloAsignado != null ? (
            <span className="chip chip--soft">Módulo: {String(moduloAsignado)}</span>
          ) : null}
          {isAgent && habilidades.length > 0 ? (
            <span className="chip chip--soft">Habilidades: {habilidades.length}</span>
          ) : null}
        </div>
      </div>

      <div className="agenda-card">
        <div className="agenda-filters">
          <div className="f">
            <label>Rango</label>
            <select value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))}>
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
            </select>
          </div>

          <div className="f">
            <label>Estado</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="activa">activa</option>
              <option value="llamado">llamado</option>
              <option value="atendido">atendido</option>
              <option value="cerrado">cerrado</option>
              <option value="cancelado">cancelado</option>
            </select>
          </div>

          {isAdmin ? (
            <div className="f">
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
          ) : null}

          <div className="f f--search">
            <label>Buscar</label>
            <div className="searchWrap">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código, DNI o trámite"
                aria-label="Buscar por código, DNI o trámite"
              />
              {search ? (
                <button type="button" className="clearBtn" onClick={clearSearch} aria-label="Limpiar búsqueda">
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="agenda-tabs" role="tablist" aria-label="Agenda tabs">
          <button
            type="button"
            className={`tab ${tab === 'citas' ? 'tab--active' : ''}`}
            onClick={() => setTab('citas')}
            role="tab"
            aria-selected={tab === 'citas'}
          >
            Citas Web <span className="tabCount">{loadingCitas ? '…' : totalCitas}</span>
          </button>

          <button
            type="button"
            className={`tab ${tab === 'turnos' ? 'tab--active' : ''}`}
            onClick={() => setTab('turnos')}
            role="tab"
            aria-selected={tab === 'turnos'}
          >
            Turnos Kiosko <span className="tabCount">{loadingTurnos ? '…' : totalTurnos}</span>
          </button>
        </div>

        <div className="agenda-stats">
          <div className="statsLeft">
            <span className="chip">Resultados: {activeLoading ? '…' : activeList.length}</span>
            {loadingTramites ? <span className="chip chip--soft">Cargando trámites…</span> : null}
          </div>

          <div className="statsRight">
            {counts.activa ? <span className="st st--activa">activa {counts.activa}</span> : null}
            {counts.llamado ? <span className="st st--llamado">llamado {counts.llamado}</span> : null}
            {counts.atendido ? <span className="st st--atendido">atendido {counts.atendido}</span> : null}
            {counts.cerrado ? <span className="st st--cerrado">cerrado {counts.cerrado}</span> : null}
            {counts.cancelado ? <span className="st st--cancelado">cancelado {counts.cancelado}</span> : null}
          </div>
        </div>

        {activeLoading ? (
          <div className="empty">Cargando…</div>
        ) : activeList.length === 0 ? (
          <div className="empty">Sin resultados. Ajusta rango, estado o búsqueda.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="tableWrap desktopOnly">
              {tab === 'citas' ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Trámite</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Módulo</th>
                      <th>DNI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((c) => (
                      <tr key={c.id}>
                        <td className="mono strong">{c.codigo || c.id}</td>
                        <td>{tramitesMap[c.tramiteID] || c.tramiteID || '—'}</td>
                        <td className="mono">{fmtTs(c.fechaHora)}</td>
                        <td>
                          <span className={statusClass(c.estado)}>{c.estado || '—'}</span>
                        </td>
                        <td className="mono">{c.moduloAsignado ?? '—'}</td>
                        <td className="mono">{c.dni || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Trámite</th>
                      <th>Generado</th>
                      <th>Estado</th>
                      <th>Módulo</th>
                      <th>DNI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnos.map((t) => (
                      <tr key={t.id}>
                        <td className="mono strong">{t.codigo || t.id}</td>
                        <td>{tramitesMap[t.tramiteID] || t.tramiteID || '—'}</td>
                        <td className="mono">{fmtTs(t.fechaHoraGenerado)}</td>
                        <td>
                          <span className={statusClass(t.estado)}>{t.estado || '—'}</span>
                        </td>
                        <td className="mono">{t.moduloAsignado ?? '—'}</td>
                        <td className="mono">{t.dni || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile cards */}
            <div className="cards mobileOnly">
              {activeList.map((x) => {
                const isCita = tab === 'citas';
                const codigo = x.codigo || x.id;
                const tramite = tramitesMap[x.tramiteID] || x.tramiteID || '—';
                const fecha = isCita ? fmtTs(x.fechaHora) : fmtTs(x.fechaHoraGenerado);
                const mod = x.moduloAsignado ?? '—';
                const dni = x.dni || '—';

                return (
                  <div key={x.id} className="cardRow">
                    <div className="cardTop">
                      <div className="mono strong">{codigo}</div>
                      <span className={statusClass(x.estado)}>{x.estado || '—'}</span>
                    </div>
                    <div className="cardMain">{tramite}</div>
                    <div className="cardMeta">
                      <div><span className="muted">{isCita ? 'Fecha' : 'Generado'}:</span> <span className="mono">{fecha}</span></div>
                      <div><span className="muted">Módulo:</span> <span className="mono">{mod}</span></div>
                      <div><span className="muted">DNI:</span> <span className="mono">{dni}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}