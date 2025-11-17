# API Info — Projeto `trabalho-dvweb`

Este documento descreve a API REST e os eventos Socket.IO usados pelo projeto "trabalho-dvweb" (aplicação React + Mock backend). O objetivo é fornecer informação clara sobre o que é a API, como foi implementada e qual a sua função no projeto.

---

## O que é

A API do projeto é um backend leve que combina:

- Uma API REST (HTTP/JSON) para operações CRUD em dois recursos principais:
  - `usuarios` — informações de usuários (cadastro, senha, vitórias/derrotas etc.).
  - `games` — salas/partidas (criadas para pareamento e controle do estado de um jogo 1v1).
- Um canal em tempo real via **Socket.IO** (WebSocket fallback) para sincronizar eventos entre clientes (lista de salas, atualizações de partida, ready, ataque, início de jogo).

A persistência é feita em um arquivo local `db.json` (simulando um banco de dados leve). Esta arquitetura é adequada para protótipos e desenvolvimento local.

---

## Como foi implementada

Arquivos principais:
- `server/index.js` — servidor Node/Express + Socket.IO.
- `db.json` — arquivo JSON com arrays `usuarios` e `games` para armazenar dados.
- `src/api/api.js` — cliente Axios configurado para apontar para o backend (ex.: `http://localhost:4000`).
- `src/socket.js` — cliente Socket.IO usado por componentes React.

Detalhes da implementação:
- O servidor expõe endpoints REST (`/usuarios`, `/games`) com métodos GET, POST, PUT/PATCH e DELETE conforme apropriado.
- Ao criar/atualizar partidas via REST, o servidor emite eventos Socket.IO (`games:list`, `game:update`) para manter a UI sincronizada.
- Eventos importantes no servidor Socket.IO: `join`, `join_game`, `player_ready`, `attack`.
- O servidor manipula `hostReady` e `opponentReady` para o mecanismo "Pronto"; quando ambos prontos, agenda uma transição `starting` → `playing` após 3 segundos (campo `startAt` é usado para sincronizar countdown no cliente).
- Ao finalizar uma partida online (host e opponent definidos), o servidor incrementa `wins` do vencedor e `losses` do derrotado no `db.json`.

Observações:
- `db.json` é escrito com `fs.writeFileSync` — não é concorrencialmente seguro para produção, mas suficiente para desenvolvimento local.
- Eventos críticos (como `join_game`) foram implementados no servidor para evitar condições de corrida ao parear jogadores.

---

## Endpoints REST — resumo e exemplos

### `GET /usuarios`
Retorna a lista de usuários.
Exemplo: `GET http://localhost:4000/usuarios`

### `POST /usuarios`
Cria um novo usuário. O servidor gera `id`.
Exemplo corpo JSON:
```json
{
  "nome": "pato",
  "senha": "123456",
  "wins": 0,
  "losses": 0
}
```
Resposta: objeto criado com `id`.

### `PUT /usuarios/:id`
Atualiza um usuário (merge) e retorna o objeto atualizado.

### `DELETE /usuarios/:id`
Remove um usuário.

---

### `GET /games`
Lista todas as salas/partidas.

### `GET /games/:id`
Retorna a partida com o `id` especificado (404 se não existir).

### `POST /games`
Cria uma nova sala/partida. Inicializa campos relevantes:
- `id`, `hostId`, `opponentId`, `status` (`waiting` por padrão)
- `hostHP`: 50, `opponentHP`: 50
- `hostReady`: false, `opponentReady`: false
- `createdAt`

Exemplo corpo:
```json
{ "hostId": "<user-id>", "status": "waiting" }
```

### `PATCH /games/:id`
Atualiza campos do jogo (ex.: `opponentId`, `status`, `hostHP`, `opponentHP`, `hostReady` etc.) e emite eventos de atualização.

---

## Socket.IO — eventos (cliente ↔ servidor)

Eventos que o cliente emite (para o servidor):
- `join` — `socket.emit('join', { gameId, playerId })` — faz o socket entrar na sala `game_<id>` e solicitar o estado atual.
- `join_game` — `socket.emit('join_game', { gameId, playerId }, callback)` — pede ao servidor para entrar de forma atômica na sala (servidor atribui `opponentId` se houver vaga); callback confirma sucesso/erro.
- `player_ready` — `socket.emit('player_ready', { gameId, playerId, ready })` — alterna o estado pronto do jogador. Se ambos prontos, servidor agenda transição `starting` (com `startAt`) → `playing` em 3s.
- `attack` — `socket.emit('attack', { gameId, playerId })` — o servidor aplica o ataque, atualiza HP e, se finalizar partida entre dois jogadores, atualiza `wins`/`losses` no `db.json`.

Eventos emitidos pelo servidor (clientes devem escutar):
- `games:list` — lista atualizada de todas as salas.
- `game:update` — estado atualizado de uma partida específica (emitido para `game_<id>` e broadcast quando necessário).
- `game:finished` — quando a partida termina.

---

## Papel da API no projeto

- Autenticação simples / identidade: serve para armazenar usuários (nome e senha em texto no protótipo — **não seguro** para produção). O cliente grava `userId` no `localStorage` após login para identificar o jogador.
- Pareamento: as salas (`games`) funcionam como pontos de encontro para dois jogadores. A API REST permite criar/listar/atualizar salas, enquanto o Socket.IO garante que as UIs de ambos os jogadores recebam atualizações instantâneas.
- Sincronização de jogo: ações de jogo (ready, attack, início de partida) são transmitidas em tempo real via Socket.IO; o server é a fonte de verdade e grava no `db.json`.
- Estatísticas: o servidor atualiza `wins`/`losses` quando uma partida entre dois jogadores termina; jogos locais (vs IA) não afetam esse registro.

---

## Como executar (desenvolvimento local)

1. Iniciar servidor (Node + Socket.IO):
```powershell
cd c:\VSCode-projects\trabalho-dvweb\server
npm install   # se necessário
node index.js
# (server por padrão na porta 4000)
```
2. Ajustar `src/api/api.js` para apontar para `http://localhost:4000` (se necessário).
3. Iniciar frontend (Vite):
```powershell
cd c:\VSCode-projects\trabalho-dvweb
npm install
npm run dev
```
4. Abra `http://localhost:5173` no navegador.

---

## Testes e fluxo típico

- Criar duas contas via UI (Cadastro).
- Faça login com cada conta em janelas diferentes.
- Um jogador cria sala (`POST /games` via UI) — servidor emite `games:list`.
- Outro jogador vê a sala na lista e clica `Entrar` (chama `join_game`) — servidor atribui `opponentId` e emite `game:update`.
- Em cada cliente, clique `Pronto` (emite `player_ready` com `ready: true`) — quando ambos prontos, o servidor define `status: 'starting'` e `startAt` (agendando a mudança para `playing` em 3s).
- Cliente exibe countdown a partir do `startAt` e quando chega a 0 os botões de `Atacar` ficam disponíveis.
- Ataques são enviados via `attack` e server aplica lógica, emitindo atualizações e, se a partida for online, atualiza `wins`/`losses`.

---

## Limitações e recomendações

- Senhas são armazenadas em texto no `db.json` — para produção use hashing (bcrypt) e um banco de dados real.
- `db.json` não é transacional; múltiplas escritas concorrentes podem causar inconsistências em cenários de alta concorrência. Para um projeto simples e local isto é aceitável; em produção use um banco (Postgres, MongoDB, etc.).
- Considere mover a lógica crítica (pareamento, verificação de ready, manipulação de ataques) para o servidor (já feito em grande parte), e utilizar locks ou operações atômicas em DB para evitar condições de corrida.

---

## Perguntas frequentes rápidas

- Onde altero a porta do servidor? — Em `server/index.js` (variável `PORT`, default `4000`).
- Como faço testes com `curl`? — Use `GET /usuarios`, `POST /usuarios` e `POST /games` como mostrado nos exemplos.
- O jogo local (vs IA) conta no ranking? — Não: o servidor atualiza `wins`/`losses` somente quando `hostId` e `opponentId` estão definidos (jogo entre 2 players online).

---

Se quiser, eu posso também:
- Adicionar este ficheiro ao `README.md` (ou linká-lo);
- Gerar exemplos práticos de `curl` ou Postman collections;
- Gerar um script `npm run dev:all` que inicia frontend e json-server / servidor automaticamente.


---

© Projeto trabalho-dvweb — documentação gerada automaticamente para referência de desenvolvimento local.
