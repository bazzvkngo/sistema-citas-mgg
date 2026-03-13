import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../../context/AuthContext";
import resolveUserRole from "../../utils/resolveUserRole";
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

  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(document.fullscreenElement)
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const adminDropRef = useRef(null);
  const cursorHideTimerRef = useRef(null);

  useClickOutside(adminDropRef, () => setAdminOpen(false), adminOpen);

  const rol = useMemo(() => resolveUserRole(currentUser) || "ciudadano", [currentUser]);

  const roleLabelMap = {
    ciudadano: "Ciudadano",
    agente: "Agente",
    agent: "Agente",
    admin: "Administrador",
    pantalla: "Pantalla TV",
    kiosko: "Kiosco",
  };

  const roleLabel = roleLabelMap[rol] || rol;

  const isPublicAuthRoute = useMemo(() => {
    const p = location.pathname;
    return (
      p === "/ingreso" ||
      p === "/registro" ||
      p === "/recuperar-contrasena" ||
      p === "/verificar-correo"
    );
  }, [location.pathname]);

  const isPublicHeader = !currentUser && isPublicAuthRoute;

  const isKioskView =
    (rol === "kiosko" || rol === "admin") && location.pathname === "/kiosko";

  const isScreenView =
    (rol === "pantalla" || rol === "admin") && location.pathname === "/pantalla-tv";

  const isImmersiveRoute = isKioskView || isScreenView;
  const showFullscreenButton = isImmersiveRoute;

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAdminOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const shouldAutoHideCursor = isFullscreen && isImmersiveRoute;

    const clearCursorTimer = () => {
      if (cursorHideTimerRef.current) {
        clearTimeout(cursorHideTimerRef.current);
      }
    };

    if (!shouldAutoHideCursor) {
      clearCursorTimer();
      document.body.classList.remove("cursor-hidden-immersive");
      return;
    }

    const showCursor = () => {
      document.body.classList.remove("cursor-hidden-immersive");
    };

    const resetCursorTimer = () => {
      showCursor();
      clearCursorTimer();
      cursorHideTimerRef.current = setTimeout(() => {
        document.body.classList.add("cursor-hidden-immersive");
      }, 1800);
    };

    resetCursorTimer();

    window.addEventListener("mousemove", resetCursorTimer, { passive: true });
    window.addEventListener("mousedown", resetCursorTimer);
    window.addEventListener("keydown", resetCursorTimer);
    window.addEventListener("touchstart", resetCursorTimer, { passive: true });

    return () => {
      clearCursorTimer();
      document.body.classList.remove("cursor-hidden-immersive");
      window.removeEventListener("mousemove", resetCursorTimer);
      window.removeEventListener("mousedown", resetCursorTimer);
      window.removeEventListener("keydown", resetCursorTimer);
      window.removeEventListener("touchstart", resetCursorTimer);
    };
  }, [isFullscreen, isImmersiveRoute]);

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
        .then(() => {
          setIsFullscreen(false);
          document.body.classList.remove("cursor-hidden-immersive");
        })
        .catch((err) => console.error("Error al salir de fullscreen:", err));
    }
  };

  const isActive = (path) => location.pathname === path;

  const goAdminTab = (tabKey) => {
    setAdminOpen(false);
    setMobileOpen(false);
    navigate("/administrador", { state: { adminTab: tabKey } });
  };

  const getHomePath = () => {
    if (!currentUser) return "/ingreso";
    if (rol === "ciudadano") return "/citas";
    if (rol === "agente" || rol === "agent") return "/panel-agente";
    if (rol === "pantalla") return "/pantalla-tv";
    if (rol === "kiosko") return "/kiosko";
    if (rol === "admin") return "/panel-agente";
    return "/ingreso";
  };

  const baseItems = useMemo(() => {
    if (!currentUser) return [];

    if (rol === "ciudadano") {
      return [
        { label: "Citas", to: "/citas" },
        { label: "Perfil", to: "/perfil" },
      ];
    }

    if (rol === "agente" || rol === "agent") {
      return [
        { label: "Atención", to: "/panel-agente" },
        { label: "Agenda", to: "/agenda" },
        { label: "Perfil", to: "/perfil" },
      ];
    }

    if (rol === "pantalla") {
      return [
        { label: "Turnos TV", to: "/pantalla-tv" },
        { label: "Perfil", to: "/perfil" },
      ];
    }

    if (rol === "kiosko") {
      return [
        { label: "Kiosco", to: "/kiosko" },
        { label: "Perfil", to: "/perfil" },
      ];
    }

    return [
      { label: "Atención", to: "/panel-agente" },
      { label: "Agenda", to: "/agenda" },
      { label: "Gestión", to: "/administrador", dropdown: true },
      { label: "Reportes", to: "/metricas" },
      { label: "Turnos TV", to: "/pantalla-tv" },
      { label: "Kiosco", to: "/kiosko" },
      { label: "Perfil", to: "/perfil" },
    ];
  }, [currentUser, rol]);

  const email = currentUser?.email || "";
  const brandTitleFull = "Consulado General del Perú en Iquique";
  const brandTitleShort = "Consulado Perú";
  const brandTo = getHomePath();

  const navbarClassName = [
    "navbar",
    "cp-navbar",
    isPublicHeader ? "navbar--public" : "",
    isImmersiveRoute ? "navbar--immersive" : "",
    isFullscreen && isImmersiveRoute ? "navbar--fullscreen-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isPublicHeader) {
    return (
      <header className={navbarClassName}>
        <div className="navbar__top navbar__top--public">
          <Link to={brandTo} className="navbar__brand">
            <img
              src={logoConsulado}
              alt="Consulado del Perú"
              className="navbar__brandLogo"
            />
            <div className="navbar__brandText">
              <span className="navbar__title navbar__title--desktop">
                {brandTitleFull}
              </span>
              <span className="navbar__title navbar__title--mobile">
                {brandTitleShort}
              </span>
              <span className="navbar__subtitle">Sistema de atención consular</span>
            </div>
          </Link>
        </div>
        <div className="navbar__menuBar navbar__menuBar--public" />
      </header>
    );
  }

  return (
    <header className={navbarClassName}>
      <div className="navbar__top">
        <Link to={brandTo} className="navbar__brand">
          <img
            src={logoConsulado}
            alt="Consulado del Perú"
            className="navbar__brandLogo"
          />
          <div className="navbar__brandText">
            <span className="navbar__title navbar__title--desktop">
              {brandTitleFull}
            </span>
            <span className="navbar__title navbar__title--mobile">
              {brandTitleShort}
            </span>
            <span className="navbar__subtitle">Sistema de atención consular</span>
          </div>
        </Link>

        {currentUser ? (
          <div className="navbar__topRight">
            {showFullscreenButton ? (
              <button
                type="button"
                className="navbar__ghostBtn"
                onClick={handleToggleFullscreen}
              >
                {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              </button>
            ) : null}

            <div className="navbar__session desktop-only">
              <span className="navbar__email" title={email}>
                {email}
              </span>
              <span className="navbar__role">{roleLabel}</span>
            </div>

            <button
              type="button"
              className="navbar__logout desktop-only"
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>

            <button
              type="button"
              className="navbar__hamburger mobile-only"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menú"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        ) : null}
      </div>

      {currentUser ? (
        <div className="navbar__menuBar">
          <nav className="navbar__nav desktop-only" aria-label="Navegación principal">
            {baseItems.map((it) => {
              if (it.dropdown && rol === "admin") {
                return (
                  <div
                    key={it.label}
                    className="navbar__dropdown"
                    ref={adminDropRef}
                  >
                    <button
                      type="button"
                      className={`navbar__navItem navbar__navButton ${
                        isActive("/administrador") ? "active" : ""
                      }`}
                      onClick={() => setAdminOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={adminOpen}
                    >
                      {it.label}
                      <span className={`navbar__caret ${adminOpen ? "open" : ""}`}>
                        ▾
                      </span>
                    </button>

                    {adminOpen ? (
                      <div className="navbar__dropdownMenu" role="menu">
                        <button
                          type="button"
                          onClick={() => goAdminTab("tramites")}
                          className="navbar__dropdownItem"
                          role="menuitem"
                        >
                          Trámites
                        </button>
                        <button
                          type="button"
                          onClick={() => goAdminTab("agentes")}
                          className="navbar__dropdownItem"
                          role="menuitem"
                        >
                          Equipo
                        </button>
                        <button
                          type="button"
                          onClick={() => goAdminTab("feriados")}
                          className="navbar__dropdownItem"
                          role="menuitem"
                        >
                          Calendario
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`navbar__navItem ${isActive(it.to) ? "active" : ""}`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {mobileOpen ? (
            <div className="navbar__mobilePanel mobile-only">
              <div className="navbar__mobileSession">
                <span className="navbar__mobileEmail">{email}</span>
                <span className="navbar__mobileRole">{roleLabel}</span>
              </div>

              <div className="navbar__mobileLinks">
                {baseItems.map((it) => {
                  if (it.dropdown && rol === "admin") {
                    return (
                      <div key={it.label} className="navbar__mobileGroup">
                        <button
                          type="button"
                          className="navbar__mobileLink navbar__mobileLink--group"
                          onClick={() => setAdminOpen((v) => !v)}
                        >
                          {it.label}
                          <span className={`navbar__caret ${adminOpen ? "open" : ""}`}>
                            ▾
                          </span>
                        </button>

                        {adminOpen ? (
                          <div className="navbar__mobileSubmenu">
                            <button
                              type="button"
                              className="navbar__mobileSubLink"
                              onClick={() => goAdminTab("tramites")}
                            >
                              Trámites
                            </button>
                            <button
                              type="button"
                              className="navbar__mobileSubLink"
                              onClick={() => goAdminTab("agentes")}
                            >
                              Equipo
                            </button>
                            <button
                              type="button"
                              className="navbar__mobileSubLink"
                              onClick={() => goAdminTab("feriados")}
                            >
                              Calendario
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={`navbar__mobileLink ${isActive(it.to) ? "active" : ""}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>

              <div className="navbar__mobileActions">
                {showFullscreenButton ? (
                  <button
                    type="button"
                    className="navbar__ghostBtn navbar__ghostBtn--mobile"
                    onClick={handleToggleFullscreen}
                  >
                    {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="navbar__logout navbar__logout--mobile"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="navbar__menuBar navbar__menuBar--public" />
      )}
    </header>
  );
}
