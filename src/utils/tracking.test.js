import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTurnoTrackingUrl,
  buildCitaTrackingUrl,
  getTrackingTimestampMillis,
  isExpiredTrackingRecord,
} from "./tracking.js";

test("buildTurnoTrackingUrl usa token publico", () => {
  assert.equal(
    buildTurnoTrackingUrl("https://app.example.com", "tok_123"),
    "https://app.example.com/qr-seguimiento?t=tok_123"
  );
});

test("buildCitaTrackingUrl prioriza token y mantiene fallback legacy", () => {
  assert.equal(
    buildCitaTrackingUrl("https://app.example.com", "cita_1", "tok_456"),
    "https://app.example.com/qr-seguimiento?t=tok_456"
  );
  assert.equal(
    buildCitaTrackingUrl("https://app.example.com", "cita_1", ""),
    "https://app.example.com/qr-seguimiento?citaId=cita_1"
  );
});

test("getTrackingTimestampMillis soporta Timestamp-like, Date e ISO string", () => {
  assert.equal(getTrackingTimestampMillis({ toMillis: () => 1234 }), 1234);
  assert.equal(getTrackingTimestampMillis({ seconds: 2 }), 2000);
  assert.equal(getTrackingTimestampMillis(new Date("2026-03-15T00:00:00.000Z")), 1773532800000);
  assert.equal(getTrackingTimestampMillis("2026-03-15T00:00:00.000Z"), 1773532800000);
});

test("isExpiredTrackingRecord detecta expiracion y tolera falta de expiresAt", () => {
  assert.equal(isExpiredTrackingRecord({ expiresAt: { toMillis: () => 1000 } }, 1001), true);
  assert.equal(isExpiredTrackingRecord({ expiresAt: { toMillis: () => 1000 } }, 999), false);
  assert.equal(isExpiredTrackingRecord({}, 1000), false);
});
