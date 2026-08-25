/**
 * api/clube.js
 * ------------------------------------------------------------------
 * Na Vercel, todo arquivo dentro da pasta /api vira automaticamente
 * uma rota. Este arquivo aqui vira a rota:
 *
 *     GET /api/clube?nome=...&plataforma=...
 *
 * Não existe "servidor ligado o tempo todo" na Vercel — cada
 * requisição roda essa função uma vez (modelo serverless). Por isso
 * o formato é diferente do Express: aqui exportamos uma função
 * `(req, res) => {...}` em vez de usar `app.get(...)`.
 *
 * A lógica em si (buscar o clube, montar o perfil) é EXATAMENTE a
 * mesma dos arquivos em /lib — nada foi duplicado.
 * ------------------------------------------------------------------
 */

const {
  buscarClubesPorNome,
  buscarEstatisticasGerais,
  buscarEstatisticasJogadores,
  buscarPartidasRecentes,
} = require("../lib/eaClient");
const { montarPerfilDoClube } = require("../lib/clubService");

module.exports = async (req, res) => {
  // Só aceitamos GET nessa rota.
  if (req.method !== "GET") {
    res.status(405).json({ erro: "Método não permitido." });
    return;
  }

  const nome = (req.query.nome || "").trim();
  const plataforma = req.query.plataforma || "pc";

  if (!nome) {
    res.status(400).json({ erro: "Informe o nome do clube para pesquisar." });
    return;
  }

  try {
    const clubesEncontrados = await buscarClubesPorNome(nome, plataforma);

    if (!clubesEncontrados || clubesEncontrados.length === 0) {
      res.status(404).json({
        erro: "Nenhum clube encontrado com esse nome nessa plataforma.",
      });
      return;
    }

    const clubeEscolhido =
      clubesEncontrados.find(
        (c) =>
          (c.clubInfo?.name || c.name || "").toLowerCase() ===
          nome.toLowerCase()
      ) || clubesEncontrados[0];

    const clubId =
      clubeEscolhido.clubInfo?.clubId ||
      clubeEscolhido.clubId ||
      clubeEscolhido.clubid;

    if (!clubId) {
      res.status(502).json({
        erro:
          "A EA retornou o clube, mas sem um identificador utilizável. " +
          "O formato da resposta da EA pode ter mudado.",
      });
      return;
    }

    const [estatisticasGerais, estatisticasJogadores, partidas] =
      await Promise.allSettled([
        buscarEstatisticasGerais(clubId, plataforma),
        buscarEstatisticasJogadores(clubId, plataforma),
        buscarPartidasRecentes(clubId, plataforma, "leagueMatch"),
      ]);

    const perfil = montarPerfilDoClube({
      clubesEncontrados,
      clubeEscolhido,
      clubId,
      estatisticasGerais:
        estatisticasGerais.status === "fulfilled"
          ? estatisticasGerais.value
          : null,
      estatisticasJogadores:
        estatisticasJogadores.status === "fulfilled"
          ? estatisticasJogadores.value
          : null,
      partidas: partidas.status === "fulfilled" ? partidas.value : null,
    });

    res.status(200).json(perfil);
  } catch (erro) {
    console.error("Erro ao consultar a API da EA:", erro.message);
    res.status(502).json({
      erro:
        "Não foi possível obter os dados da EA agora. A API " +
        "não-oficial da EA pode estar instável ou fora do ar " +
        "temporariamente. Tente novamente em alguns minutos.",
    });
  }
};
