const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const {
  AUDIT_LOG_RETENTION_DAYS,
  SERVICE_AUDIT_RETENTION_DAYS,
  buildAuditLogRetentionFields,
  buildServiceAuditMetadata,
  normalizeAuditExportInput,
  serializeAuditValue,
} = require("./auditPolicy");

test("buildAuditLogRetentionFields agrega retencion y purgeAfter", () => {
  const nowTs = Timestamp.fromMillis(Date.parse("2026-03-15T12:00:00.000Z"));
  const result = buildAuditLogRetentionFields(nowTs);

  assert.equal(result.retentionPolicy, "auditLogs_v1");
  assert.equal(result.retentionDays, AUDIT_LOG_RETENTION_DAYS);
  assert.equal(result.exportable, true);
  assert.equal(result.exportScope, "admin");
  assert.deepEqual(result.exportFormats, ["json"]);
  assert.equal(
    result.purgeAfter.toMillis(),
    nowTs.toMillis() + AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
});

test("buildServiceAuditMetadata agrega retencion exportable sin cambiar version", () => {
  const nowTs = Timestamp.fromMillis(Date.parse("2026-03-15T12:00:00.000Z"));
  const result = buildServiceAuditMetadata(nowTs);

  assert.equal(result.version, 1);
  assert.equal(result.createdBy, "CF_TRIGGER");
  assert.equal(result.retentionPolicy, "serviceAudit_v1");
  assert.equal(result.retentionDays, SERVICE_AUDIT_RETENTION_DAYS);
  assert.equal(result.exportable, true);
  assert.equal(result.exportScope, "admin");
  assert.deepEqual(result.exportFormats, ["json"]);
  assert.equal(
    result.retentionUntil.toMillis(),
    nowTs.toMillis() + SERVICE_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
});

test("normalizeAuditExportInput aplica defaults y valida limites", () => {
  const result = normalizeAuditExportInput(
    { collectionName: "auditLogs", endDateISO: "2026-03-15" },
    new Date("2026-03-15T20:00:00.000Z")
  );

  assert.equal(result.collectionName, "auditLogs");
  assert.equal(result.endDateISO, "2026-03-15");
  assert.equal(result.startDateISO, "2026-02-13");
  assert.equal(result.rangeDays, 31);
  assert.equal(result.limit, 200);
});

test("normalizeAuditExportInput rechaza rangos mayores al maximo", () => {
  assert.throws(
    () =>
      normalizeAuditExportInput({
        collectionName: "serviceAudit",
        startDateISO: "2026-01-01",
        endDateISO: "2026-02-15",
      }),
    /rango maximo/
  );
});

test("serializeAuditValue convierte timestamps y objetos anidados a JSON seguro", () => {
  const result = serializeAuditValue({
    createdAt: Timestamp.fromMillis(Date.parse("2026-03-15T12:00:00.000Z")),
    nested: {
      updatedAt: Timestamp.fromMillis(Date.parse("2026-03-16T08:30:00.000Z")),
    },
    list: [Timestamp.fromMillis(Date.parse("2026-03-17T00:00:00.000Z")), "ok"],
  });

  assert.deepEqual(result, {
    createdAt: "2026-03-15T12:00:00.000Z",
    nested: {
      updatedAt: "2026-03-16T08:30:00.000Z",
    },
    list: ["2026-03-17T00:00:00.000Z", "ok"],
  });
});
