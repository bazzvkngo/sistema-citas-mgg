const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChileDateTime,
  buildChileDayRange,
  formatChileHHmm,
  getChileDateISO,
  getChileDayOfWeek,
  normalizeChileDateKey,
} = require("./chileTime");

test("normalizeChileDateKey acepta fecha YYYY-MM-DD y fecha ISO", () => {
  assert.equal(normalizeChileDateKey("2026-05-10"), "2026-05-10");
  assert.equal(normalizeChileDateKey("2026-05-10T04:00:00.000Z"), "2026-05-10");
});

test("buildChileDateTime respeta horario de verano e invierno en Chile", () => {
  const marchDate = buildChileDateTime("2026-03-10", "09:00");
  const mayDate = buildChileDateTime("2026-05-10", "09:00");

  assert.equal(marchDate.toISOString(), "2026-03-10T12:00:00.000Z");
  assert.equal(mayDate.toISOString(), "2026-05-10T13:00:00.000Z");
  assert.equal(formatChileHHmm(marchDate), "09:00");
  assert.equal(formatChileHHmm(mayDate), "09:00");
});

test("buildChileDayRange mantiene el mismo dia calendario en Chile", () => {
  const { startDate, endDate } = buildChileDayRange("2026-05-10");

  assert.equal(getChileDateISO(startDate), "2026-05-10");
  assert.equal(getChileDateISO(endDate), "2026-05-10");
  assert.equal(endDate.getTime() > startDate.getTime(), true);
});

test("getChileDayOfWeek usa el calendario de Chile", () => {
  assert.equal(getChileDayOfWeek("2026-05-09"), 6);
  assert.equal(getChileDayOfWeek("2026-05-10"), 0);
  assert.equal(getChileDayOfWeek("2026-05-11"), 1);
});
