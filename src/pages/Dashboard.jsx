// src/pages/Dashboard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css'; 

export default function Dashboard() {
  const { currentUser } = useAuth();

  return (
    <div className="home-container">
      <header className="hero-section">
        <h1>Bienvenido al Consulado del Perú</h1>
        <p>Gestione sus trámites de manera rápida y sencilla.</p>
      </header>

      <div className="actions-grid">
        
        {/* --- Tarjeta Principal: Citas --- */}
        {/* (Solo se muestra si NO es agente/admin, o si es ciudadano) */}
        {currentUser?.rol === 'ciudadano' && (
          <div className="action-card">
            <h3>Citas Web</h3>
            <p>Agende una nueva cita o revise sus citas activas.</p>
            <Link to="/citas" className="action-button">
              Ir a Mis Citas
            </Link>
          </div>
        )}

        {/* --- Tarjeta para Staff (Agente/Admin) --- */}
        {(currentUser?.rol === 'agente' || currentUser?.rol === 'admin') && (
          <div className="action-card staff-card">
            <h3>Panel de Agente</h3>
            <p>Gestione la cola de atención y citas.</p>
            <Link to="/panel-agente" className="action-button staff">
              Entrar al Panel
            </Link>
          </div>
        )}

        {/* ❌ ELIMINADO: La tarjeta de "Administración" ya no está aquí */}

      </div>
    </div>
  );
}