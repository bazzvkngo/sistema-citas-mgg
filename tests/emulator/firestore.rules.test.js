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
