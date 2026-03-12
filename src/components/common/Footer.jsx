import React from "react";
import { useLocation, Link } from "react-router-dom";
import logoConsulado from "../../assets/logo-consulado.png";

const UI = {
  bg: "#0b1220",
  bg2: "#0a1020",
  ink: "#f8fafc",
  muted: "rgba(248,250,252,0.78)",
  soft: "rgba(248,250,252,0.60)",
  brand: "#C8102E",
  border: "rgba(255,255,255,0.10)",
};

const CONSULATE = {
  name: "Consulado General del Perú en Iquique",
  addressLine1: "Vicente Zegers 570, piso 2",
  addressLine2: "Iquique, Tarapacá, Chile",
  phone: "(57) 241 1466",
  // No inventamos correo: si no está confirmado, mejor dejarlo vacío.
  email: "",
  hours: "Lun a Vie: 9:00 a. m. – 12:30 p. m. | Sáb/Dom: Cerrado",
};

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${CONSULATE.addressLine1}, ${CONSULATE.addressLine2}`
)}`;

const styles = {
  footer: {
    marginTop: 0,
    background: `linear-gradient(180deg, ${UI.bg}, ${UI.bg2})`,
    color: UI.ink,
    borderTop: `4px solid ${UI.brand}`,
  },
  wrap: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "18px 22px 12px",
  },

  top: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: 18,
    alignItems: "start",
  },

  brandRow: { display: "flex", gap: 12, alignItems: "center" },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logo: { width: "100%", height: "100%", objectFit: "contain", padding: 6 },

  name: { margin: 0, fontSize: 16, fontWeight: 900, lineHeight: 1.2 },
  tagline: { margin: "4px 0 0 0", fontSize: 12, color: UI.muted, fontWeight: 800 },

  colTitle: {
    margin: "2px 0 8px 0",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.92)",
  },

  list: { display: "grid", gap: 6 },
  item: { fontSize: 13, color: UI.muted, lineHeight: 1.45 },
  strong: { color: UI.ink, fontWeight: 900 },

  mapsBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: "9px 12px",
    borderRadius: 12,
    background: UI.brand,
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    width: "fit-content",
  },

  mid: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: `1px solid ${UI.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  links: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },
  link: {
    color: UI.ink,
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
  },
  muted: { color: UI.soft, fontSize: 12, fontWeight: 800, margin: 0 },

  bottom: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${UI.border}`,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
};

export default function Footer() {
  const { pathname = "" } = useLocation();

  // No mostrar footer en pantallas donde rompe la estética o estorba
  const hideOn = [
    "/pantalla-tv",
    "/kiosko",
    "/panel-agente",
    "/administrador",
  ];

  if (hideOn.some((r) => pathname.startsWith(r))) return null;

  return (
    <footer style={styles.footer}>
      <div style={styles.wrap}>
        <div style={styles.top} className="cp-footer-top">
          {/* Marca */}
          <div>
            <div style={styles.brandRow}>
              <div style={styles.logoBox}>
                <img src={logoConsulado} alt="Consulado" style={styles.logo} />
              </div>
              <div>
                <h3 style={styles.name}>{CONSULATE.name}</h3>
                <p style={styles.tagline}>Sistema de Citas y Atención Consular</p>
              </div>
            </div>
            <p style={{ ...styles.item, marginTop: 10 }}>
              Plataforma para gestionar citas y atención de forma más ordenada y clara.
            </p>
          </div>

          {/* Contacto */}
          <div>
            <div style={styles.colTitle}>Ubicación y contacto</div>
            <div style={styles.list}>
              <div style={styles.item}>
                <span style={styles.strong}>Dirección:</span> {CONSULATE.addressLine1},{" "}
                {CONSULATE.addressLine2}
              </div>
              <div style={styles.item}>
                <span style={styles.strong}>Teléfono:</span> {CONSULATE.phone}
              </div>
              
            </div>

            <a href={MAPS_URL} target="_blank" rel="noreferrer" style={styles.mapsBtn}>
              Ver ubicación en Google Maps
            </a>
          </div>

          {/* Horario */}
          <div>
            <div style={styles.colTitle}>Horario de atención</div>
            <div style={styles.list}>
              <div style={styles.item}>{CONSULATE.hours}</div>
              <div style={styles.item}>
                Atención sujeta a disponibilidad de módulos y citas agendadas.
              </div>
              <div style={styles.item}>
                Redes sociales: (pendiente de enlaces oficiales)
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div style={styles.mid}>
          <div style={styles.links}>
            <Link to="/recuperar-contrasena" style={styles.link}>Recuperar contraseña</Link>
          </div>
        </div>

        {/* Bottom */}
        <div style={styles.bottom}>
          <p style={styles.muted}>
            © {new Date().getFullYear()} {CONSULATE.name} — Sistema de Citas
          </p>
          <p style={styles.muted}>Iquique, Chile</p>
        </div>
      </div>

      <style>
        {`
          @media (max-width: 980px) {
            .cp-footer-top { grid-template-columns: 1fr !important; }
          }
        `}
      </style>
    </footer>
  );
}