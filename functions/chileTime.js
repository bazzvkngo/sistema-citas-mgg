const { Timestamp } = require("firebase-admin/firestore");

const CHILE_TZ = "America/Santiago";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;

function getChileDateISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHILE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeChileDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("Missing Chile date value.");
  }

  if (DATE_ONLY_RE.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid Chile date value: ${raw}`);
  }

  return getChileDateISO(parsed);
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function getTimeZoneParts(date, timeZone = CHILE_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getTimeZoneOffsetMilliseconds(date, timeZone = CHILE_TZ) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    0
  );

  const dateWithoutMs = new Date(date.getTime());
  dateWithoutMs.setUTCMilliseconds(0);
  return asUTC - dateWithoutMs.getTime();
}

function parseTimeParts(timeValue) {
  const raw = String(timeValue || "00:00:00.000").trim();
  const match = raw.match(TIME_RE);
  if (!match) {
    throw new Error(`Invalid Chile time value: ${raw}`);
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] || 0),
    millisecond: Number((match[4] || "0").padEnd(3, "0")),
  };
}

function buildChileDateTime(dateValue, timeValue = "00:00:00.000") {
  const dateKey = normalizeChileDateKey(dateValue);
  const [year, month, day] = dateKey.split("-").map(Number);
  const { hour, minute, second, millisecond } = parseTimeParts(timeValue);
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  let offsetMs = 0;
  for (let index = 0; index < 4; index += 1) {
    const candidate = new Date(utcGuessMs - offsetMs);
    const nextOffsetMs = getTimeZoneOffsetMilliseconds(candidate, CHILE_TZ);
    if (nextOffsetMs === offsetMs) {
      return candidate;
    }
    offsetMs = nextOffsetMs;
  }

  return new Date(utcGuessMs - offsetMs);
}

function buildChileDayRange(dateValue) {
  const dateKey = normalizeChileDateKey(dateValue);
  const startDate = buildChileDateTime(dateKey, "00:00:00.000");
  const nextDayStartDate = buildChileDateTime(addDaysToDateKey(dateKey, 1), "00:00:00.000");
  const endDate = new Date(nextDayStartDate.getTime() - 1);

  return {
    dateKey,
    startDate,
    endDate,
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

function getChileDayOfWeek(dateValue) {
  return buildChileDateTime(dateValue, "12:00:00.000").getUTCDay();
}

function formatChileHHmm(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date for Chile hour formatting.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHILE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hh = parts.find((part) => part.type === "hour")?.value ?? "00";
  const mm = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

module.exports = {
  CHILE_TZ,
  buildChileDateTime,
  buildChileDayRange,
  formatChileHHmm,
  getChileDateISO,
  getChileDayOfWeek,
  normalizeChileDateKey,
};
