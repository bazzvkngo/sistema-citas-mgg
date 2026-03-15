import test, { after, afterEach, before } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectId = "sistema-de-citas-mgg";
const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

async function seedBasicDocs() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "trackingPublic", "tok_public"), {
      sourceCollection: "turnos",
      sourceId: "turno_1",
      codigo: "A-001",
      estado: "en-espera",
      tramiteID: "tramite_demo",
      modulo: null,
      createdAt: new Date("2026-03-15T00:00:00.000Z"),
      updatedAt: new Date("2026-03-15T00:00:00.000Z"),
    });
    await setDoc(doc(db, "arcoRequests", "arco_1"), {
      type: "acceso",
      status: "pendiente",
      requesterName: "Ana Test",
      requesterEmail: "ana@example.com",
      requesterDocument: "AB-123456",
    });
    await setDoc(doc(db, "turnos", "turno_1"), {
      codigo: "A-001",
      estado: "en-espera",
      dni: "12345678K",
      tramiteID: "tramite_demo",
    });
    await setDoc(doc(db, "estadoSistema", "llamadaActual"), {
      codigoLlamado: "A-001",
      modulo: 1,
    });
    await setDoc(doc(db, "estadoSistema", "tramite_demo"), {
      codigoLlamado: "A-001",
      modulo: 1,
    });
    await setDoc(doc(db, "estadoSistema", "interno_privado"), {
      secreto: true,
    });
    await setDoc(doc(db, "config", "pantallaTV"), {
      enabled: true,
      url: "https://example.com/ad.mp4",
    });
    await setDoc(doc(db, "usuarios", "pantalla_1"), {
      rol: "pantalla",
    });
    await setDoc(doc(db, "usuarios", "admin_1"), {
      rol: "admin",
    });
  });
}

test("permite leer un documento puntual de trackingPublic de forma publica", async () => {
  await seedBasicDocs();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "trackingPublic", "tok_public")));
});

test("deniega listar trackingPublic en cliente", async () => {
  await seedBasicDocs();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(query(collection(db, "trackingPublic"))));
});

test("deniega leer y listar arcoRequests como cliente no admin", async () => {
  await seedBasicDocs();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "arcoRequests", "arco_1")));
  await assertFails(getDocs(query(collection(db, "arcoRequests"))));
});

test("deniega leer turnos publicamente", async () => {
  await seedBasicDocs();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "turnos", "turno_1")));
});

test("permite leer llamadaActual y tramite_* publicamente, pero no otros docs de estadoSistema", async () => {
  await seedBasicDocs();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "estadoSistema", "llamadaActual")));
  await assertSucceeds(getDoc(doc(db, "estadoSistema", "tramite_demo")));
  await assertFails(getDoc(doc(db, "estadoSistema", "interno_privado")));
  await assertFails(getDocs(query(collection(db, "estadoSistema"))));
});

test("deniega config publicamente y permite lectura a pantalla autenticada", async () => {
  await seedBasicDocs();
  const publicDb = testEnv.unauthenticatedContext().firestore();
  const pantallaDb = testEnv.authenticatedContext("pantalla_1").firestore();
  await assertFails(getDoc(doc(publicDb, "config", "pantallaTV")));
  await assertSucceeds(getDoc(doc(pantallaDb, "config", "pantallaTV")));
});
