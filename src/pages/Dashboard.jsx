// src/pages/Dashboard.jsx
import React from 'react';
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
        {currentUser?.rol === 'ciudadano' && (
          <div className="action-card">
            <h3>Citas Web</h3>
            <p>
              Agende una nueva cita o revise sus citas activas desde el menú superior.
            </p>

            <div className="action-hint">
              Acceso: <strong>Mis Citas</strong> (menú superior)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
