// src/pages/AdminPanel.jsx
import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

import AdminServices from '../components/admin/AdminServices';
import AdminAgents from '../components/admin/AdminAgents';
import AdminHolidays from '../components/admin/AdminHolidays';

const styles = {
  adminContainer: { padding: '20px' },
  nav: {
    display: 'flex',
    borderBottom: '2px solid #ccc',
    marginBottom: '20px',
    gap: '8px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '16px',
    backgroundColor: 'transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: '3px solid transparent',
    color: '#666',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  activeTab: {
    borderBottom: '3px solid #C8102E',
    fontWeight: 'bold',
    color: '#C8102E'
  },
  disabledTab: {
    color: '#aaa',
    cursor: 'not-allowed',
    opacity: 0.6
  }
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('services');
  const { currentUser, loading } = useAuth();

  const userRole = useMemo(() => currentUser?.rol, [currentUser]);
  const isAdmin = userRole === 'admin';

  if (loading) {
    return <p className="page-container">Cargando panel...</p>;
  }

  return (
    <div style={styles.adminContainer} className="page-container">
      <h1>Panel de Administración</h1>

      <nav style={styles.nav}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'services' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('services')}
        >
          Gestionar Trámites
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'agents' ? styles.activeTab : {}),
            ...(!isAdmin ? styles.disabledTab : {})
          }}
          onClick={() => isAdmin && setActiveTab('agents')}
          disabled={!isAdmin}
        >
          Gestionar Agentes
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'holidays' ? styles.activeTab : {}),
            ...(!isAdmin ? styles.disabledTab : {})
          }}
          onClick={() => isAdmin && setActiveTab('holidays')}
          disabled={!isAdmin}
        >
          Días Bloqueados / Feriados
        </button>
      </nav>

      <div style={{ marginTop: '20px' }}>
        {activeTab === 'services' && <AdminServices />}
        {activeTab === 'agents' && isAdmin && <AdminAgents />}
        {activeTab === 'holidays' && isAdmin && <AdminHolidays />}
      </div>
    </div>
  );
}
