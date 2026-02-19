import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../../context/AuthContext";
import logoConsulado from "../../assets/logo-consulado.png";

function useClickOutside(ref, handler, when = true) {
  useEffect(() => {
    if (!when) return;
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) handler?.();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler, when]);
}

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const adminDropRef = useRef(null);
  useClickOutside(adminDropRef, () => setAdminOpen(false), adminOpen);

  const rol = useMemo(() => String(currentUser?.rol || "ciudadano").toLowerCase().trim(), [currentUser]);

  const roleLabelMap = {
    ciudadano: "Ciudadano",
    agente: "Agente",
    agent: "Agente",
    admin: "Admin",
    pantalla: "Pantalla TV",
    kiosko: "Kiosko"
  };
  const roleLabel = roleLabelMap[rol] || rol;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

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

  const isKioskView = (rol === "kiosko" || rol === "admin") && location.pathname === "/kiosko";
  const isScreenView = (rol === "pantalla" || rol === "admin") && location.pathname === "/pantalla-tv";
  const showFullscreenButton = isKioskView || isScreenView;

  const isActive = (path) => location.pathname === path;

  const closeMobile = () => setMobileOpen(false);

  // Navegación segura: si AdminPanel aún no lee `state`, no pasa nada.
  const goAdminTab = (tabKey) => {
    setAdminOpen(false);
    setMobileOpen(false);
    navigate("/administrador", { state: { adminTab: tabKey } });
  };

  const baseItems = useMemo(() => {
    if (!currentUser) return [];

    if (rol === "ciudadano") {
      return [
        { label: "Mis Citas", to: "/citas" },
        { label: "Mi Perfil", to: "/perfil" }
      ];
    }

    if (rol === "agente" || rol === "agent") {
      return [
        { label: "Panel Agente", to: "/panel-agente" },
        { label: "Agenda", to: "/agenda" },
        { label: "Mi Perfil", to: "/perfil" }
      ];
    }

    if (rol === "pantalla") {
      return [
        { label: "Pantalla TV", to: "/pantalla-tv" },
        { label: "Mi Perfil", to: "/perfil" }
      ];
    }

    if (rol === "kiosko") {
      return [
        { label: "Kiosko", to: "/kiosko" },
        { label: "Mi Perfil", to: "/perfil" }
      ];
    }

    // admin
    return [
      { label: "Panel Agente", to: "/panel-agente" },
      { label: "Agenda", to: "/agenda" },
      { label: "Admin", to: "/administrador", dropdown: true },
      { label: "Métricas", to: "/metricas" },
      { label: "Pantalla TV", to: "/pantalla-tv" },
      { label: "Kiosko", to: "/kiosko" },
      { label: "Mi Perfil", to: "/perfil" }
    ];
  }, [currentUser, rol]);

  // Evita que el drawer quede abierto al navegar
  useEffect(() => {
    setMobileOpen(false);
    setAdminOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const email = currentUser?.email || "";
  const brandTitleFull = "Consulado General del Perú en Iquique";
const brandTitleShort = "Consulado Perú";


  return (
    <nav className="cp-navbar">
      <div className="cp-navbar-inner">
        {/* LEFT */}
        <div className="cp-navbar-left">
          <Link to="/inicio" className="cp-brand" onClick={closeMobile}>
            <img className="cp-brand-logo" src={logoConsulado} alt="Logo Consulado" />

            <span className="cp-brand-title">
  <span className="cp-brand-title-full">{brandTitleFull}</span>
  <span className="cp-brand-title-short">{brandTitleShort}</span>
</span>

          </Link>

          {/* Desktop links */}
          {currentUser ? (
            <div className="cp-links cp-desktop">
              {baseItems.map((it) => {
                if (it.dropdown && rol === "admin") {
                  return (
                    <div key={it.label} className="cp-dropdown" ref={adminDropRef}>
                      <button
                        type="button"
                        className={`cp-link cp-link-btn ${isActive("/administrador") ? "active" : ""}`}
                        onClick={() => setAdminOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={adminOpen}
                      >
                        {it.label}
                        <span className={`cp-caret ${adminOpen ? "open" : ""}`} aria-hidden="true">
                          ▾
                        </span>
                      </button>

                      {adminOpen ? (
                        <div className="cp-dropdown-menu" role="menu">
                          <button className="cp-dd-item" onClick={() => goAdminTab("tramites")} role="menuitem">
                            Gestionar Trámites
                          </button>
                          <button className="cp-dd-item" onClick={() => goAdminTab("agentes")} role="menuitem">
                            Gestionar Agentes
                          </button>
                          <button className="cp-dd-item" onClick={() => goAdminTab("feriados")} role="menuitem">
                            Días Bloqueados / Feriados
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link
                    key={it.label}
                    to={it.to}
                    className={`cp-link ${isActive(it.to) ? "active" : ""}`}
                    onClick={closeMobile}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* RIGHT */}
        <div className="cp-navbar-right">
          {currentUser ? (
            <>
              {showFullscreenButton ? (
                <button className="cp-btn cp-btn-ghost" onClick={handleToggleFullscreen}>
                  {isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
                </button>
              ) : null}

              <div className="cp-userchip cp-desktop">
                <span className="cp-userchip-email" title={email}>
                  {email}
                </span>
                <span className="cp-userchip-role">{roleLabel}</span>
              </div>

              <button className="cp-btn cp-btn-danger cp-desktop" onClick={handleLogout}>
                Cerrar Sesión
              </button>

              {/* Mobile hamburger */}
              <button
                className="cp-hamburger cp-mobile"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Abrir menú"
              >
                <span />
                <span />
                <span />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile drawer */}
      {currentUser && mobileOpen ? (
        <div className="cp-drawer">
          <div className="cp-drawer-top">
            <div className="cp-userchip">
              <span className="cp-userchip-email" title={email}>
                {email}
              </span>
              <span className="cp-userchip-role">{roleLabel}</span>
            </div>

            <button className="cp-btn cp-btn-danger" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>

          <div className="cp-drawer-links">
            {baseItems.map((it) => {
              if (it.dropdown && rol === "admin") {
                return (
                  <div key={it.label} className="cp-drawer-group">
                    <div className="cp-drawer-group-title">Admin</div>
                    <button className="cp-drawer-link" onClick={() => goAdminTab("tramites")}>
                      Gestionar Trámites
                    </button>
                    <button className="cp-drawer-link" onClick={() => goAdminTab("agentes")}>
                      Gestionar Agentes
                    </button>
                    <button className="cp-drawer-link" onClick={() => goAdminTab("feriados")}>
                      Días Bloqueados / Feriados
                    </button>
                  </div>
                );
              }

              return (
                <Link
                  key={it.label}
                  to={it.to}
                  className={`cp-drawer-link ${isActive(it.to) ? "active" : ""}`}
                  onClick={closeMobile}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>

          {showFullscreenButton ? (
            <div className="cp-drawer-bottom">
              <button className="cp-btn cp-btn-ghost" onClick={handleToggleFullscreen}>
                {isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
