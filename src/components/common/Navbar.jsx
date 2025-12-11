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

  // Texto bonito para el rol
  const roleLabelMap = {
    ciudadano: "Ciudadano",
    agente: "Agente",
    admin: "Admin",
    pantalla: "Pantalla TV",
    kiosko: "Kiosko",
  };
  const roleLabel = roleLabelMap[rol] || rol;

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
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

  // Helper para aplicar la clase "active" según la ruta
  const linkClass = (path) =>
    `navbar-link ${location.pathname === path ? "active" : ""}`;

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
                    <Link to="/citas" className={linkClass("/citas")}>
                      Mis Citas
                    </Link>
                  </li>
                  <li>
                    <Link to="/perfil" className={linkClass("/perfil")}>
                      Mi Perfil
                    </Link>
                  </li>
                </>
              )}

              {/* === Agente === */}
              {rol === "agente" && (
                <>
                  <li>
                    <Link
                      to="/panel-agente"
                      className={linkClass("/panel-agente")}
                    >
                      Panel Agente
                    </Link>
                  </li>
                  <li>
                    <Link to="/perfil" className={linkClass("/perfil")}>
                      Mi Perfil
                    </Link>
                  </li>
                </>
              )}

              {/* === Admin === */}
              {rol === "admin" && (
                <>
                  <li>
                    <Link
                      to="/panel-agente"
                      className={linkClass("/panel-agente")}
                    >
                      Panel Agente
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/administrador"
                      className={linkClass("/administrador")}
                    >
                      Admin
                    </Link>
                  </li>
                  <li>
                    <Link to="/metricas" className={linkClass("/metricas")}>
                      Métricas
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pantalla-tv"
                      className={linkClass("/pantalla-tv")}
                    >
                      Pantalla TV
                    </Link>
                  </li>
                  <li>
                    <Link to="/kiosko" className={linkClass("/kiosko")}>
                      Kiosko
                    </Link>
                  </li>
                  <li>
                    <Link to="/perfil" className={linkClass("/perfil")}>
                      Mi Perfil
                    </Link>
                  </li>
                </>
              )}

              {/* === Pantalla === */}
              {rol === "pantalla" && (
                <>
                  <li>
                    <Link
                      to="/pantalla-tv"
                      className={linkClass("/pantalla-tv")}
                    >
                      Pantalla TV
                    </Link>
                  </li>
                  <li>
                    <Link to="/perfil" className={linkClass("/perfil")}>
                      Mi Perfil
                    </Link>
                  </li>
                </>
              )}

              {/* === Kiosko === */}
              {rol === "kiosko" && (
                <>
                  <li>
                    <Link to="/kiosko" className={linkClass("/kiosko")}>
                      Kiosko
                    </Link>
                  </li>
                  <li>
                    <Link to="/perfil" className={linkClass("/perfil")}>
                      Mi Perfil
                    </Link>
                  </li>
                </>
              )}
            </ul>
          )}
        </div>

        {/* DERECHA */}
        {currentUser && (
          <div className="navbar-right">
            {showFullscreenButton && (
              <button
                className="navbar-button navbar-button-secondary"
                onClick={handleToggleFullscreen}
              >
                {isFullscreen
                  ? "Salir Pantalla Completa"
                  : "Pantalla Completa"}
              </button>
            )}

            <div className="navbar-user">
              <span className="navbar-user-email">{currentUser.email}</span>
              <span className="navbar-user-role">{roleLabel}</span>
            </div>

            <button
              className="navbar-button navbar-button-danger"
              onClick={handleLogout}
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
