/**
 * tests/unit/utils.test.js
 * ------------------------------------------------------------------
 * Testes unitários das funções puras em utils.js.
 * Não sobem servidor, não mockam nada — são as funções mais simples e
 * rápidas de testar, e uma boa porta de entrada pra quem for adicionar
 * mais testes no projeto.
 * ------------------------------------------------------------------
 */

const { isValidEmail, addOneMonth } = require("../../utils");

describe("isValidEmail", () => {
  test("aceita um e-mail válido", () => {
    expect(isValidEmail("usuario@exemplo.com")).toBe(true);
  });

  test("aceita e-mail com subdomínio e pontos no usuário", () => {
    expect(isValidEmail("nome.sobrenome@mail.exemplo.com.br")).toBe(true);
  });

  test("rejeita e-mail sem @", () => {
    expect(isValidEmail("usuario.exemplo.com")).toBe(false);
  });

  test("rejeita e-mail sem domínio com ponto", () => {
    expect(isValidEmail("usuario@exemplo")).toBe(false);
  });

  test("rejeita e-mail com espaço", () => {
    expect(isValidEmail("usuario @exemplo.com")).toBe(false);
  });

  test("rejeita string vazia", () => {
    expect(isValidEmail("")).toBe(false);
  });

  test("rejeita valores que não são string (null, undefined, número)", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(12345)).toBe(false);
  });
});

describe("addOneMonth", () => {
  test("soma 1 mês a uma data no meio do ano", () => {
    const data = new Date("2026-03-15T10:00:00.000Z");
    const resultado = addOneMonth(data);

    expect(resultado.getUTCMonth()).toBe(3); // abril (0-indexado)
    expect(resultado.getUTCFullYear()).toBe(2026);
  });

  test("vira o ano corretamente ao somar 1 mês em dezembro", () => {
    const data = new Date("2026-12-10T00:00:00.000Z");
    const resultado = addOneMonth(data);

    expect(resultado.getUTCFullYear()).toBe(2027);
    expect(resultado.getUTCMonth()).toBe(0); // janeiro
  });

  test("não modifica a data original (retorna uma nova instância)", () => {
    const original = new Date("2026-01-01T00:00:00.000Z");
    const originalTimeAntes = original.getTime();

    addOneMonth(original);

    expect(original.getTime()).toBe(originalTimeAntes);
  });
});
