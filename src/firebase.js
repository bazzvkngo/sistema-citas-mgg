// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "sistema-de-citas-mgg.firebaseapp.com",
  projectId: "sistema-de-citas-mgg",
  storageBucket: "sistema-de-citas-mgg.firebasestorage.app",
  messagingSenderId: "348376322123",
  appId: "1:348376322123:web:1ab6c6218011e0a9d63dce"
};

export const app = initializeApp(firebaseConfig);

const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || "").trim();
const appCheckDebugToken = String(import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || "").trim();
const isBrowser = typeof window !== "undefined";
const isLocalhost =
  isBrowser && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const isLocalAppCheckEnvironment = import.meta.env.DEV || isLocalhost;

if (isBrowser && appCheckDebugToken && !isLocalAppCheckEnvironment) {
  console.warn("[App Check] Ignorando debug token fuera de localhost/desarrollo.");
}

if (isBrowser && appCheckDebugToken && isLocalAppCheckEnvironment) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN =
    appCheckDebugToken === "true" ? true : appCheckDebugToken;
}

if (!appCheckSiteKey && import.meta.env.PROD) {
  console.warn("[App Check] Falta VITE_FIREBASE_APPCHECK_SITE_KEY en produccion.");
}

export const appCheck = appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

export const auth = getAuth(app);

// 👇 db EXPORTADO (esto es lo que te está faltando “según el navegador”)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

export const functions = getFunctions(app, "southamerica-west1");
