/**
 * app.js
 * ------------------------------------------------------------------
 * Lógica do front-end. Responsabilidades:
 *  1. Capturar a pesquisa do usuário (nome do clube + plataforma)
 *  2. Chamar o backend (nosso servidor Express) em /api/clube
 *  3. Mostrar o estado certo na tela: carregando, erro, vazio ou
 *     o resultado com as estatísticas.
 *
 * Não fazemos NENHUMA chamada direta para proclubs.ea.com aqui —
 * isso é sempre feito pelo backend, para evitar bloqueio de CORS.
 * ------------------------------------------------------------------
 */

// Pega referências dos elementos da página uma vez só, no início.
const elementos = {
  form: document.getElementById("form-busca"),
  inputNome: document.getElementById("input-nome-clube"),
  inputPlataforma: document.getElementById("input-plataforma"),
  botoesPlataforma: document.querySelectorAll(".busca__plataforma"),

  estadoCarregando: document.getElementById("estado-carregando"),
  estadoErro: document.getElementById("estado-erro"),
  textoErro: document.getElementById("texto-erro"),
  estadoVazio: document.getElementById("estado-vazio"),
  resultado: document.getElementById("resultado"),

  placarDivisao: document.getElementById("placar-divisao"),
  placarNome: document.getElementById("placar-nome"),
  placarSR: document.getElementById("placar-sr"),
  placarPartidas: document.getElementById("placar-partidas"),
  placarAproveitamento: document.getElementById("placar-aproveitamento"),
  placarSaldo: document.getElementById("placar-saldo"),
  placarV: document.getElementById("placar-v"),
  placarE: document.getElementById("placar-e"),
  placarD: document.getElementById("placar-d"),

  golsMarcados: document.getElementById("gols-marcados"),
  golsSofridos: document.getElementById("gols-sofridos"),

  tabelaJogadoresCorpo: document.getElementById("tabela-jogadores-corpo"),
  jogadoresVazio: document.getElementById("jogadores-vazio"),

  listaPartidas: document.getElementById("lista-partidas"),
  partidasVazio: document.getElementById("partidas-vazio"),

  dadosBrutos: document.getElementById("dados-brutos"),
};

let plataformaSelecionada = "pc";

// --- Seleção de plataforma (PC / PlayStation / Xbox) ---
elementos.botoesPlataforma.forEach((botao) => {
  botao.addEventListener("click", () => {
    elementos.botoesPlataforma.forEach((b) => b.classList.remove("is-ativa"));
    botao.classList.add("is-ativa");
    plataformaSelecionada = botao.dataset.plataforma;
    elementos.inputPlataforma.value = plataformaSelecionada;
  });
});

// --- Envio do formulário de busca ---
elementos.form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nomeClube = elementos.inputNome.value.trim();
  if (!nomeClube) return;

  await pesquisarClube(nomeClube, plataformaSelecionada);
});

/**
 * Faz a chamada ao backend e decide qual estado mostrar na tela.
 */
async function pesquisarClube(nome, plataforma) {
  mostrarApenas("carregando");

  try {
    const url = `/api/clube?nome=${encodeURIComponent(
      nome
    )}&plataforma=${encodeURIComponent(plataforma)}`;
    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (resposta.status === 404) {
      mostrarApenas("vazio");
      return;
    }

    if (!resposta.ok) {
      mostrarErro(dados.erro || "Erro ao buscar as estatísticas.");
      return;
    }

    renderizarClube(dados);
    mostrarApenas("resultado");
  } catch (erro) {
    console.error(erro);
    mostrarErro(
      "Não foi possível conectar ao servidor. Verifique se o backend está rodando."
    );
  }
}

/**
 * Controla qual "estado" da página fica visível: carregando, erro,
 * vazio ou o resultado. Só um por vez.
 */
function mostrarApenas(nomeEstado) {
  elementos.estadoCarregando.classList.toggle(
    "estado--oculto",
    nomeEstado !== "carregando"
  );
  elementos.estadoErro.classList.toggle("estado--oculto", nomeEstado !== "erro");
  elementos.estadoVazio.classList.toggle(
    "estado--oculto",
    nomeEstado !== "vazio"
  );
  elementos.resultado.classList.toggle(
    "resultado--oculto",
    nomeEstado !== "resultado"
  );
}

function mostrarErro(mensagem) {
  elementos.textoErro.textContent = mensagem;
  mostrarApenas("erro");
}

// --- Formatação no padrão brasileiro ---
const formatadorNumero = new Intl.NumberFormat("pt-BR");
const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatarValor(valor, sufixo = "") {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "number") return formatadorNumero.format(valor) + sufixo;
  return String(valor);
}

/**
 * Preenche a tela inteira com os dados que vieram do backend.
 * `dados` é o objeto já normalizado (nome, estatisticas, jogadores,
 * partidasRecentes, _bruto) produzido pelo clubService.js.
 */
function renderizarClube(dados) {
  const est = dados.estatisticas || {};

  elementos.placarNome.textContent = dados.nome || "Clube";
  elementos.placarDivisao.textContent = est.divisaoAtual
    ? `Divisão ${est.divisaoAtual}`
    : "Divisão —";

  elementos.placarSR.textContent = formatarValor(est.skillRating);
  elementos.placarPartidas.textContent = formatarValor(est.partidas);
  elementos.placarAproveitamento.textContent =
    est.porcentagemVitorias !== null ? `${est.porcentagemVitorias}%` : "—";
  elementos.placarSaldo.textContent =
    est.saldoDeGols !== null
      ? (est.saldoDeGols > 0 ? "+" : "") + formatarValor(est.saldoDeGols)
      : "—";

  elementos.placarV.textContent = formatarValor(est.vitorias ?? 0);
  elementos.placarE.textContent = formatarValor(est.empates ?? 0);
  elementos.placarD.textContent = formatarValor(est.derrotas ?? 0);

  elementos.golsMarcados.textContent = formatarValor(est.golsMarcados);
  elementos.golsSofridos.textContent = formatarValor(est.golsSofridos);

  renderizarJogadores(dados.jogadores || []);
  renderizarPartidas(dados.partidasRecentes || []);

  elementos.dadosBrutos.textContent = JSON.stringify(dados._bruto, null, 2);
}

function renderizarJogadores(jogadores) {
  elementos.tabelaJogadoresCorpo.innerHTML = "";

  if (jogadores.length === 0) {
    elementos.jogadoresVazio.classList.remove("estado--oculto");
    return;
  }
  elementos.jogadoresVazio.classList.add("estado--oculto");

  jogadores.forEach((jogador) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${escaparHtml(jogador.nome) || "—"}</td>
      <td>${escaparHtml(jogador.posicao) || "—"}</td>
      <td>${formatarValor(jogador.partidas)}</td>
      <td>${formatarValor(jogador.gols)}</td>
      <td>${formatarValor(jogador.assistencias)}</td>
      <td>${
        jogador.notaMedia !== null ? jogador.notaMedia.toFixed(2) : "—"
      }</td>
    `;
    elementos.tabelaJogadoresCorpo.appendChild(linha);
  });
}

function renderizarPartidas(partidas) {
  elementos.listaPartidas.innerHTML = "";

  if (partidas.length === 0) {
    elementos.partidasVazio.classList.remove("estado--oculto");
    return;
  }
  elementos.partidasVazio.classList.add("estado--oculto");

  partidas.forEach((partida) => {
    const item = document.createElement("li");
    item.className = `partida partida--${partida.resultado || ""}`;

    const dataFormatada = partida.dataHora
      ? formatadorData.format(new Date(Number(partida.dataHora) * 1000))
      : "";

    item.innerHTML = `
      <span class="partida__adversario">vs ${
        escaparHtml(partida.nomeAdversario) || "Adversário"
      }</span>
      <span class="partida__placar">${formatarValor(
        partida.golsMeuTime
      )} — ${formatarValor(partida.golsAdversario)}</span>
      <span class="partida__data">${dataFormatada}</span>
    `;
    elementos.listaPartidas.appendChild(item);
  });
}

// Evita que nomes de clube/jogador vindos da EA quebrem o HTML.
function escaparHtml(texto) {
  if (texto === null || texto === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}
