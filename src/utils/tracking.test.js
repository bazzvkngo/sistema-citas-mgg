import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTurnoTrackingUrl,
  buildCitaTrackingUrl,
  getTrackingTimestampMillis,
  isExpiredTrackingRecord,
  resolvePublicAppUrl,
} from "./tracking.js";

test("buildTurnoTrackingUrl usa token publico y respeta subruta publica", () => {
  assert.equal(
    buildTurnoTrackingUrl("https://app.example.com/sistema-citas", "tok_123"),
    "https://app.example.com/sistema-citas/qr-seguimiento?t=tok_123"
  );
});

test("buildCitaTrackingUrl prioriza token y mantiene fallback legacy", () => {
  assert.equal(
    buildCitaTrackingUrl("https://app.example.com/sistema-citas", "cita_1", "tok_456"),
    "https://app.example.com/sistema-citas/qr-seguimiento?t=tok_456"
  );
  assert.equal(
    buildCitaTrackingUrl("https://app.example.com/sistema-citas", "cita_1", ""),
    "https://app.example.com/sistema-citas/qr-seguimiento?citaId=cita_1"
  );
});

test("resolvePublicAppUrl combina origin actual con una subruta publica relativa", () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "http://localhost:5173" } };

  try {
    assert.equal(resolvePublicAppUrl("/sistema-citas"), "http://localhost:5173/sistema-citas");
  } finally {
    global.window = originalWindow;
  }
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
