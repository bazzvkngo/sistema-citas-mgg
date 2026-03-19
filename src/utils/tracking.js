const CONFIGURED_PUBLIC_APP_URL = import.meta.env?.VITE_PUBLIC_APP_URL || "";
const ROUTER_BASE_URL = import.meta.env?.BASE_URL || "/";

function stripTrailingSlashes(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeBasePath(value) {
  const trimmed = stripTrailingSlashes(value);
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildTrackingPath(paramName, paramValue) {
  return `/qr-seguimiento?${paramName}=${encodeURIComponent(String(paramValue || "").trim())}`;
}

export function resolvePublicAppUrl(explicitBaseUrl) {
  const configuredBaseUrl = stripTrailingSlashes(explicitBaseUrl || CONFIGURED_PUBLIC_APP_URL);
  if (configuredBaseUrl) {
    if (/^https?:\/\//i.test(configuredBaseUrl)) {
      return configuredBaseUrl;
    }

    if (configuredBaseUrl.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${normalizeBasePath(configuredBaseUrl)}`;
    }

    return normalizeBasePath(configuredBaseUrl);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${normalizeBasePath(ROUTER_BASE_URL)}`;
  }

  return normalizeBasePath(ROUTER_BASE_URL);
}

export function buildTurnoTrackingUrl(baseUrl, trackingToken) {
  return `${resolvePublicAppUrl(baseUrl)}${buildTrackingPath("t", trackingToken)}`;
}

export function buildCitaTrackingUrl(baseUrl, citaId, trackingToken) {
  if (trackingToken) {
    return buildTurnoTrackingUrl(baseUrl, trackingToken);
  }
  return `${resolvePublicAppUrl(baseUrl)}${buildTrackingPath("citaId", citaId)}`;
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
