/**
 * tests/mocks/supabaseClientMock.js
 * ------------------------------------------------------------------
 * Mock do módulo "../../supabaseClient" (cliente Supabase server-side),
 * usado nos testes de integração para simular respostas do banco/Auth
 * sem bater no Supabase de verdade.
 *
 * Uso típico em um arquivo de teste:
 *
 *   jest.mock("../../supabaseClient", () => require("../mocks/supabaseClientMock"));
 *   const supabaseMock = require("../../supabaseClient");
 *
 *   // Configurar o retorno de auth.getUser() para este teste:
 *   supabaseMock.auth.getUser.mockResolvedValueOnce({
 *     data: { user: { id: "user-123", email: "teste@exemplo.com" } },
 *     error: null
 *   });
 *
 * O objeto retornado por `.from(...)` é encadeável (select/eq/upsert/
 * update/maybeSingle sempre retornam o próprio builder) e também é
 * "thenable" — pode ser usado com `await` diretamente, do mesmo jeito
 * que os query builders reais do supabase-js — resolvendo para o valor
 * configurado em `__setResolvedValue(...)`.
 * ------------------------------------------------------------------
 */

/**
 * Cria um query builder falso, encadeável e "thenable", que resolve
 * para `resolvedValue` quando aguardado (await) ou quando `.select()`/
 * `.maybeSingle()` é chamado no fim da cadeia.
 *
 * @param {{data?: any, error?: any}} resolvedValue
 */
function createQueryBuilder(resolvedValue = { data: null, error: null }) {
  const builder = {
    from: jest.fn(() => builder),
    select: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(resolvedValue)),
    // Permite trocar o valor resolvido em um teste específico, por
    // exemplo: query.__setResolvedValue({ data: [...], error: null })
    __setResolvedValue(value) {
      resolvedValue = value;
    },
    // Torna o builder "thenable", para suportar `await supabase.from(...).update(...).eq(...)`
    // sem precisar de `.select()`/`.maybeSingle()` no fim da cadeia
    // (é assim que alguns handlers de webhook usam o supabase-js real).
    then(resolve, reject) {
      return Promise.resolve(resolvedValue).then(resolve, reject);
    }
  };

  return builder;
}

const supabaseMock = {
  auth: {
    getUser: jest.fn()
  },
  // `.from()` sempre devolve um builder novo que resolve para
  // { data: null, error: null } por padrão — configure com
  // `.__setResolvedValue(...)` dentro do teste quando precisar de outro
  // retorno.
  from: jest.fn(() => createQueryBuilder())
};

module.exports = supabaseMock;
