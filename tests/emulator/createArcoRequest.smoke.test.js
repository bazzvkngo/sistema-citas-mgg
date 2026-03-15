import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { initializeServerApp, deleteApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { collection, getDocs } from "firebase/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const projectId = "sistema-de-citas-mgg";
const region = "southamerica-west1";
const appId = "1:demo:web:demo";
let testEnv;
let app;

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildEmulatorAppCheckToken(subject = appId) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    iss: "https://firebaseappcheck.googleapis.com/demo-emulator",
    aud: projectId,
    sub: subject,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60,
  };

  return `${toBase64Url(header)}.${toBase64Url(payload)}.emulator-signature`;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
    },
  });

  app = initializeServerApp(
    {
      projectId,
      apiKey: "demo-api-key",
      appId,
    },
    {
      appCheckToken: buildEmulatorAppCheckToken(),
    }
  );
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await deleteApp(app);
  await testEnv.cleanup();
});

test("createArcoRequest registra una solicitud en emuladores", async () => {
  const functions = getFunctions(app, region);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  const createArcoRequest = httpsCallable(functions, "createArcoRequest");
  const result = await createArcoRequest({
    type: "acceso",
    requesterName: "Ana Test",
    requesterEmail: "ana@example.com",
    requesterDocument: "AB-123456",
    details: "Solicito acceso a mis datos registrados en el sistema.",
    privacyAccepted: true,
  });

  assert.equal(result.data?.ok, true);
  assert.ok(result.data?.requestId);

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const snap = await getDocs(collection(db, "arcoRequests"));
    assert.equal(snap.size, 1);
    const record = snap.docs[0].data();
    assert.equal(record.type, "acceso");
    assert.equal(record.status, "pendiente");
    assert.equal(record.requesterEmail, "ana@example.com");
    assert.equal(record.source, "web");
    assert.equal(record.privacyAccepted, true);
  });
});
