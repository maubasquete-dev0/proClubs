/**
 * clubService.js
 * ------------------------------------------------------------------
 * A API da EA não é documentada, então os nomes dos campos que ela
 * devolve podem variar ou não ser 100% previsíveis. Este arquivo
 * pega a resposta "crua" da EA e tenta montar um objeto limpo e
 * previsível para o front-end usar — sem esconder nada, mas também
 * sem quebrar o site se algum campo não existir.
 *
 * Se um valor não for encontrado, usamos `null`. O front-end sabe
 * mostrar "—" quando o valor é null, em vez de mostrar "undefined"
 * ou quebrar a página.
 * ------------------------------------------------------------------
 */

// Pega o primeiro valor não-nulo dentre várias possíveis chaves.
// Isso protege o código contra pequenas variações de nome de campo
// que a API da EA pode ter (ex: "ties" vs "draws").
function pegarPrimeiroValido(objeto, chaves) {
  if (!objeto) return null;
  for (const chave of chaves) {
    if (objeto[chave] !== undefined && objeto[chave] !== null) {
      return objeto[chave];
    }
  }
  return null;
}

function paraNumero(valor) {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
}

function calcularPorcentagemVitorias(vitorias, partidas) {
  if (!vitorias || !partidas) return null;
  return Math.round((vitorias / partidas) * 1000) / 10; // 1 casa decimal
}

/**
 * A EA às vezes devolve `overallStats` como um array com 1 item,
 * às vezes como objeto único, e às vezes como objeto indexado pelo
 * próprio clubId (ex: { "123456": {...} }). Esta função normaliza
 * todos esses formatos para um objeto simples.
 */
function extrairPrimeiroRegistro(dados, clubId) {
  if (!dados) return null;
  if (Array.isArray(dados)) return dados[0] || null;
  if (dados[clubId]) return dados[clubId];
  // Objeto único direto
  if (typeof dados === "object") return dados;
  return null;
}

function normalizarEstatisticasGerais(dadosBrutos, clubId) {
  const registro = extrairPrimeiroRegistro(dadosBrutos, clubId);
  if (!registro) return null;

  const vitorias = paraNumero(pegarPrimeiroValido(registro, ["wins"]));
  const empates = paraNumero(
    pegarPrimeiroValido(registro, ["ties", "draws"])
  );
  const derrotas = paraNumero(pegarPrimeiroValido(registro, ["losses"]));
  const partidas = paraNumero(
    pegarPrimeiroValido(registro, ["gamesPlayed", "gamesPlayedLeague"])
  ) ?? (vitorias !== null && empates !== null && derrotas !== null
    ? vitorias + empates + derrotas
    : null);

  const golsMarcados = paraNumero(pegarPrimeiroValido(registro, ["goals"]));
  const golsSofridos = paraNumero(
    pegarPrimeiroValido(registro, ["goalsAgainst"])
  );

  return {
    divisaoAtual: pegarPrimeiroValido(registro, [
      "currentDivision",
      "division",
    ]),
    melhorDivisao: pegarPrimeiroValido(registro, ["bestDivision"]),
    skillRating: paraNumero(
      pegarPrimeiroValido(registro, ["skillRating", "leagueSkillRating"])
    ),
    partidas,
    vitorias,
    empates,
    derrotas,
    porcentagemVitorias: calcularPorcentagemVitorias(vitorias, partidas),
    golsMarcados,
    golsSofridos,
    saldoDeGols:
      golsMarcados !== null && golsSofridos !== null
        ? golsMarcados - golsSofridos
        : null,
    tituloConquistados: paraNumero(
      pegarPrimeiroValido(registro, ["titlesWon"])
    ),
    sequenciaVitorias: paraNumero(pegarPrimeiroValido(registro, ["wstreak"])),
  };
}

function normalizarJogador(jogadorBruto) {
  const partidas = paraNumero(
    pegarPrimeiroValido(jogadorBruto, ["gamesPlayed"])
  );
  const notaMedia = paraNumero(
    pegarPrimeiroValido(jogadorBruto, ["ratingAve", "averageRating"])
  );

  return {
    nome: pegarPrimeiroValido(jogadorBruto, ["name", "playername"]),
    posicao: pegarPrimeiroValido(jogadorBruto, ["proPos", "favoritePosition"]),
    partidas,
    gols: paraNumero(pegarPrimeiroValido(jogadorBruto, ["goals"])),
    assistencias: paraNumero(
      pegarPrimeiroValido(jogadorBruto, ["assists"])
    ),
    notaMedia,
    craqueDaPartida: paraNumero(
      pegarPrimeiroValido(jogadorBruto, ["manOfTheMatch"])
    ),
    precisaoDePasse: paraNumero(
      pegarPrimeiroValido(jogadorBruto, ["passSuccessRate", "passesMade"])
    ),
  };
}

function normalizarJogadores(dadosBrutos) {
  if (!dadosBrutos) return [];
  const lista = Array.isArray(dadosBrutos)
    ? dadosBrutos
    : Object.values(dadosBrutos);
  return lista
    .filter((item) => item && typeof item === "object")
    .map(normalizarJogador)
    // Jogadores com mais partidas aparecem primeiro.
    .sort((a, b) => (b.partidas || 0) - (a.partidas || 0));
}

function normalizarPartida(partidaBruta, clubId) {
  const clubes = partidaBruta.clubs || {};
  const timeIds = Object.keys(clubes);
  const meuTimeId = timeIds.find((id) => String(id) === String(clubId));
  const adversarioId = timeIds.find((id) => String(id) !== String(clubId));

  const meuTime = meuTimeId ? clubes[meuTimeId] : null;
  const adversario = adversarioId ? clubes[adversarioId] : null;

  const golsMeuTime = paraNumero(
    pegarPrimeiroValido(meuTime || {}, ["goals", "score"])
  );
  const golsAdversario = paraNumero(
    pegarPrimeiroValido(adversario || {}, ["goals", "score"])
  );

  let resultado = null;
  if (golsMeuTime !== null && golsAdversario !== null) {
    if (golsMeuTime > golsAdversario) resultado = "vitoria";
    else if (golsMeuTime < golsAdversario) resultado = "derrota";
    else resultado = "empate";
  }

  return {
    dataHora: pegarPrimeiroValido(partidaBruta, ["timestamp"]),
    nomeAdversario:
      pegarPrimeiroValido(adversario || {}, ["details", "name"]) ||
      (adversario && adversario.details && adversario.details.name) ||
      "Adversário",
    golsMeuTime,
    golsAdversario,
    resultado,
  };
}

function normalizarPartidas(dadosBrutos, clubId) {
  if (!dadosBrutos || !Array.isArray(dadosBrutos)) return [];
  return dadosBrutos.map((partida) => normalizarPartida(partida, clubId));
}

/**
 * Junta tudo em um único objeto pronto para o front-end.
 * Também devolve os dados "crus" da EA em `_bruto`, para você
 * conseguir inspecionar no navegador (aba Network ou console) caso
 * algum campo não esteja aparecendo certo — já que a API não é
 * documentada, isso ajuda a ajustar o `clubService.js` no futuro.
 */
function montarPerfilDoClube({
  clubeEscolhido,
  clubId,
  estatisticasGerais,
  estatisticasJogadores,
  partidas,
}) {
  const nomeClube =
    clubeEscolhido.clubInfo?.name || clubeEscolhido.name || "Clube";

  return {
    clubId,
    nome: nomeClube,
    estatisticas: normalizarEstatisticasGerais(estatisticasGerais, clubId),
    jogadores: normalizarJogadores(estatisticasJogadores),
    partidasRecentes: normalizarPartidas(partidas, clubId),
    _bruto: {
      estatisticasGerais,
      estatisticasJogadores,
      partidas,
    },
  };
}

module.exports = { montarPerfilDoClube };
