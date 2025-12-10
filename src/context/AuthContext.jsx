// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// Creamos el Contexto
const AuthContext = createContext();

// Hook para usar el contexto
export function useAuth() {
  return useContext(AuthContext);
}

// Proveedor
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    let unsubscribeFirestore = () => {};

    // Oyente de Autenticación
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Limpia el oyente anterior de Firestore si lo había
      unsubscribeFirestore();

      if (user) {
        const userDocRef = doc(db, 'usuarios', user.uid);

        unsubscribeFirestore = onSnapshot(
          userDocRef,
          (userDocSnap) => {
            if (userDocSnap.exists()) {
              // Documento listo → combinamos Auth + Firestore
              setCurrentUser({
                ...user,
                ...userDocSnap.data(),
              });
              setLoading(false);
            } else {
              // Usuario autenticado pero el doc aún no se crea
              console.warn(
                'AuthContext: Usuario autenticado pero sin documento en Firestore (esperando creación)...'
              );
              // Dejamos loading = true para que la app muestre estado de carga
            }
          },
          (error) => {
            console.error('Error al escuchar documento de usuario:', error);
            setCurrentUser(null);
            setLoading(false);
          }
        );
      } else {
        // No hay usuario autenticado
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, []);

  const value = {
    currentUser,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}