/**
 * server.js
 * ------------------------------------------------------------------
 * Este arquivo é só para você rodar o projeto no seu computador
 * durante o desenvolvimento (`npm run dev`). A Vercel NÃO usa este
 * arquivo — lá, cada arquivo dentro de /api já vira uma rota
 * automaticamente, sem precisar de um servidor Express.
 *
 * Aqui a gente só "empresta" a mesma função de api/clube.js e a
 * pluga numa rota Express, pra você poder testar tudo em
 * http://localhost:3000 antes de subir pro GitHub/Vercel.
 * ------------------------------------------------------------------
 */

const path = require("path");
const express = require("express");
const handlerClube = require("./api/clube");

const app = express();
const PORTA = process.env.PORT || 3000;

// Serve os arquivos estáticos (index.html, css/, js/) da raiz do projeto.
app.use(express.static(__dirname));

// Reaproveita a mesma função serverless usada na Vercel.
app.get("/api/clube", (req, res) => handlerClube(req, res));

app.listen(PORTA, () => {
  console.log(`Servidor local rodando em http://localhost:${PORTA}`);
});
