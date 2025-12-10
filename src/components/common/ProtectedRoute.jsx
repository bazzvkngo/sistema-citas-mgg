// src/components/common/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * ⚙️ CONFIGURACIÓN: ¿Exigir correo verificado?
 *
 * - En PRUEBAS lo puedes dejar en false para permitir correos ficticios,
 *   por ejemplo "funcionario@consulado.pe".
 * - En PRODUCCIÓN se recomienda ponerlo en true para obligar a verificar
 *   el correo antes de usar el sistema.
 *
 * Esta constante es el "switch" que deberá conocer el nuevo dueño del sistema.
 */
const REQUIRE_EMAIL_VERIFIED = false; // 👉 cambiar a true en producción

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <p className="page-container">Cargando...</p>;
  }

  // Si no hay usuario logueado → siempre al login
  if (!currentUser) {
    return <Navigate to="/ingreso" />;
  }

  // 🔒 Verificación de correo (controlada por el flag de arriba)
  if (REQUIRE_EMAIL_VERIFIED && !currentUser.emailVerified) {
    return <Navigate to="/verificar-correo" />;
  }

  return children;
}
