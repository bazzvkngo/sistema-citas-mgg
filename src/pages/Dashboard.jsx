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
        {/* Tarjeta principal para ciudadanos */}
        {currentUser?.rol === 'ciudadano' && (
          <div className="action-card">
            <h3>Citas Web</h3>
            <p>Agende una nueva cita o revise sus citas activas.</p>
            <Link to="/citas" className="action-button">
              Ir a Mis Citas
            </Link>
          </div>
        )}

        {/* (Para agentes/admin ya no se muestra tarjeta aquí; 
            ingresan al panel desde el menú superior) */}
      </div>
    </div>
  );
}
