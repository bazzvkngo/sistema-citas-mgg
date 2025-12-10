// src/components/common/ScreenRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ScreenRoute({ children }) {
  const { currentUser, loading } = useAuth();

  // Mientras cargan los datos del usuario
  if (loading) {
    return <p>Cargando...</p>;
  }

  // Si no hay usuario autenticado, redirige al login
  if (!currentUser) {
    return <Navigate to="/ingreso" replace />;
  }

  const rol = currentUser.rol || "ciudadano";

  // Solo admin o pantalla pueden ver /pantalla-tv
  if (rol !== "admin" && rol !== "pantalla") {
    return <Navigate to="/inicio" replace />;
  }

  // Si pasa todas las validaciones, muestra la pantalla
  return children;
}
