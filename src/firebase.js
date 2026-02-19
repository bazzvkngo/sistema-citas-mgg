// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "sistema-de-citas-mgg.firebaseapp.com",
  projectId: "sistema-de-citas-mgg",
  storageBucket: "sistema-de-citas-mgg.appspot.com",
  messagingSenderId: "XXXXXXXXXXXX",
  appId: "1:XXXXXXXXXXXX:web:XXXXXXXXXXXXXX",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 👇 db EXPORTADO (esto es lo que te está faltando “según el navegador”)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

export const functions = getFunctions(app, "southamerica-west1");
