const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const projectId = "sistema-de-citas-mgg";
const hasFirestoreEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const testFn = hasFirestoreEmulator ? test : test.skip;

process.env.GCLOUD_PROJECT = projectId;

let testEnv;
let adminDb;
let cleanupTrackingPublic;
let cleanupAuditLogs;
let adminExportAuditRecords;

async function seedDoc(path, data) {
  const ref = adminDb.doc(path);
  await ref.set(data);
}

async function getDocData(path) {
  const snap = await adminDb.doc(path).get();
  return snap.exists ? snap.data() : null;
}

async function listCollection(collectionName) {
  const snap = await adminDb.collection(collectionName).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

if (hasFirestoreEmulator) {
  test.before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
      },
    });
    ({
      cleanupTrackingPublic,
      cleanupAuditLogs,
      adminExportAuditRecords,
    } = require("./index.js"));
    adminDb = getFirestore();
  });

  test.afterEach(async () => {
    await testEnv.clearFirestore();
  });

  test.after(async () => {
    await testEnv.cleanup();
  });
}

testFn("cleanupTrackingPublic elimina solo documentos expirados", async () => {
  const nowMs = Date.now();
  await seedDoc("trackingPublic/expired_token", {
    codigo: "A-001",
    estado: "completado",
    expiresAt: Timestamp.fromMillis(nowMs - 60_000),
  });
  await seedDoc("trackingPublic/fresh_token", {
    codigo: "A-002",
    estado: "en-espera",
    expiresAt: Timestamp.fromMillis(nowMs + 60 * 60 * 1000),
  });

  await cleanupTrackingPublic.run({});

  assert.equal(await getDocData("trackingPublic/expired_token"), null);
  assert.ok(await getDocData("trackingPublic/fresh_token"));
});

testFn("cleanupAuditLogs respeta la ventana de retencion tecnica", async () => {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  await seedDoc("auditLogs/old_log", {
    action: "old_event",
    entityType: "turnos",
    entityId: "turno_old",
    timestamp: Timestamp.fromMillis(nowMs - 181 * dayMs),
  });
  await seedDoc("auditLogs/recent_log", {
    action: "recent_event",
    entityType: "turnos",
    entityId: "turno_recent",
    timestamp: Timestamp.fromMillis(nowMs - 10 * dayMs),
  });

  await cleanupAuditLogs.run({});

  assert.equal(await getDocData("auditLogs/old_log"), null);
  assert.ok(await getDocData("auditLogs/recent_log"));
});

testFn("adminExportAuditRecords exporta auditLogs filtrados y registra la accion", async () => {
  await seedDoc("usuarios/admin_test", {
    rol: "admin",
  });

  await seedDoc("auditLogs/log_in_range", {
    action: "create_turno_kiosko",
    entityType: "turnos",
    entityId: "turno_1",
    timestamp: Timestamp.fromDate(new Date("2026-03-15T12:00:00.000Z")),
    summary: "Turno generado.",
  });
  await seedDoc("auditLogs/log_out_range", {
    action: "create_cita_web",
    entityType: "citas",
    entityId: "cita_1",
    timestamp: Timestamp.fromDate(new Date("2026-02-01T12:00:00.000Z")),
    summary: "Cita generada.",
  });

  const result = await adminExportAuditRecords.run({
    auth: { uid: "admin_test" },
    data: {
      collectionName: "auditLogs",
      startDateISO: "2026-03-15",
      endDateISO: "2026-03-15",
      limit: 50,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.collectionName, "auditLogs");
  assert.equal(result.count, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].id, "log_in_range");
  assert.equal(result.records[0].timestamp, "2026-03-15T12:00:00.000Z");

  const auditLogs = await listCollection("auditLogs");
  const exportAuditEntry = auditLogs.find((entry) => entry.action === "export_audit_records");
  assert.ok(exportAuditEntry);
  assert.equal(exportAuditEntry.entityType, "auditLogs");
  assert.equal(exportAuditEntry.actorUid, "admin_test");
});
