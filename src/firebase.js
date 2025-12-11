// 1. Importar las funciones que necesitas del SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Importamos Firestore

// 2. Tu configuración de Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "sistema-de-citas-mgg.firebaseapp.com",
  projectId: "sistema-de-citas-mgg",
  storageBucket: "sistema-de-citas-mgg.appspot.com",
  messagingSenderId: "XXXXXXXXXXXX",
  appId: "1:XXXXXXXXXXXX:web:XXXXXXXXXXXXXX",
};

// 3. Inicializar la app de Firebase
// ✅ SOLUCIÓN: Añadimos 'export' para que otros archivos puedan importarla.
export const app = initializeApp(firebaseConfig);

// 4. Exportar los servicios que usaremos en la aplicación
export const auth = getAuth(app);
export const db = getFirestore(app);