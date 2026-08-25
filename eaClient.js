/**
 * eaClient.js
 * ------------------------------------------------------------------
 * Este arquivo é o único lugar do projeto que "conversa" diretamente
 * com os servidores da EA (proclubs.ea.com).
 *
 * IMPORTANTE PARA VOCÊ ENTENDER:
 * - Essa API NÃO é oficial nem documentada pela EA.
 * - É a mesma API que o site oficial de rankings da EA
 *   (ea.com/games/ea-sports-fc/clubs/rankings) usa no navegador,
 *   e que sites de terceiros (tipo Pro Clubs Tracker) também usam.
 * - Ela não exige chave de API, login nem senha — é pública.
 * - Ela PODE mudar ou sair do ar sem aviso, porque não é um
 *   contrato oficial da EA com desenvolvedores.
 *
 * Por isso, todo esse código é escrito de forma defensiva: sempre
 * assumindo que a resposta pode vir vazia, incompleta ou dar erro.
 * ------------------------------------------------------------------
 */

const EA_BASE_URL = "https://proclubs.ea.com/api/fc";

// A EA agrupa as plataformas em "pools" de crossplay.
// common-gen5 = PS5 + Xbox Series X|S + PC (geração atual, crossplay)
// common-gen4 = PS4 + Xbox One (geração anterior)
// nx          = Nintendo Switch
//
// Convertendo a escolha do usuário no front-end para o parâmetro
// que a EA espera:
const PLATAFORMA_PARA_EA = {
  pc: "common-gen5",
  playstation: "common-gen5",
  xbox: "common-gen5",
  legado: "common-gen4",
  switch: "nx",
};

function resolverPlataformaEA(plataforma) {
  return PLATAFORMA_PARA_EA[plataforma] || "common-gen5";
}

/**
 * Faz uma requisição GET para um endpoint da API da EA.
 * Adicionamos headers que imitam uma requisição vinda de um
 * navegador comum, porque a EA usa proteção (Akamai) que bloqueia
 * requisições que "não parecem" vir de um navegador.
 *
 * Mesmo assim, isso pode falhar — não há garantia nenhuma da EA.
 */
async function eaGet(path, params = {}) {
  const url = new URL(`${EA_BASE_URL}${path}`);
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, valor);
    }
  });

  // Se a EA não responder em 10 segundos, desistimos da requisição
  // em vez de deixar o usuário esperando pra sempre.
  const controlador = new AbortController();
  const tempoLimite = setTimeout(() => controlador.abort(), 10_000);

  let resposta;
  try {
    resposta = await fetch(url.toString(), {
      method: "GET",
      signal: controlador.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.ea.com/",
        Origin: "https://www.ea.com",
      },
    });
  } catch (erroDeRede) {
    if (erroDeRede.name === "AbortError") {
      throw new Error(`A EA demorou demais para responder em ${path}`);
    }
    throw erroDeRede;
  } finally {
    clearTimeout(tempoLimite);
  }

  if (!resposta.ok) {
    const erro = new Error(
      `A EA respondeu com status ${resposta.status} para ${path}`
    );
    erro.status = resposta.status;
    throw erro;
  }

  // Às vezes a EA retorna corpo vazio mesmo com status 200.
  const texto = await resposta.text();
  if (!texto) return null;

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Resposta da EA não é um JSON válido para ${path}`);
  }
}

/**
 * Busca clubes pelo nome. Retorna uma lista (pode vir vazia).
 * Endpoint descoberto na prática, usado pelo site oficial de rankings.
 */
async function buscarClubesPorNome(nomeClube, plataforma) {
  const plataformaEA = resolverPlataformaEA(plataforma);
  const dados = await eaGet("/allTimeLeaderboard/search", {
    platform: plataformaEA,
    clubName: nomeClube,
  });
  // A EA costuma devolver um array direto, mas alguns ambientes
  // retornam dentro de uma propriedade. Tratamos os dois casos.
  if (Array.isArray(dados)) return dados;
  if (dados && Array.isArray(dados.clubs)) return dados.clubs;
  return [];
}

/** Estatísticas gerais (vitórias, empates, derrotas, gols, etc). */
async function buscarEstatisticasGerais(clubId, plataforma) {
  const plataformaEA = resolverPlataformaEA(plataforma);
  return eaGet("/clubs/overallStats", {
    platform: plataformaEA,
    clubIds: clubId,
  });
}

/** Estatísticas dos jogadores na temporada/período atual. */
async function buscarEstatisticasJogadores(clubId, plataforma) {
  const plataformaEA = resolverPlataformaEA(plataforma);
  return eaGet("/members/stats", {
    platform: plataformaEA,
    clubId,
  });
}

/** Partidas recentes do clube (liga, playoff ou amistoso). */
async function buscarPartidasRecentes(clubId, plataforma, tipo = "leagueMatch") {
  const plataformaEA = resolverPlataformaEA(plataforma);
  return eaGet("/clubs/matches", {
    platform: plataformaEA,
    clubIds: clubId,
    matchType: tipo,
    maxResultCount: 10,
  });
}

module.exports = {
  buscarClubesPorNome,
  buscarEstatisticasGerais,
  buscarEstatisticasJogadores,
  buscarPartidasRecentes,
};
