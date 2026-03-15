export function buildTurnoTrackingUrl(origin, trackingToken) {
  return `${origin}/qr-seguimiento?t=${trackingToken}`;
}

export function buildCitaTrackingUrl(origin, citaId, trackingToken) {
  if (trackingToken) {
    return buildTurnoTrackingUrl(origin, trackingToken);
  }
  return `${origin}/qr-seguimiento?citaId=${citaId}`;
}

export function getTrackingTimestampMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  const parsed = new Date(ts);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null;
}

export function isExpiredTrackingRecord(data, nowMs = Date.now()) {
  const expiresAtMs = getTrackingTimestampMillis(data?.expiresAt);
  if (expiresAtMs == null) return false;
  return expiresAtMs <= nowMs;
}
