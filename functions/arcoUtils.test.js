const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeEmailServer,
  isValidEmailServer,
  normalizeSingleLineTextServer,
  normalizeMultilineTextServer,
  normalizeArcoTypeServer,
  normalizeArcoStatusServer,
  isArcoFinalStatus,
  normalizeRequesterDocumentServer,
  isValidRequesterDocumentServer,
} = require("./arcoUtils");

test("normaliza correo y valida formato", () => {
  assert.equal(normalizeEmailServer("  USER@Example.COM "), "user@example.com");
  assert.equal(isValidEmailServer("user@example.com"), true);
  assert.equal(isValidEmailServer("correo-invalido"), false);
});

test("normaliza textos ARCO y recorta longitud", () => {
  assert.equal(normalizeSingleLineTextServer("  Ana   Maria  "), "Ana Maria");
  assert.equal(normalizeMultilineTextServer(" linea 1 \r\nlinea 2 "), "linea 1 \nlinea 2");
  assert.equal(normalizeSingleLineTextServer("abcdef", 3), "abc");
});

test("normaliza y valida tipos/estados ARCO", () => {
  assert.equal(normalizeArcoTypeServer(" Acceso "), "acceso");
  assert.equal(normalizeArcoTypeServer("otra-cosa"), "");
  assert.equal(normalizeArcoStatusServer(" Rechazada "), "rechazada");
  assert.equal(normalizeArcoStatusServer("otro"), "");
  assert.equal(isArcoFinalStatus("resuelta"), true);
  assert.equal(isArcoFinalStatus("rechazada"), true);
  assert.equal(isArcoFinalStatus("pendiente"), false);
});

test("normaliza y valida documento del solicitante", () => {
  assert.equal(normalizeRequesterDocumentServer("  ab-123 456 "), "AB-123 456");
  assert.equal(isValidRequesterDocumentServer("AB-123 456"), true);
  assert.equal(isValidRequesterDocumentServer("abc"), false);
});
