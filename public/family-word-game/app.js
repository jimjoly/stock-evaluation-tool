const BOARD_SIZE = 15;
const CENTER = 7;

const refs = {
  connectPanel: document.getElementById("connectPanel"),
  lobbyPanel: document.getElementById("lobbyPanel"),
  gamePanel: document.getElementById("gamePanel"),
  playerName: document.getElementById("playerName"),
  strictDictionary: document.getElementById("strictDictionary"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinCode: document.getElementById("joinCode"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomCodeLabel: document.getElementById("roomCodeLabel"),
  lobbyStatus: document.getElementById("lobbyStatus"),
  lobbyPlayers: document.getElementById("lobbyPlayers"),
  startGameBtn: document.getElementById("startGameBtn"),
  leaveBtn: document.getElementById("leaveBtn"),
  canvas: document.getElementById("gameCanvas"),
  roomBanner: document.getElementById("roomBanner"),
  rack: document.getElementById("rack"),
  submitBtn: document.getElementById("submitBtn"),
  recallBtn: document.getElementById("recallBtn"),
  swapBtn: document.getElementById("swapBtn"),
  passBtn: document.getElementById("passBtn"),
  strictDictionaryGame: document.getElementById("strictDictionaryGame"),
  message: document.getElementById("message"),
  blankModal: document.getElementById("blankModal"),
  blankChoices: document.getElementById("blankChoices"),
  blankCancelBtn: document.getElementById("blankCancelBtn")
};

const ctx = refs.canvas.getContext("2d");
const boardArea = { x: 26, y: 62, cell: 40 };

const clientState = {
  session: null,
  room: null,
  selectedTileId: null,
  cursor: { x: CENTER, y: CENTER },
  pendingBlank: null,
  pollHandle: null,
  message: ""
};

const multipliers = createMultiplierGrid();

function createMultiplierGrid() {
  const grid = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ letter: 1, word: 1, label: "" }))
  );
  const add = (coords, type, value) => {
    for (const [x, y] of coords) {
      grid[y][x][type] = value;
      grid[y][x].label = `${value}${type === "word" ? "W" : "L"}`;
    }
  };

  add([[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]], "word", 3);
  add(
    [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [10, 10], [11, 11], [12, 12], [13, 13], [1, 13], [2, 12],
      [3, 11], [4, 10], [10, 4], [11, 3], [12, 2], [13, 1]
    ],
    "word",
    2
  );
  add([[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]], "letter", 3);
  add(
    [
      [0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3],
      [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]
    ],
    "letter",
    2
  );

  return grid;
}

function tileColor(square, hasTile) {
  if (hasTile) return "#f4dfaf";
  if (square.word === 3) return "#e17568";
  if (square.word === 2) return "#f1a891";
  if (square.letter === 3) return "#4f9dd8";
  if (square.letter === 2) return "#9fd2f3";
  return "#f6f3e3";
}

function setMessage(text) {
  clientState.message = text;
  refs.message.textContent = text;
}

async function api(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function authPayload(extra = {}) {
  return {
    ...extra,
    playerId: clientState.session?.playerId,
    token: clientState.session?.token
  };
}

function roomBasePath() {
  return `/api/family-word-game/rooms/${encodeURIComponent(clientState.session.roomCode)}`;
}

async function createRoom() {
  const name = refs.playerName.value.trim() || "Player";
  const strictDictionary = Boolean(refs.strictDictionary.checked);
  const payload = await api("/api/family-word-game/rooms", "POST", { name, strictDictionary });
  clientState.session = {
    roomCode: payload.roomCode,
    playerId: payload.playerId,
    token: payload.token,
    isHost: payload.isHost
  };
  refs.joinCode.value = payload.roomCode;
  setMessage("Room created. Share code with family.");
  startPolling();
}

async function joinRoom() {
  const code = refs.joinCode.value.trim().toUpperCase();
  if (!code) {
    setMessage("Enter a room code.");
    return;
  }
  const name = refs.playerName.value.trim() || "Player";
  const payload = await api(`/api/family-word-game/rooms/${encodeURIComponent(code)}/join`, "POST", { name });
  clientState.session = {
    roomCode: payload.roomCode,
    playerId: payload.playerId,
    token: payload.token,
    isHost: payload.isHost
  };
  setMessage("Joined room.");
  startPolling();
}

async function fetchState() {
  if (!clientState.session) return;
  const base = roomBasePath();
  const room = await api(
    `${base}/state?playerId=${encodeURIComponent(clientState.session.playerId)}&token=${encodeURIComponent(clientState.session.token)}`
  );
  clientState.room = room;
  refs.strictDictionaryGame.checked = room.strictDictionary;
  renderAll();
}

function startPolling() {
  stopPolling();
  fetchState().catch((error) => setMessage(error.message));
  clientState.pollHandle = setInterval(() => {
    fetchState().catch((error) => setMessage(error.message));
  }, 1200);
}

function stopPolling() {
  if (clientState.pollHandle) {
    clearInterval(clientState.pollHandle);
    clientState.pollHandle = null;
  }
}

function leaveRoom() {
  stopPolling();
  clientState.session = null;
  clientState.room = null;
  clientState.selectedTileId = null;
  clientState.pendingBlank = null;
  closeBlankModal();
  renderAll();
  setMessage("Left room.");
}

function currentTurnIsYou() {
  if (!clientState.room || !clientState.session) return false;
  return clientState.room.currentTurnPlayerId === clientState.session.playerId;
}

async function startGame() {
  try {
    await api(`${roomBasePath()}/start`, "POST", authPayload());
    await fetchState();
  } catch (error) {
    setMessage(error.message);
  }
}

async function sendAction(type, extra = {}) {
  try {
    await api(`${roomBasePath()}/action`, "POST", authPayload({ type, ...extra }));
    await fetchState();
  } catch (error) {
    setMessage(error.message);
  }
}

function rackTileById(tileId) {
  return clientState.room?.you?.rack?.find((tile) => tile.id === tileId) || null;
}

function openBlankModal(tileId, x, y) {
  clientState.pendingBlank = { tileId, x, y };
  refs.blankModal.classList.remove("hidden");
  refs.blankModal.setAttribute("aria-hidden", "false");
}

function closeBlankModal() {
  refs.blankModal.classList.add("hidden");
  refs.blankModal.setAttribute("aria-hidden", "true");
}

async function chooseBlankLetter(letter) {
  const pending = clientState.pendingBlank;
  if (!pending) return;
  clientState.pendingBlank = null;
  closeBlankModal();
  await sendAction("place", {
    tileId: pending.tileId,
    x: pending.x,
    y: pending.y,
    blankLetter: letter
  });
}

function cancelBlankChoice() {
  clientState.pendingBlank = null;
  closeBlankModal();
  setMessage("Blank placement canceled.");
}

function renderLobby() {
  if (!clientState.room || !clientState.session) return;
  refs.roomCodeLabel.textContent = clientState.room.code;
  refs.lobbyStatus.textContent = clientState.room.status;
  refs.lobbyPlayers.innerHTML = clientState.room.players
    .map((player) => `<div class="lobby-player">${player.name}${player.id === clientState.room.hostId ? " (Host)" : ""}</div>`)
    .join("");

  refs.startGameBtn.disabled = !clientState.session.isHost || clientState.room.players.length < 2;
}

function renderRack() {
  refs.rack.innerHTML = "";
  const rack = clientState.room?.you?.rack || [];
  for (const tile of rack) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rack-tile";
    if (tile.id === clientState.selectedTileId) button.classList.add("selected");
    button.innerHTML = `${tile.isBlank ? "?" : tile.letter}<small>${tile.value}</small>`;
    button.addEventListener("click", () => {
      if (!currentTurnIsYou()) return;
      clientState.selectedTileId = clientState.selectedTileId === tile.id ? null : tile.id;
      renderRack();
      renderBoard();
    });
    refs.rack.appendChild(button);
  }
}

function boardLockedTile(x, y) {
  return clientState.room?.board?.[y]?.[x] || null;
}

function boardTurnPlacement(x, y) {
  return clientState.room?.turnPlacements?.find((p) => p.x === x && p.y === y) || null;
}

function drawBoard() {
  const room = clientState.room;

  ctx.fillStyle = "#d9f0e8";
  ctx.fillRect(0, 0, refs.canvas.width, refs.canvas.height);

  const size = boardArea.cell * BOARD_SIZE;
  ctx.fillStyle = "#c4e4d8";
  ctx.fillRect(boardArea.x - 5, boardArea.y - 5, size + 10, size + 10);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const px = boardArea.x + x * boardArea.cell;
      const py = boardArea.y + y * boardArea.cell;
      const locked = boardLockedTile(x, y);
      const placed = boardTurnPlacement(x, y);
      const square = multipliers[y][x];

      ctx.fillStyle = tileColor(square, Boolean(locked || placed));
      ctx.fillRect(px, py, boardArea.cell - 1, boardArea.cell - 1);

      if (!locked && !placed) {
        if (x === CENTER && y === CENTER) {
          ctx.fillStyle = "#4d245f";
          ctx.font = "700 17px Nunito";
          ctx.fillText("★", px + 14, py + 24);
        } else if (square.label) {
          ctx.fillStyle = "#1a5471";
          ctx.font = "700 10px Nunito";
          ctx.fillText(square.label, px + 8, py + 23);
        }
      }

      const tile = placed || locked;
      if (tile) {
        ctx.fillStyle = placed ? "#f6d68c" : "#f2c472";
        ctx.fillRect(px + 3, py + 3, boardArea.cell - 7, boardArea.cell - 7);
        ctx.strokeStyle = placed ? "#7f5d24" : "#6b4f1d";
        ctx.strokeRect(px + 3, py + 3, boardArea.cell - 7, boardArea.cell - 7);
        ctx.fillStyle = "#36260b";
        ctx.font = "700 20px Baloo 2";
        ctx.fillText(tile.letter, px + 12, py + 24);
        ctx.font = "700 11px Nunito";
        ctx.fillText(String(tile.value), px + 25, py + 34);
      }
    }
  }

  if (room && room.mode === "play") {
    const cx = boardArea.x + clientState.cursor.x * boardArea.cell;
    const cy = boardArea.y + clientState.cursor.y * boardArea.cell;
    ctx.strokeStyle = "#4b1f5e";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx + 1.5, cy + 1.5, boardArea.cell - 3, boardArea.cell - 3);
    ctx.lineWidth = 1;
  }

  drawSidebar();
}

function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((`${line} ${word}`).trim().length <= maxChars) {
      line = `${line} ${word}`.trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSidebar() {
  const room = clientState.room;
  const panelX = boardArea.x + boardArea.cell * BOARD_SIZE + 20;
  const panelY = 70;
  const panelW = 300;

  ctx.fillStyle = "#fffef1";
  ctx.fillRect(panelX, panelY, panelW, 590);
  ctx.strokeStyle = "#8a9fa0";
  ctx.strokeRect(panelX, panelY, panelW, 590);

  ctx.fillStyle = "#173f4a";
  ctx.font = "700 26px Baloo 2";
  ctx.fillText("Joly Family Word Game", panelX + 16, panelY + 38);

  if (!room) return;

  ctx.font = "700 16px Nunito";
  ctx.fillText(`Bag: ${room.bagCount}`, panelX + 16, panelY + 66);
  ctx.fillText(`Mode: ${room.strictDictionary ? "strict" : "relaxed"}`, panelX + 130, panelY + 66);

  let y = panelY + 98;
  for (const player of room.players) {
    const isTurn = player.id === room.currentTurnPlayerId && room.mode === "play";
    ctx.fillStyle = isTurn ? "#dcf2d7" : "#eef2f3";
    ctx.fillRect(panelX + 12, y - 18, panelW - 24, 58);
    ctx.strokeStyle = isTurn ? "#3f8a3f" : "#9fb0b1";
    ctx.strokeRect(panelX + 12, y - 18, panelW - 24, 58);
    ctx.fillStyle = "#1f3b42";
    ctx.font = "700 18px Nunito";
    ctx.fillText(player.name, panelX + 20, y + 4);
    ctx.font = "700 15px Nunito";
    ctx.fillText(`Score: ${player.score}`, panelX + 20, y + 25);
    ctx.fillText(`Rack: ${player.rackCount}`, panelX + 140, y + 25);
    y += 72;
  }

  const lines = wrapText(room.status || "", 38);
  ctx.fillStyle = "#173f4a";
  ctx.font = "700 15px Nunito";
  let sy = panelY + 410;
  for (const line of lines.slice(0, 7)) {
    ctx.fillText(line, panelX + 16, sy);
    sy += 22;
  }

  if (room.mode === "game_over") {
    ctx.fillStyle = "#3d1e43";
    ctx.font = "700 19px Baloo 2";
    ctx.fillText(`Winner: ${room.winnerName}`, panelX + 16, panelY + 568);
  }
}

function renderBoard() {
  drawBoard();
}

function updatePanels() {
  const hasSession = Boolean(clientState.session);
  const mode = clientState.room?.mode || "waiting";

  refs.connectPanel.classList.toggle("hidden", hasSession);
  refs.lobbyPanel.classList.toggle("hidden", !hasSession || mode !== "waiting");
  refs.gamePanel.classList.toggle("hidden", !hasSession || mode === "waiting");
}

function renderAll() {
  updatePanels();

  if (clientState.room && clientState.session) {
    renderLobby();
    renderRack();
    renderBoard();

    const yourTurn = currentTurnIsYou();
    const room = clientState.room;
    refs.roomBanner.textContent = `Room ${room.code} | You: ${room.you.name} | ${yourTurn ? "Your turn" : "Waiting"}`;
    refs.startGameBtn.style.display = clientState.session.isHost ? "inline-flex" : "none";
    const disableAct = !yourTurn || room.mode !== "play";
    refs.submitBtn.disabled = disableAct;
    refs.recallBtn.disabled = disableAct;
    refs.swapBtn.disabled = disableAct;
    refs.passBtn.disabled = disableAct;
    refs.strictDictionaryGame.disabled = !clientState.session.isHost;
    refs.message.textContent = clientState.message || room.status || "";
  }
}

function canvasToBoard(x, y) {
  const bx = Math.floor((x - boardArea.x) / boardArea.cell);
  const by = Math.floor((y - boardArea.y) / boardArea.cell);
  if (bx < 0 || bx >= BOARD_SIZE || by < 0 || by >= BOARD_SIZE) return null;
  return { x: bx, y: by };
}

async function handleBoardClick(event) {
  if (!currentTurnIsYou() || clientState.pendingBlank) return;

  const rect = refs.canvas.getBoundingClientRect();
  const scaleX = refs.canvas.width / rect.width;
  const scaleY = refs.canvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  const target = canvasToBoard(px, py);
  if (!target) return;

  clientState.cursor = { x: target.x, y: target.y };

  const locked = boardLockedTile(target.x, target.y);
  if (locked) {
    setMessage("That square is already locked.");
    renderBoard();
    return;
  }

  const placement = boardTurnPlacement(target.x, target.y);
  if (placement) {
    await sendAction("remove", { x: target.x, y: target.y });
    return;
  }

  const tileId = clientState.selectedTileId;
  if (!tileId) {
    setMessage("Select a rack tile first.");
    return;
  }

  const tile = rackTileById(tileId);
  if (!tile) {
    clientState.selectedTileId = null;
    renderRack();
    return;
  }

  if (tile.isBlank) {
    openBlankModal(tile.id, target.x, target.y);
    return;
  }

  await sendAction("place", { tileId: tile.id, x: target.x, y: target.y });
  clientState.selectedTileId = null;
  renderRack();
}

function bindEvents() {
  refs.createRoomBtn.addEventListener("click", () => createRoom().catch((error) => setMessage(error.message)));
  refs.joinRoomBtn.addEventListener("click", () => joinRoom().catch((error) => setMessage(error.message)));
  refs.startGameBtn.addEventListener("click", startGame);
  refs.leaveBtn.addEventListener("click", leaveRoom);

  refs.submitBtn.addEventListener("click", () => sendAction("submit"));
  refs.recallBtn.addEventListener("click", () => sendAction("recall"));
  refs.swapBtn.addEventListener("click", () => sendAction("swap"));
  refs.passBtn.addEventListener("click", () => sendAction("pass"));

  refs.strictDictionary.addEventListener("change", () => {
    refs.strictDictionaryGame.checked = refs.strictDictionary.checked;
  });
  refs.strictDictionaryGame.addEventListener("change", () => {
    const strictDictionary = Boolean(refs.strictDictionaryGame.checked);
    refs.strictDictionary.checked = strictDictionary;
    if (clientState.session) {
      sendAction("toggle_strict", { strictDictionary });
    }
  });

  refs.canvas.addEventListener("click", (event) => {
    handleBoardClick(event).catch((error) => setMessage(error.message));
  });

  refs.blankChoices.innerHTML = "";
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blank-letter";
    button.textContent = letter;
    button.addEventListener("click", () => chooseBlankLetter(letter));
    refs.blankChoices.appendChild(button);
  }

  refs.blankCancelBtn.addEventListener("click", cancelBlankChoice);
  refs.blankModal.addEventListener("click", (event) => {
    if (event.target === refs.blankModal) cancelBlankChoice();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "f") {
      if (!document.fullscreenElement) refs.canvas.requestFullscreen?.();
      else document.exitFullscreen?.();
      return;
    }
    if (clientState.pendingBlank || !currentTurnIsYou()) return;

    if (key === "arrowleft") clientState.cursor.x = Math.max(0, clientState.cursor.x - 1);
    if (key === "arrowright") clientState.cursor.x = Math.min(BOARD_SIZE - 1, clientState.cursor.x + 1);
    if (key === "arrowup") clientState.cursor.y = Math.max(0, clientState.cursor.y - 1);
    if (key === "arrowdown") clientState.cursor.y = Math.min(BOARD_SIZE - 1, clientState.cursor.y + 1);
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
      event.preventDefault();
      renderBoard();
    }
  });
}

function renderGameToText() {
  return JSON.stringify({
    mode: clientState.room?.mode || "disconnected",
    coordinateSystem: "origin top-left, x rightward, y downward",
    roomCode: clientState.session?.roomCode || null,
    you: clientState.room?.you || null,
    currentTurnPlayerId: clientState.room?.currentTurnPlayerId || null,
    players: clientState.room?.players || [],
    strictDictionary: clientState.room?.strictDictionary,
    bagCount: clientState.room?.bagCount,
    turnPlacements: clientState.room?.turnPlacements || [],
    status: clientState.room?.status || clientState.message
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = () => {
  renderAll();
};

bindEvents();
renderAll();
setMessage("Create or join a room to play online.");
