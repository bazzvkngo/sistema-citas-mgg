// 1. Importar las funciones que necesitas del SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Importamos Firestore

// 2. Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB-ydxIRBecXGV0DgpXwNfeLdhI5bZmIH4", // (Esta clave es pública, está bien)
  authDomain: "sistema-de-citas-mgg.firebaseapp.com",
  projectId: "sistema-de-citas-mgg",
  storageBucket: "sistema-de-citas-mgg.firebasestorage.app",
  messagingSenderId: "348376322123",
  appId: "1:348376322123:web:1ab6c6218011e0a9d63dce"
};

// 3. Inicializar la app de Firebase
// ✅ SOLUCIÓN: Añadimos 'export' para que otros archivos puedan importarla.
export const app = initializeApp(firebaseConfig);

// 4. Exportar los servicios que usaremos en la aplicación
export const auth = getAuth(app);
export const db = getFirestore(app);