// src/pages/AdminPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import resolveUserRole from "../utils/resolveUserRole";

import AdminServices from "../components/admin/AdminServices";
import AdminAgents from "../components/admin/AdminAgents";
import AdminHolidays from "../components/admin/AdminHolidays";
import AdminArcoRequests from "../components/admin/AdminArcoRequests";
import AdminDemoReset from "../components/admin/AdminDemoReset";

const styles = {
  adminContainer: { padding: "20px" },
  nav: {
    display: "flex",
    borderBottom: "2px solid #ccc",
    marginBottom: "20px",
    gap: "8px",
    flexWrap: "wrap",
  },
  tab: {
    padding: "10px 20px",
    cursor: "pointer",
    fontSize: "16px",
    backgroundColor: "transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "3px solid transparent",
    color: "#666",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  activeTab: {
    borderBottom: "3px solid #C8102E",
    fontWeight: "bold",
    color: "#C8102E",
  },
  disabledTab: {
    color: "#aaa",
    cursor: "not-allowed",
    opacity: 0.6,
  },
};

function mapAdminTabToLocal(adminTab) {
  const key = String(adminTab || "").toLowerCase().trim();
  if (key === "tramites" || key === "services") return "services";
  if (key === "agentes" || key === "agents") return "agents";
  if (key === "feriados" || key === "holidays") return "holidays";
  if (key === "arco" || key === "arco-requests") return "arco";
  if (key === "demo-reset" || key === "reset-demo") return "demo-reset";
  return null;
}

export default function AdminPanel() {
  const location = useLocation();
  const { currentUser, loading } = useAuth();

  const userRole = useMemo(() => resolveUserRole(currentUser), [currentUser]);
  const isAdmin = userRole === "admin";
  const isSuperadmin = userRole === "superadmin";
  const canManageAdminTabs = isAdmin || isSuperadmin;

  const [activeTab, setActiveTab] = useState("services");

  useEffect(() => {
    const desired = mapAdminTabToLocal(location.state?.adminTab);

    if (!desired) return;

    if (!canManageAdminTabs && (desired === "agents" || desired === "holidays" || desired === "arco")) {
      setActiveTab("services");
      return;
    }

    if (!isSuperadmin && desired === "demo-reset") {
      setActiveTab("services");
      return;
    }

    setActiveTab(desired);
  }, [location.state, canManageAdminTabs, isSuperadmin]);

  if (loading) {
    return <p className="page-container">Cargando panel...</p>;
  }

  return (
    <div style={styles.adminContainer} className="page-container">
      <h1>Panel de Administracion</h1>

      <nav style={styles.nav}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "services" ? styles.activeTab : {}),
          }}
          onClick={() => setActiveTab("services")}
        >
          Gestionar Tramites
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === "agents" ? styles.activeTab : {}),
            ...(!canManageAdminTabs ? styles.disabledTab : {}),
          }}
          onClick={() => canManageAdminTabs && setActiveTab("agents")}
          disabled={!canManageAdminTabs}
        >
          Gestionar Agentes
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === "holidays" ? styles.activeTab : {}),
            ...(!canManageAdminTabs ? styles.disabledTab : {}),
          }}
          onClick={() => canManageAdminTabs && setActiveTab("holidays")}
          disabled={!canManageAdminTabs}
        >
          Dias Bloqueados / Feriados
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === "arco" ? styles.activeTab : {}),
            ...(!canManageAdminTabs ? styles.disabledTab : {}),
          }}
          onClick={() => canManageAdminTabs && setActiveTab("arco")}
          disabled={!canManageAdminTabs}
        >
          Solicitudes ARCO
        </button>

        <button
          style={{
            ...styles.tab,
            ...(activeTab === "demo-reset" ? styles.activeTab : {}),
            ...(!isSuperadmin ? styles.disabledTab : {}),
          }}
          onClick={() => isSuperadmin && setActiveTab("demo-reset")}
          disabled={!isSuperadmin}
        >
          Reset Demo
        </button>
      </nav>

      <div style={{ marginTop: "20px" }}>
        {activeTab === "services" && <AdminServices />}
        {activeTab === "agents" && canManageAdminTabs && <AdminAgents />}
        {activeTab === "holidays" && canManageAdminTabs && <AdminHolidays />}
        {activeTab === "arco" && canManageAdminTabs && <AdminArcoRequests />}
        {activeTab === "demo-reset" && isSuperadmin && <AdminDemoReset />}
      </div>
    </div>
  );
}
