// src/components/common/Navbar.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  const rol = currentUser?.rol || "ciudadano";

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          // 👇 Si estamos en la pantalla TV, disparamos el evento para habilitar sonido
          if (location.pathname === "/pantalla-tv") {
            window.dispatchEvent(new Event("enableTvSound"));
          }
        })
        .catch((err) => console.error("Error al entrar en fullscreen:", err));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error("Error al salir de fullscreen:", err));
    }
  };

  // Mostrar botón solo en las vistas que lo necesitan
  const isKioskView =
    (rol === "kiosko" || rol === "admin") && location.pathname === "/kiosko";
  const isScreenView =
    (rol === "pantalla" || rol === "admin") &&
    location.pathname === "/pantalla-tv";

  const showFullscreenButton = isKioskView || isScreenView;

  return (
    <nav className="navbar">
      <div className="navbar-content">

        {/* IZQUIERDA */}
        <div className="navbar-left">
          {/* Logo -> siempre lleva a /inicio */}
          <Link to="/inicio" className="navbar-logo">
            Consulado del Perú
          </Link>

          {currentUser && (
            <ul className="navbar-links">
              {/* === Ciudadano === */}
              {rol === "ciudadano" && (
                <>
                  <li>
                    <Link to="/citas">Mis Citas</Link>
                  </li>
                  <li>
                    <Link to="/perfil">Mi Perfil</Link>
                  </li>
                </>
              )}

              {/* === Agente === */}
              {rol === "agente" && (
                <>
                  <li>
                    <Link to="/panel-agente">Panel Agente</Link>
                  </li>
                  <li>
                    <Link to="/perfil">Mi Perfil</Link>
                  </li>
                </>
              )}

              {/* === Admin === */}
              {rol === "admin" && (
                <>
                  <li>
                    <Link to="/panel-agente">Panel Agente</Link>
                  </li>
                  <li>
                    <Link to="/administrador">Admin</Link>
                  </li>
                  <li>
                    <Link to="/metricas">Métricas</Link>
                  </li>
                  <li>
                    <Link to="/pantalla-tv">Pantalla TV</Link>
                  </li>
                  <li>
                    <Link to="/kiosko">Kiosko</Link>
                  </li>
                  <li>
                    <Link to="/perfil">Mi Perfil</Link>
                  </li>
                </>
              )}

              {/* === Pantalla === */}
              {rol === "pantalla" && (
                <>
                  <li>
                    <Link to="/pantalla-tv">Pantalla TV</Link>
                  </li>
                  <li>
                    <Link to="/perfil">Mi Perfil</Link>
                  </li>
                </>
              )}

              {/* === Kiosko === */}
              {rol === "kiosko" && (
                <>
                  <li>
                    <Link to="/kiosko">Kiosko</Link>
                  </li>
                  <li>
                    <Link to="/perfil">Mi Perfil</Link>
                  </li>
                </>
              )}
            </ul>
          )}
        </div>

        {/* DERECHA */}
        {currentUser && (
          <div className="navbar-right">
            {/* Botón fullscreen solo para Kiosko / Pantalla / Admin en esas vistas */}
            {showFullscreenButton && (
              <button
                className="navbar-logout"
                onClick={handleToggleFullscreen}
                style={{ marginRight: "10px" }}
              >
                {isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
              </button>
            )}

            <span className="navbar-user">
              {currentUser.email}
              <small> ({rol})</small>
            </span>
            <button className="navbar-logout" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
