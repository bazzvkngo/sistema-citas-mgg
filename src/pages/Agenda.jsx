import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './Agenda.css';

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addMonths(d, months) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
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

function resolveAgendaStatus(item) {
  const estado = normalize(item?.estado);
  if (estado === 'activa' || estado === 'en-espera') return 'por-atender';
  if (estado === 'llamado') return 'llamado';
  return '';
}

function agendaBadgeClass(agendaStatus) {
  const value = normalize(agendaStatus);
  if (value === 'por-atender') return 'badge badge--espera';
  if (value === 'llamado') return 'badge badge--llamado';
  return 'badge';
}

function formatAgendaStatus(agendaStatus) {
  const value = normalize(agendaStatus);
  if (value === 'por-atender') return 'Por atender';
  if (value === 'llamado') return 'Llamado';
  return '—';
}

const SUCCESS_CLASSIFICATIONS = new Set([
  'atendido_ok',
  'atendido',
  'tramite_ok',
  'consulta_resuelta',
  'entrega_ok',
  'otro',
]);

const PENDING_CLASSIFICATIONS = new Set([
  'fallo_accion',
  'rechazado',
  'faltan_documentos',
  'derivado_interno',
  'sin_clasificar',
]);

const FAILED_CLASSIFICATIONS = new Set([
  'no_se_presento',
]);

function resolveRecordStatus(item) {
  const clasificacion = normalize(item?.clasificacion);
  const cierreMotivo = normalize(item?.cierreMotivo || item?.cerradoMotivo || item?.motivo);
  const estado = normalize(item?.estado);
  const hasClosedAt = !!item?.fechaHoraAtencionFin;

  if (
    FAILED_CLASSIFICATIONS.has(clasificacion) ||
    estado === 'cancelado' ||
    estado === 'expirado' ||
    cierreMotivo === 'ausencia' ||
    cierreMotivo === 'abandono'
  ) {
    return 'fallido';
  }

  if (SUCCESS_CLASSIFICATIONS.has(clasificacion)) return 'exitoso';
  if (PENDING_CLASSIFICATIONS.has(clasificacion)) return 'pendiente';

  if (hasClosedAt && (estado === 'completado' || estado === 'cerrado')) {
    return 'pendiente';
  }

  return 'pendiente';
}

function recordBadgeClass(primaryStatus) {
  const value = normalize(primaryStatus);
  if (value === 'exitoso') return 'badge badge--exitoso';
  if (value === 'pendiente') return 'badge badge--pendiente';
  if (value === 'fallido') return 'badge badge--fallido';
  return 'badge';
}

function formatRecordStatus(primaryStatus) {
  const value = normalize(primaryStatus);
  if (value === 'exitoso') return 'Exitoso';
  if (value === 'pendiente') return 'Pendiente';
  if (value === 'fallido') return 'Fallido';
  return '—';
}

function getRecordAgentId(item) {
  return String(item?.agenteID || item?.agenteId || item?.agenteUid || item?.cerradoPor || '').trim();
}

function getRecordModule(item) {
  return item?.moduloAsignado ?? item?.modulo ?? '—';
}

function getRecordTramiteId(item) {
  return item?.tramiteID || item?.tramiteId || '';
}

function getRecordDate(item, viewMode, tab) {
  if (viewMode === 'registro') return fmtTs(item?.fechaHoraAtencionFin);
  return tab === 'citas' ? fmtTs(item?.fechaHora) : fmtTs(item?.fechaHoraGenerado);
}

function buildHistoryRange(key) {
  const today = new Date();
  const end = endOfDay(today);

  if (key === 'today') {
    return { start: startOfDay(today), end };
  }

  if (key === '30d') {
    return { start: startOfDay(addDays(today, -29)), end };
  }

  if (key === '90d') {
    return { start: startOfDay(addDays(today, -89)), end };
  }

  return { start: startOfDay(addDays(today, -6)), end };
}

function formatShortDate(dateObj) {
  return dateObj.toLocaleDateString('es-CL');
}

function formatTextValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text || '—';
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getRecordSourceDate(item, sourceTab) {
  return sourceTab === 'citas' ? fmtTs(item?.fechaHora) : fmtTs(item?.fechaHoraGenerado);
}

function getRecordRawStatus(item) {
  return formatTextValue(item?.estado);
}

function getRecordClassification(item) {
  return formatTextValue(item?.clasificacion);
}

function getRecordCloseReason(item) {
  return formatTextValue(item?.cierreMotivo || item?.cerradoMotivo || item?.motivo);
}

function getRecordAgentComments(item) {
  return formatTextValue(
    item?.comentariosAgente || item?.comentarioAgente || item?.comentarios || item?.comentario
  );
}

function getRecordObservation(item) {
  return formatTextValue(item?.observacion || item?.observaciones);
}

function getRecordClosedBy(item) {
  return formatTextValue(item?.cerradoPor || item?.agenteNombre || item?.agenteID || item?.agenteId || item?.agenteUid);
}

function buildRecordDetailRows(record, tramitesMap) {
  const sourceTab = record?.__sourceTab || 'citas';
  const tramiteId = getRecordTramiteId(record);
  const tramiteNombre = tramitesMap[tramiteId] || tramiteId || '—';

  return [
    ['Resultado final', formatRecordStatus(record?.primaryStatus)],
    ['Estado original', getRecordRawStatus(record)],
    ['Clasificación', getRecordClassification(record)],
    ['Motivo de cierre', getRecordCloseReason(record)],
    ['Comentarios del agente', getRecordAgentComments(record)],
    ['Observación', getRecordObservation(record)],
    ['Código', formatTextValue(record?.codigo || record?.id)],
    ['Trámite', formatTextValue(tramiteNombre)],
    ['Fecha / hora', getRecordSourceDate(record, sourceTab)],
    ['Módulo', formatTextValue(getRecordModule(record))],
    ['DNI', formatTextValue(record?.dni || record?.dniCiudadano)],
    ['Agente / cerrado por', getRecordClosedBy(record)],
    ['FechaHoraAtencionFin', fmtTs(record?.fechaHoraAtencionFin)],
  ];
}

function hasUsefulDetailValue(value) {
  const text = String(value ?? '').trim();
  return Boolean(text && text !== '—' && text !== 'â€”');
}

function buildModalDetailSections(record, tramitesMap) {
  if (!record) {
    return {
      summaryItems: [],
      contextItems: [],
      secondaryItems: [],
    };
  }

  const sourceTab = record.__sourceTab || 'citas';
  const tramiteId = getRecordTramiteId(record);
  const tramiteNombre = formatTextValue(tramitesMap[tramiteId] || tramiteId);
  const closeReason = getRecordCloseReason(record);
  const classification = getRecordClassification(record);
  const comments = getRecordAgentComments(record);
  const preferredClosureLabel = hasUsefulDetailValue(closeReason) ? 'Motivo de cierre' : 'Clasificación';
  const preferredClosureValue = hasUsefulDetailValue(closeReason) ? closeReason : classification;
  const closeDate = fmtTs(record?.fechaHoraAtencionFin);
  const fallbackDate = getRecordSourceDate(record, sourceTab);
  const primaryDate = hasUsefulDetailValue(closeDate) ? closeDate : fallbackDate;

  const summaryItems = [
    ['Resultado final', formatRecordStatus(record.primaryStatus)],
    ['Trámite', tramiteNombre],
    ['Código', formatTextValue(record.codigo || record.id)],
    ['Fecha y hora', primaryDate],
    ['DNI', formatTextValue(record.dni || record.dniCiudadano)],
  ].filter(([, value]) => hasUsefulDetailValue(value));

  const contextItems = [
    [preferredClosureLabel, preferredClosureValue],
    ['Comentarios del agente', comments],
  ].filter(([, value]) => hasUsefulDetailValue(value));

  const secondaryItems = [
    ['Estado original', getRecordRawStatus(record)],
    ['Módulo', formatTextValue(getRecordModule(record))],
    ['Agente / cerrado por', getRecordClosedBy(record)],
    ['Observación', getRecordObservation(record)],
  ].filter(([, value]) => hasUsefulDetailValue(value));

  return {
    summaryItems,
    contextItems,
    secondaryItems,
  };
}

function buildPrintableHTML({ title, subtitle, rows, resultLabel }) {
  const tableRows = rows
    .map(([label, value]) => `<tr><th>${escapeHTML(label)}</th><td>${escapeHTML(value)}</td></tr>`)
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHTML(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
          h1 { margin: 0 0 6px 0; font-size: 22px; color: #C8102E; }
          .sub { margin: 0 0 16px 0; font-size: 12px; color: #475569; font-weight: 700; }
          .badge { display: inline-block; margin-bottom: 14px; padding: 7px 12px; border-radius: 999px; background: #f8fafc; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 900; }
          .section { border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; vertical-align: top; }
          th { width: 220px; color: #475569; font-weight: 900; }
          .actions { display: flex; justify-content: flex-end; margin-bottom: 12px; }
          button { border: 1px solid #cbd5e1; background: #fff; border-radius: 10px; padding: 10px 12px; font-weight: 900; cursor: pointer; }
          @media print { .actions { display: none; } body { margin: 12px; } }
        </style>
      </head>
      <body>
        <div class="actions">
          <button onclick="window.print()">Imprimir</button>
        </div>
        <h1>${escapeHTML(title)}</h1>
        <p class="sub">${escapeHTML(subtitle || '')}</p>
        <div class="badge">Resultado: ${escapeHTML(resultLabel)}</div>
        <div class="section">
          <table>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

export default function Agenda() {
  const { currentUser } = useAuth();
  const rol = String(currentUser?.rol || '').toLowerCase().trim();

  const isAgent = rol === 'agente' || rol === 'agent';
  const isAdmin = rol === 'admin';

  const moduloAsignado = currentUser?.moduloAsignado ?? null;
  const habilidades = useMemo(() => (
    Array.isArray(currentUser?.habilidades)
      ? currentUser.habilidades.map((x) => String(x || '').trim()).filter(Boolean)
      : []
  ), [currentUser?.habilidades]);

  const [viewMode, setViewMode] = useState('agenda');
  const [tab, setTab] = useState('citas');
  const [monthsAhead, setMonthsAhead] = useState(2);
  const [historyRangeKey, setHistoryRangeKey] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [tramitesMap, setTramitesMap] = useState({});

  const [citasRaw, setCitasRaw] = useState([]);
  const [turnosRaw, setTurnosRaw] = useState([]);
  const [citasClosedRaw, setCitasClosedRaw] = useState([]);
  const [turnosClosedRaw, setTurnosClosedRaw] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const futureRange = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addMonths(start, Number(monthsAhead) || 1);
    return { start, end };
  }, [monthsAhead]);

  const historyRange = useMemo(() => buildHistoryRange(historyRangeKey), [historyRangeKey]);

  useEffect(() => {
    setStatusFilter('all');
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'registro') {
      setSelectedRecord(null);
    }
  }, [viewMode, tab]);

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
        // silencioso
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    setLoadError('');
    setLoading(true);

    if (viewMode === 'agenda') {
      if (tab === 'citas') {
        const qC = query(
          collection(db, 'citas'),
          where('fechaHora', '>=', Timestamp.fromDate(futureRange.start)),
          where('fechaHora', '<', Timestamp.fromDate(futureRange.end)),
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
          where('fechaHoraGenerado', '>=', Timestamp.fromDate(futureRange.start)),
          where('fechaHoraGenerado', '<', Timestamp.fromDate(futureRange.end)),
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
    }

    if (viewMode === 'registro') {
      const startTs = Timestamp.fromDate(historyRange.start);
      const endTs = Timestamp.fromDate(historyRange.end);

      if (tab === 'citas') {
        const qC = query(
          collection(db, 'citas'),
          where('fechaHoraAtencionFin', '>=', startTs),
          where('fechaHoraAtencionFin', '<=', endTs),
          orderBy('fechaHoraAtencionFin', 'desc')
        );

        const unsub = onSnapshot(
          qC,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setCitasClosedRaw(list);
            setLoading(false);
          },
          (err) => {
            setLoadError('No se pudieron cargar los cierres de citas.');
            console.error('Registro citas onSnapshot error:', err);
            setLoading(false);
          }
        );

        return () => unsub();
      }

      if (tab === 'turnos') {
        const qT = query(
          collection(db, 'turnos'),
          where('fechaHoraAtencionFin', '>=', startTs),
          where('fechaHoraAtencionFin', '<=', endTs),
          orderBy('fechaHoraAtencionFin', 'desc')
        );

        const unsub = onSnapshot(
          qT,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTurnosClosedRaw(list);
            setLoading(false);
          },
          (err) => {
            setLoadError('No se pudieron cargar los cierres de turnos.');
            console.error('Registro turnos onSnapshot error:', err);
            setLoading(false);
          }
        );

        return () => unsub();
      }
    }

    setLoading(false);
    return undefined;
  }, [
    viewMode,
    tab,
    futureRange.start,
    futureRange.end,
    historyRange.start,
    historyRange.end,
  ]);

  const currentRows = useMemo(() => {
    if (viewMode === 'agenda') {
      const baseRows = tab === 'citas' ? citasRaw : turnosRaw;
      return baseRows
        .map((item) => ({
          ...item,
          agendaStatus: resolveAgendaStatus(item),
        }))
        .filter((item) => Boolean(item.agendaStatus));
    }

    const baseRows = tab === 'citas' ? citasClosedRaw : turnosClosedRaw;
    const filteredByRole = isAgent
      ? baseRows.filter((item) => getRecordAgentId(item) === String(currentUser?.uid || ''))
      : baseRows;

    return filteredByRole
      .filter((item) => !!item.fechaHoraAtencionFin)
      .map((item) => ({
        ...item,
        primaryStatus: resolveRecordStatus(item),
      }));
  }, [
    viewMode,
    tab,
    citasRaw,
    turnosRaw,
    citasClosedRaw,
    turnosClosedRaw,
    isAgent,
    currentUser?.uid,
  ]);

  const uniqueModules = useMemo(() => {
    const set = new Set();
    currentRows.forEach((item) => {
      const moduleValue = getRecordModule(item);
      if (moduleValue != null && moduleValue !== '') {
        set.add(String(moduleValue));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [currentRows]);

  const passesFilters = useCallback((item) => {
    if (viewMode === 'agenda' && isAgent) {
      if (habilidades.length > 0) {
        if (!habilidades.includes(String(getRecordTramiteId(item)))) return false;
      }

      const mod = item.moduloAsignado ?? item.modulo;
      if (mod != null && mod !== '' && moduloAsignado != null) {
        if (String(mod) !== String(moduloAsignado)) return false;
      }
    }

    if (isAdmin && moduleFilter !== 'all') {
      const mod = getRecordModule(item);
      if (String(mod) !== String(moduleFilter)) return false;
    }

    if (statusFilter !== 'all') {
      const statusValue = viewMode === 'agenda'
        ? String(item.agendaStatus ?? '')
        : String(item.primaryStatus ?? '');
      if (statusValue !== statusFilter) return false;
    }

    if (search) {
      const s = normalize(search);
      const codigo = normalize(item.codigo || item.id);
      const dni = normalize(item.dni);
      const tramite = normalize(tramitesMap[getRecordTramiteId(item)] || getRecordTramiteId(item));
      if (!codigo.includes(s) && !dni.includes(s) && !tramite.includes(s)) return false;
    }

    return true;
  }, [
    habilidades,
    isAdmin,
    isAgent,
    moduloAsignado,
    moduleFilter,
    search,
    statusFilter,
    tramitesMap,
    viewMode,
  ]);

  const rows = useMemo(() => currentRows.filter(passesFilters), [
    currentRows,
    passesFilters,
  ]);

  const statusSummary = viewMode === 'agenda'
    ? `${monthsAhead} mes${monthsAhead === 1 ? '' : 'es'} de rango`
    : historyRangeKey === 'today'
      ? 'Hoy'
      : historyRangeKey === '30d'
        ? 'Últimos 30 días'
        : historyRangeKey === '90d'
          ? 'Últimos 90 días'
          : 'Últimos 7 días';

  const subtitle = useMemo(() => {
    if (viewMode === 'agenda') {
      return `Próximos ${monthsAhead} mes${monthsAhead === 1 ? '' : 'es'}`;
    }
    return statusSummary;
  }, [monthsAhead, statusSummary, viewMode]);

  const toolbarTitle = viewMode === 'agenda' ? 'Próximas atenciones' : 'Registro';

  const tableDateHeader = viewMode === 'agenda'
    ? (tab === 'citas' ? 'Fecha' : 'Generado')
    : 'Cierre';

  const tableStatusHeader = viewMode === 'agenda' ? 'Estado' : 'Resultado';

  const clearFilters = () => {
    setStatusFilter('all');
    setModuleFilter('all');
    setSearch('');
  };

  const detailRows = useMemo(() => (
    selectedRecord ? buildRecordDetailRows(selectedRecord, tramitesMap) : []
  ), [selectedRecord, tramitesMap]);

  const modalSections = useMemo(() => (
    buildModalDetailSections(selectedRecord, tramitesMap)
  ), [selectedRecord, tramitesMap]);

  const openRecordDetail = (item) => {
    setSelectedRecord({
      ...item,
      __sourceTab: tab,
    });
  };

  const closeRecordDetail = () => {
    setSelectedRecord(null);
  };

  useEffect(() => {
    if (!selectedRecord) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedRecord(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecord]);

  const printRecordDetail = () => {
    if (!selectedRecord) return;

    const subtitle = `${selectedRecord.codigo || selectedRecord.id || 'Registro'} · ${
      selectedRecord.__sourceTab === 'citas' ? 'Cita web' : 'Turno kiosko'
    } · ${fmtTs(selectedRecord.fechaHoraAtencionFin)}`;

    const html = buildPrintableHTML({
      title: 'Comprobante de cierre',
      subtitle,
      resultLabel: formatRecordStatus(selectedRecord.primaryStatus),
      rows: detailRows,
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up bloqueado. Permite ventanas emergentes para imprimir.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const headerMeta = useMemo(() => {
    const items = [subtitle];

    if (viewMode === 'agenda' && isAgent && moduloAsignado) {
      items.push(`Módulo ${moduloAsignado}`);
    }

    if (viewMode === 'registro') {
      items.push(isAgent ? 'Mis cierres' : 'Todos los cierres');
    }

    return items.filter(Boolean);
  }, [isAgent, moduloAsignado, subtitle, viewMode]);

  return (
    <div className="agenda-page">
      <div className="agenda-header">
        <div>
          <h2 className="agenda-title">Agenda</h2>
          <div className="agenda-headerMeta">
            {headerMeta.map((item) => (
              <span key={item} className="agenda-metaChip">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="agenda-headerActions">
          <div className="agenda-viewSwitch" role="tablist" aria-label="Vista principal de agenda">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'agenda'}
              className={`agenda-viewButton ${viewMode === 'agenda' ? 'agenda-viewButton--active' : ''}`}
              onClick={() => setViewMode('agenda')}
            >
              Agenda
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'registro'}
              className={`agenda-viewButton ${viewMode === 'registro' ? 'agenda-viewButton--active' : ''}`}
              onClick={() => setViewMode('registro')}
            >
              Registro
            </button>
          </div>

          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="agenda-card">
        <div className="agenda-toolbar">
          <div className="agenda-toolbarMeta">
            <span className="agenda-toolbarChip">{toolbarTitle}</span>
            <span className="agenda-toolbarChip">{tab === 'citas' ? 'Citas web' : 'Turnos kiosko'}</span>
          </div>
        </div>

        <div className="agenda-controls">
          <div className="agenda-field">
            <label>{viewMode === 'agenda' ? 'Rango' : 'Periodo'}</label>
            {viewMode === 'agenda' ? (
              <select value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))}>
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
              </select>
            ) : (
              <select value={historyRangeKey} onChange={(e) => setHistoryRangeKey(e.target.value)}>
                <option value="today">Hoy</option>
                <option value="7d">7 días</option>
                <option value="30d">30 días</option>
                <option value="90d">90 días</option>
              </select>
            )}
          </div>

          <div className="agenda-field">
            <label>{viewMode === 'agenda' ? 'Estado' : 'Resultado'}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              {viewMode === 'agenda' ? (
                <>
                  <option value="por-atender">Por atender</option>
                  <option value="llamado">Llamado</option>
                </>
              ) : (
                <>
                  <option value="exitoso">Exitoso</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="fallido">Fallido</option>
                </>
              )}
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

        <div className="agenda-statusBar">
          <span className="agenda-statusItem">
            <span className="agenda-statusDot agenda-statusDot--records" />
            {rows.length} registro{rows.length === 1 ? '' : 's'} visibles
          </span>
          <span className="agenda-statusItem">
            <span className="agenda-statusDot agenda-statusDot--view" />
            {viewMode === 'agenda' ? 'Agenda operativa' : 'Historial'}
          </span>
          <span className="agenda-statusItem">
            <span className="agenda-statusDot agenda-statusDot--tab" />
            {tab === 'citas' ? 'Citas web' : 'Turnos kiosko'}
          </span>
          <span className="agenda-statusItem">
            <span className="agenda-statusDot agenda-statusDot--range" />
            {statusSummary}
          </span>
        </div>

        {loadError ? <div className="agenda-empty">{loadError}</div> : null}

        {!loadError && loading ? <div className="agenda-empty">Cargando...</div> : null}

        {!loadError && !loading && rows.length === 0 ? (
          <div className="agenda-empty">
            {viewMode === 'agenda'
              ? 'Sin resultados para los filtros actuales.'
              : 'Sin cierres para los filtros actuales.'}
          </div>
        ) : null}

        {!loadError && !loading && rows.length > 0 ? (
          <div className="agenda-tableWrap">
            <table className="agenda-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Trámite</th>
                  <th>{tableDateHeader}</th>
                  <th>{tableStatusHeader}</th>
                  <th>Módulo</th>
                  <th>DNI</th>
                  {viewMode === 'registro' ? <th>Acción</th> : null}
                </tr>
              </thead>

              <tbody>
                {rows.map((item) => {
                  const codigo = item.codigo || item.id;
                  const tramiteId = getRecordTramiteId(item);
                  const tramiteNombre = tramitesMap[tramiteId] || tramiteId || '—';
                  const modulo = getRecordModule(item);
                  const fecha = getRecordDate(item, viewMode, tab);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="agenda-codeCell">
                          <strong>{codigo}</strong>
                          <span className="agenda-codeSub">{tab === 'citas' ? 'Cita web' : 'Turno kiosko'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="agenda-mainText">{tramiteNombre}</div>
                      </td>
                      <td>
                        <div className="agenda-dateCell">{fecha}</div>
                      </td>
                      <td>
                        {viewMode === 'agenda' ? (
                          <span className={agendaBadgeClass(item.agendaStatus)}>
                            {formatAgendaStatus(item.agendaStatus)}
                          </span>
                        ) : (
                          <span className={recordBadgeClass(item.primaryStatus)}>
                            {formatRecordStatus(item.primaryStatus)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="agenda-chip">{modulo}</span>
                      </td>
                      <td>
                        <span className="agenda-mutedCell">{item.dni || '—'}</span>
                      </td>
                      {viewMode === 'registro' ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost agenda-rowAction"
                            onClick={() => openRecordDetail(item)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedRecord ? (
        <div
          className="agenda-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de cierre"
          onClick={closeRecordDetail}
        >
          <div className="agenda-modalCard" onClick={(event) => event.stopPropagation()}>
            <div className="agenda-modalHeader">
              <div>
                <div className="agenda-modalEyebrow">Historial</div>
                <h3 className="agenda-modalTitle">Detalle del cierre</h3>
                <div className="agenda-modalSubtitle">
                  {selectedRecord.codigo || selectedRecord.id || 'Registro'} ·{' '}
                  {selectedRecord.__sourceTab === 'citas' ? 'Cita web' : 'Turno kiosko'}
                </div>
              </div>

              <div className="agenda-modalActions">
                <span className={recordBadgeClass(selectedRecord.primaryStatus)}>
                  {formatRecordStatus(selectedRecord.primaryStatus)}
                </span>
                <button type="button" className="btn btn-ghost" onClick={printRecordDetail}>
                  Imprimir
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeRecordDetail}>
                  Cerrar
                </button>
              </div>
            </div>

            {modalSections.summaryItems.length > 0 ? (
              <section className="agenda-detailSection">
                <div className="agenda-detailSectionTitle">Resumen</div>
                <div className="agenda-detailGrid">
                  {modalSections.summaryItems.map(([label, value]) => (
                    <div key={label} className="agenda-detailItem">
                      <div className="agenda-detailLabel">{label}</div>
                      <div className="agenda-detailValue">{value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {modalSections.contextItems.length > 0 ? (
              <section className="agenda-detailSection">
                <div className="agenda-detailSectionTitle">Contexto del cierre</div>
                <div className="agenda-detailGrid">
                  {modalSections.contextItems.map(([label, value]) => (
                    <div key={label} className="agenda-detailItem">
                      <div className="agenda-detailLabel">{label}</div>
                      <div className="agenda-detailValue">{value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {modalSections.secondaryItems.length > 0 ? (
              <section className="agenda-detailSection agenda-detailSection--secondary">
                <div className="agenda-detailSectionTitle">Detalles adicionales</div>
                <div className="agenda-detailGrid">
                  {modalSections.secondaryItems.map(([label, value]) => (
                    <div key={label} className="agenda-detailItem">
                      <div className="agenda-detailLabel">{label}</div>
                      <div className="agenda-detailValue">{value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
