// src/pages/AgentPanel.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AgentAppointments from '../components/agent/AgentAppointments';
import AgentQueue from '../components/agent/AgentQueue';

const styles = {
  panelContainer: { 
    padding: '20px', 
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '30px',
    borderBottom: '1px solid #eee',
    paddingBottom: '15px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#C8102E', // Rojo corporativo
    margin: 0
  },
  // ✅ NUEVO ESTILO: Burbuja de información del agente
  agentInfoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f8f9fa', // Fondo gris muy claro
    padding: '10px 20px',
    borderRadius: '30px',
    border: '1px solid #e9ecef',
    color: '#333', // Texto oscuro explícito
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  },
  // Estilos de Pestañas
  nav: { display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '20px' },
  tab: { 
    padding: '12px 25px', 
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
    color: '#C8102E',
    fontWeight: 'bold' 
  },
};

export default function AgentPanel() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('citas');

  return (
    <div style={styles.panelContainer} className="page-container">
      
      {/* Cabecera con Título y Datos del Agente */}
      <div style={styles.header}>
        <h1 style={styles.title}>Panel de Atención</h1>
        
        {currentUser && (
          <div style={styles.agentInfoBadge}>
            <span style={{fontSize: '18px'}}>👤</span>
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <span style={{fontWeight: 'bold'}}>{currentUser.email}</span>
              <span style={{fontSize: '12px', color: '#666'}}>
                Módulo Asignado: <strong style={{color: '#007bff'}}>{currentUser.moduloAsignado || 'Sin Asignar'}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Navegación de Pestañas */}
      <nav style={styles.nav}>
        <button 
          style={{...styles.tab, ...(activeTab === 'citas' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('citas')}
        >
          Citas Web (Agendadas)
        </button>
        <button 
          style={{...styles.tab, ...(activeTab === 'presencial' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('presencial')}
        >
          Turnos Kiosko (Presencial)
        </button>
      </nav>
      
      {/* Contenido de la Pestaña */}
      <div>
        {activeTab === 'citas' && <AgentAppointments />}
        {activeTab === 'presencial' && <AgentQueue />}
      </div>
    </div>
  );
}