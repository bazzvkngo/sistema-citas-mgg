// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
// ✅ IMPORTANTE: Importamos el AuthProvider
import { AuthProvider } from './context/AuthContext'; 

import App from './App.jsx'
import './index.css' 

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* ✅ ENVOLVEMOS LA APP CON EL CONTEXTO DE AUTENTICACIÓN */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)