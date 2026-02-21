const crypto = require("crypto");

const BOARD_SIZE = 15;
const RACK_SIZE = 7;
const CENTER = 7;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

const TILE_DISTRIBUTION = {
  A: { count: 9, value: 1 },
  B: { count: 2, value: 3 },
  C: { count: 2, value: 3 },
  D: { count: 4, value: 2 },
  E: { count: 12, value: 1 },
  F: { count: 2, value: 4 },
  G: { count: 3, value: 2 },
  H: { count: 2, value: 4 },
  I: { count: 9, value: 1 },
  J: { count: 1, value: 8 },
  K: { count: 1, value: 5 },
  L: { count: 4, value: 1 },
  M: { count: 2, value: 3 },
  N: { count: 6, value: 1 },
  O: { count: 8, value: 1 },
  P: { count: 2, value: 3 },
  Q: { count: 1, value: 10 },
  R: { count: 6, value: 1 },
  S: { count: 4, value: 1 },
  T: { count: 6, value: 1 },
  U: { count: 4, value: 1 },
  V: { count: 2, value: 4 },
  W: { count: 2, value: 4 },
  X: { count: 1, value: 8 },
  Y: { count: 2, value: 4 },
  Z: { count: 1, value: 10 },
  "?": { count: 2, value: 0 }
};

const WORD_SET = new Set(
  `A I AN AS AT AX BE BY DO GO HE IF IN IS IT ME MY NO OF OH ON OR OX SO TO UP US WE
  ACE ACT ADD AGE AGO AIR ALL AND ANT ANY APE APT ARC ARE ARM ART ASK ATE AWE AWL BAD BAG BAN BAR BAT BAY BED BEE
  BET BID BIG BIN BIT BOW BOX BOY BUG BUN BUS BUT BUY CAB CAN CAP CAR CAT COD COG COP COT COW CRY CUP CUT DAD DAM
  DAY DEN DEW DID DIE DIG DIP DOG DOT DRY DUE DUO EAR EAT EGG EGO ELF END ERA EVE EYE FAR FAT FEW FIN FIT FIX FLY
  FOG FOR FOX FUN FUR GAS GEM GET GIN GOD GUM GUN GUY HAD HAS HAT HEN HER HID HIM HIP HIT HOG HOP HOT HOW HUG HUT
  ICE ILL INK JAM JAR JAW JET JOB JOG JOY KEY KID KIT LAB LAD LAG LAP LAW LAY LEG LET LID LIP LIT LOG LOT LOW MAD
  MAN MAP MAT MAY MEN MET MIX MOM MOP MUD MUG NAP NET NEW NOD NOR NOT NOW NUT OAR ODD OFF OIL OLD ONE OUR OUT OVA
  OWL PAD PAL PAN PAR PAT PAY PEN PET PIE PIG PIN PIT POD POP POT PRO PUB PUG PUN PUT RAG RAM RAP RAT RAW RED RIB
  RID RIM RIP ROB ROD RUG RUM RUN SAD SAG SAP SAT SAW SAY SEA SEE SET SEW SHE SHY SIP SIT SIX SKY SLY SON SOP SOW
  SOY SPA SPY SUB SUE SUM SUN SUP TAB TAG TAN TAP TAR TAX TEA TEN THE TIE TIN TIP TOE TON TOO TOP TOY TRY TUB TUG
  TWO USE VAN VAT VET VOW WAR WAS WAY WEB WET WHO WHY WIN WIT WOK WON WOW YAK YAM YAP YET YOU ZAP ZEN ZIP ZOO
  ABLE ABOUT ABOVE AFTER AGAIN AGENT AGREE ALBUM ALERT ALIVE ALONE ALONG ANGEL ANGRY APPLE APRIL ARENA ARGUE ARISE
  AUDIO AVOID AWARE AWARD BAKER BASIC BEACH BEGIN BEING BELOW BENCH BERRY BIRTH BLACK BLAME BLEND BLOOM BOARD BRAIN
  BREAD BREAK BRICK BRING BROAD BROWN BUILD BUYER CABLE CARRY CATCH CAUSE CHAIR CHART CHEAP CHECK CHEST CHILD CHILL
  CHOIR CHOSE CIVIL CLAIM CLASS CLEAN CLEAR CLERK CLICK CLOCK CLOUD COACH COAST COLOR COMBO COMET COMIC COOKED COULD
  COUNT COVER CRAFT CRANE CREAM CROWN CYCLE DAILY DAIRY DANCE DEALT DEATH DECOR DELAY DEPTH DEVIL DINER DODGE DOING
  DONOR DOUBT DOZEN DRAFT DRAMA DRAWN DREAM DRESS DRINK DRIVE EARLY EARTH EASILY EIGHT ELDER ELECT ENJOY ENTER ENTRY
  EQUAL ERROR EVENT EVERY EXACT EXIST EXTRA FAITH FALSE FAMILY FANCY FAULT FAVOR FENCE FEVER FIBER FIELD FIFTH FIFTY
  FIGHT FINAL FIRST FLAME FLOOR FLOUR FOCUS FORCE FORTY FOUND FRAME FRESH FRONT FRUIT FUNNY GIANT GIVEN GLASS GLOBE
  GRACE GRADE GRAND GRANT GRAPE GRASS GREAT GREEN GROUP GROWN GUARD GUESS GUEST GUIDE HAPPY HEART HEAVY HONEY HORSE
  HOUSE HUMAN IDEAL IMAGE INDEX INNER INPUT ISSUE JELLY JOINT JUDGE JUICE KNIFE KNOCK KNOWN LABEL LARGE LASER LATER
  LAUGH LAYER LEARN LEAST LEAVE LEMON LIGHT LIMIT LOCAL LOOSE LOVED LOWER LUCKY LUNCH MAGIC MAJOR MAKER MANGO MARCH
  MATCH MAYBE MAYOR METAL MIGHT MINOR MODEL MONEY MONTH MORAL MOTOR MOUSE MOVIE MUSIC NEVER NIGHT NOBLE NOISE NORTH
  NOVEL NURSE OASIS OCEAN OFFER OFTEN OLIVE OPERA ORDER OTHER OUTER OWNER PAINT PANEL PARTY PEACE PHASE PHONE PHOTO
  PIANO PIECE PILOT PITCH PLACE PLAIN PLANE PLANT PLATE POINT POWER PRESS PRICE PRIME PRINT PRIOR PRIZE PROUD QUEEN
  QUICK QUIET QUITE RADIO RAISE RANGE RAPID RATIO REACH READY RELAX REPLY RIVER ROBOT ROUGH ROUND ROUTE ROYAL RUGBY
  RURAL SALAD SCALE SCENE SCOPE SCORE SENSE SERVE SEVEN SHADE SHAKE SHALL SHAPE SHARE SHARK SHEET SHELF SHIFT SHINE
  SHIRT SHOCK SHORE SHORT SHOWN SIDES SIGHT SINCE SIXTH SKILL SLEEP SLICE SLIDE SMALL SMART SMILE SMOKE SOLID SOLVE
  SOUND SOUTH SPACE SPARE SPEAK SPEED SPEND SPICE SPLIT SPORT SPRAY SQUAD STAGE STAIR STAND START STATE STEAM STEEL
  STICK STILL STOCK STONE STORM STORY STRIP STUCK STUDY STUFF STYLE SUGAR SUITE SUPER SWEET TABLE TAKEN TASTE TEACH
  THANK THEIR THERE THESE THICK THING THINK THIRD THOSE THREE THROW TIGER TITLE TODAY TOPIC TOTAL TOUCH TOUGH TOWER
  TRACK TRADE TRAIN TREAT TREND TRIAL TRIBE TRICK TRUCK TRULY TRUST TRUTH TWICE UNDER UNION UNTIL UPPER URBAN USAGE
  VALUE VIDEO VISIT VOICE WASTE WATCH WATER WHEEL WHERE WHICH WHILE WHITE WHOLE WHOSE WOMAN WOMEN WORLD WORRY WORTH
  WOULD WRITE WRONG YIELD YOUNG YOURS`.split(/\s+/)
);

const multipliers = createMultiplierGrid();
const rooms = new Map();
let nextTileId = 1;

function nowMs() {
  return Date.now();
}

function createMultiplierGrid() {
  const grid = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ letter: 1, word: 1 }))
  );

  const add = (coords, type, value) => {
    for (const [x, y] of coords) {
      grid[y][x][type] = value;
    }
  };

  add(
    [
      [0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]
    ],
    "word",
    3
  );
  add(
    [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [10, 10], [11, 11], [12, 12], [13, 13],
      [1, 13], [2, 12], [3, 11], [4, 10], [10, 4], [11, 3], [12, 2], [13, 1]
    ],
    "word",
    2
  );
  add(
    [
      [1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]
    ],
    "letter",
    3
  );
  add(
    [
      [0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12],
      [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8],
      [14, 3], [14, 11]
    ],
    "letter",
    2
  );

  return grid;
}

function randomShuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function tileLetter(tile) {
  if (!tile) return "";
  return tile.isBlank ? tile.chosenLetter || "?" : tile.letter;
}

function buildBag() {
  const bag = [];
  for (const [letter, config] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < config.count; i += 1) {
      bag.push({
        id: nextTileId,
        letter,
        value: config.value,
        isBlank: letter === "?",
        chosenLetter: null
      });
      nextTileId += 1;
    }
  }
  return randomShuffle(bag);
}

function drawFromBag(room, count) {
  const picks = [];
  for (let i = 0; i < count && room.bag.length > 0; i += 1) {
    picks.push(room.bag.pop());
  }
  return picks;
}

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function getCombinedTile(room, x, y) {
  const placed = room.turnPlacements[keyFor(x, y)];
  if (placed) return { ...placed.tile, letter: tileLetter(placed.tile), isNew: true };
  const locked = room.board[y][x];
  if (locked) return { ...locked, letter: tileLetter(locked), isNew: false };
  return null;
}

function boardIsEmpty(room) {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (room.board[y][x]) return false;
    }
  }
  return true;
}

function collectWord(room, originX, originY, dx, dy) {
  let sx = originX;
  let sy = originY;

  while (sx - dx >= 0 && sx - dx < BOARD_SIZE && sy - dy >= 0 && sy - dy < BOARD_SIZE) {
    const prev = getCombinedTile(room, sx - dx, sy - dy);
    if (!prev) break;
    sx -= dx;
    sy -= dy;
  }

  const tiles = [];
  let x = sx;
  let y = sy;
  while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
    const tile = getCombinedTile(room, x, y);
    if (!tile) break;
    tiles.push({ x, y, ...tile });
    x += dx;
    y += dy;
  }

  return tiles;
}

function validateLine(room, placements) {
  const xs = new Set(placements.map((p) => p.x));
  const ys = new Set(placements.map((p) => p.y));

  if (placements.length === 1) return { ok: true, direction: "single" };
  if (xs.size > 1 && ys.size > 1) return { ok: false, message: "Tiles must be in one row or one column." };

  if (ys.size === 1) {
    const y = placements[0].y;
    const sorted = placements.map((p) => p.x).sort((a, b) => a - b);
    for (let x = sorted[0]; x <= sorted[sorted.length - 1]; x += 1) {
      if (!getCombinedTile(room, x, y)) return { ok: false, message: "No gaps allowed in your word." };
    }
    return { ok: true, direction: "horizontal" };
  }

  const x = placements[0].x;
  const sorted = placements.map((p) => p.y).sort((a, b) => a - b);
  for (let y = sorted[0]; y <= sorted[sorted.length - 1]; y += 1) {
    if (!getCombinedTile(room, x, y)) return { ok: false, message: "No gaps allowed in your word." };
  }
  return { ok: true, direction: "vertical" };
}

function touchesLockedTile(room, placements) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const placement of placements) {
    for (const [dx, dy] of dirs) {
      const nx = placement.x + dx;
      const ny = placement.y + dy;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
      if (room.board[ny][nx]) return true;
    }
  }
  return false;
}

function listTurnWords(room, placements, direction) {
  const words = [];
  const used = new Set();

  let mainDirection = direction;
  if (direction === "single") {
    const p = placements[0];
    const horiz = collectWord(room, p.x, p.y, 1, 0);
    const vert = collectWord(room, p.x, p.y, 0, 1);
    mainDirection = horiz.length >= vert.length ? "horizontal" : "vertical";
  }

  const anchor = placements[0];
  const main =
    mainDirection === "horizontal"
      ? collectWord(room, anchor.x, anchor.y, 1, 0)
      : collectWord(room, anchor.x, anchor.y, 0, 1);
  const mainKey = main.map((tile) => keyFor(tile.x, tile.y)).join("|");
  if (main.length > 0 && !used.has(mainKey)) {
    words.push(main);
    used.add(mainKey);
  }

  for (const p of placements) {
    const cross =
      mainDirection === "horizontal"
        ? collectWord(room, p.x, p.y, 0, 1)
        : collectWord(room, p.x, p.y, 1, 0);
    const crossKey = cross.map((tile) => keyFor(tile.x, tile.y)).join("|");
    if (cross.length > 1 && !used.has(crossKey)) {
      words.push(cross);
      used.add(crossKey);
    }
  }

  return words.filter((word) => word.length > 0);
}

function scoreWord(wordTiles) {
  let sum = 0;
  let wordMultiplier = 1;

  for (const tile of wordTiles) {
    let letterScore = tile.value;
    if (tile.isNew) {
      const square = multipliers[tile.y][tile.x];
      letterScore *= square.letter;
      wordMultiplier *= square.word;
    }
    sum += letterScore;
  }

  return sum * wordMultiplier;
}

function wordString(wordTiles) {
  return wordTiles.map((tile) => tileLetter(tile)).join("");
}

function refreshRack(room, player) {
  const needed = RACK_SIZE - player.rack.length;
  if (needed > 0) {
    player.rack.push(...drawFromBag(room, needed));
  }
}

function findCurrentPlayer(room) {
  return room.players[room.currentTurn];
}

function nextPlayer(room) {
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
}

function finishGame(room, reason) {
  for (const player of room.players) {
    const penalty = player.rack.reduce((sum, tile) => sum + tile.value, 0);
    player.score -= penalty;
  }
  const winner = room.players.slice().sort((a, b) => b.score - a.score)[0];
  room.mode = "game_over";
  room.winnerName = winner?.name || "No winner";
  room.status = `${reason} ${room.winnerName} wins with ${winner?.score || 0} points.`;
}

function assertPlayerTurn(room, playerId) {
  const player = findCurrentPlayer(room);
  if (!player || player.id !== playerId) {
    const expected = player ? player.name : "Unknown";
    const error = new Error(`Not your turn. Current turn: ${expected}.`);
    error.statusCode = 400;
    throw error;
  }
}

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function ensureRoom(code) {
  const room = rooms.get(String(code || "").toUpperCase());
  if (!room) {
    const error = new Error("Room not found.");
    error.statusCode = 404;
    throw error;
  }
  room.lastTouchedAt = nowMs();
  return room;
}

function authRoomPlayer(room, playerId, token) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.token !== token) {
    const error = new Error("Invalid player credentials.");
    error.statusCode = 401;
    throw error;
  }
  return player;
}

function createRoom(hostName, strictDictionary) {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const host = {
    id: generateId("p"),
    token: generateId("t"),
    name: hostName || "Host",
    score: 0,
    rack: []
  };

  const room = {
    code,
    hostId: host.id,
    mode: "waiting",
    status: "Waiting for players. Share room code and hit Start Game when ready.",
    strictDictionary: Boolean(strictDictionary),
    players: [host],
    currentTurn: 0,
    board: createBoard(),
    bag: [],
    turnPlacements: {},
    winnerName: "",
    consecutivePasses: 0,
    createdAt: nowMs(),
    updatedAt: nowMs(),
    lastTouchedAt: nowMs()
  };

  rooms.set(code, room);
  return { room, host };
}

function joinRoom(room, name) {
  if (room.players.length >= 4) {
    const error = new Error("Room is full (max 4 players).");
    error.statusCode = 400;
    throw error;
  }
  if (room.mode !== "waiting") {
    const error = new Error("Game already started for this room.");
    error.statusCode = 400;
    throw error;
  }

  const player = {
    id: generateId("p"),
    token: generateId("t"),
    name: (name || `Player ${room.players.length + 1}`).slice(0, 24),
    score: 0,
    rack: []
  };

  room.players.push(player);
  room.status = `Waiting for players. ${room.players.length}/4 joined.`;
  room.updatedAt = nowMs();
  return player;
}

function startGame(room, playerId) {
  if (room.hostId !== playerId) {
    const error = new Error("Only the host can start the game.");
    error.statusCode = 403;
    throw error;
  }
  if (room.players.length < 2) {
    const error = new Error("Need at least 2 players to start.");
    error.statusCode = 400;
    throw error;
  }

  room.mode = "play";
  room.board = createBoard();
  room.bag = buildBag();
  room.turnPlacements = {};
  room.currentTurn = 0;
  room.winnerName = "";
  room.consecutivePasses = 0;

  for (const player of room.players) {
    player.score = 0;
    player.rack = drawFromBag(room, RACK_SIZE);
  }

  room.status = `${findCurrentPlayer(room).name}, build the first word through the center star.`;
  room.updatedAt = nowMs();
}

function placeTile(room, playerId, tileId, x, y, blankLetter) {
  if (room.mode !== "play") {
    const error = new Error("Game is not in play mode.");
    error.statusCode = 400;
    throw error;
  }
  assertPlayerTurn(room, playerId);

  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    const error = new Error("Invalid board square.");
    error.statusCode = 400;
    throw error;
  }
  if (room.board[y][x]) {
    const error = new Error("Square already occupied.");
    error.statusCode = 400;
    throw error;
  }

  const key = keyFor(x, y);
  if (room.turnPlacements[key]) {
    const error = new Error("Square already used this turn.");
    error.statusCode = 400;
    throw error;
  }

  const player = room.players.find((p) => p.id === playerId);
  const rackIndex = player.rack.findIndex((tile) => tile.id === Number(tileId));
  if (rackIndex < 0) {
    const error = new Error("Tile not found in your rack.");
    error.statusCode = 400;
    throw error;
  }

  const [tile] = player.rack.splice(rackIndex, 1);
  if (tile.isBlank) {
    const letter = String(blankLetter || "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter)) {
      player.rack.push(tile);
      const error = new Error("Blank tile must be assigned a single letter A-Z.");
      error.statusCode = 400;
      throw error;
    }
    tile.chosenLetter = letter;
  }

  room.turnPlacements[key] = { x, y, tile, playerId };
  room.status = `${player.name} placed ${tileLetter(tile)}.`;
  room.updatedAt = nowMs();
}

function removePlacement(room, playerId, x, y) {
  if (room.mode !== "play") return;
  assertPlayerTurn(room, playerId);

  const key = keyFor(x, y);
  const placement = room.turnPlacements[key];
  if (!placement) return;

  const player = room.players.find((p) => p.id === playerId);
  if (placement.tile.isBlank) placement.tile.chosenLetter = null;
  player.rack.push(placement.tile);
  delete room.turnPlacements[key];
  room.status = "Tile returned to rack.";
  room.updatedAt = nowMs();
}

function recallTiles(room, playerId) {
  if (room.mode !== "play") return;
  assertPlayerTurn(room, playerId);

  const player = room.players.find((p) => p.id === playerId);
  for (const placement of Object.values(room.turnPlacements)) {
    if (placement.tile.isBlank) placement.tile.chosenLetter = null;
    player.rack.push(placement.tile);
  }
  room.turnPlacements = {};
  room.status = "Tiles recalled to rack.";
  room.updatedAt = nowMs();
}

function submitTurn(room, playerId) {
  if (room.mode !== "play") return;
  assertPlayerTurn(room, playerId);

  const placements = Object.values(room.turnPlacements).map((p) => ({ x: p.x, y: p.y, tile: p.tile }));
  if (!placements.length) {
    const error = new Error("Place at least one tile before submitting.");
    error.statusCode = 400;
    throw error;
  }

  const lineCheck = validateLine(room, placements);
  if (!lineCheck.ok) {
    const error = new Error(lineCheck.message);
    error.statusCode = 400;
    throw error;
  }

  if (placements.some((p) => p.tile.isBlank && !/^[A-Z]$/.test(p.tile.chosenLetter || ""))) {
    const error = new Error("Choose a letter for every blank tile before submitting.");
    error.statusCode = 400;
    throw error;
  }

  const firstMove = boardIsEmpty(room);
  if (firstMove) {
    const coversCenter = placements.some((p) => p.x === CENTER && p.y === CENTER);
    if (!coversCenter) {
      const error = new Error("First move must cover the center star.");
      error.statusCode = 400;
      throw error;
    }
  } else if (!touchesLockedTile(room, placements)) {
    const error = new Error("Word must connect to existing tiles.");
    error.statusCode = 400;
    throw error;
  }

  const words = listTurnWords(room, placements, lineCheck.direction);
  const builtWords = words.map(wordString);
  const invalid = builtWords.filter((word) => word.length > 1 && !WORD_SET.has(word));
  if (room.strictDictionary && invalid.length) {
    const error = new Error(`Unknown word(s): ${invalid.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  let turnScore = words.reduce((acc, word) => acc + scoreWord(word), 0);
  if (placements.length === RACK_SIZE) turnScore += 50;

  const current = room.players.find((p) => p.id === playerId);
  current.score += turnScore;

  for (const placement of placements) {
    room.board[placement.y][placement.x] = {
      letter: tileLetter(placement.tile),
      value: placement.tile.value,
      isBlank: Boolean(placement.tile.isBlank),
      playerId: current.id
    };
  }

  room.turnPlacements = {};
  refreshRack(room, current);
  room.consecutivePasses = 0;

  const modeTag = room.strictDictionary ? "" : " (relaxed dictionary)";
  const summary = `${current.name} played ${builtWords.join(", ")} for ${turnScore} points${modeTag}.`;

  if (room.bag.length === 0 && current.rack.length === 0) {
    finishGame(room, summary);
    room.updatedAt = nowMs();
    return;
  }

  nextPlayer(room);
  room.status = `${summary} Next up: ${findCurrentPlayer(room).name}.`;
  room.updatedAt = nowMs();
}

function passTurn(room, playerId) {
  if (room.mode !== "play") return;
  assertPlayerTurn(room, playerId);
  if (Object.keys(room.turnPlacements).length) {
    const error = new Error("Recall tiles before passing.");
    error.statusCode = 400;
    throw error;
  }

  room.consecutivePasses += 1;
  if (room.consecutivePasses >= room.players.length * 2) {
    finishGame(room, "Too many passes in a row.");
    room.updatedAt = nowMs();
    return;
  }

  const player = room.players.find((p) => p.id === playerId);
  nextPlayer(room);
  room.status = `${player.name} passed. ${findCurrentPlayer(room).name}, your turn.`;
  room.updatedAt = nowMs();
}

function swapRack(room, playerId) {
  if (room.mode !== "play") return;
  assertPlayerTurn(room, playerId);

  if (Object.keys(room.turnPlacements).length) {
    const error = new Error("Recall tiles first, then swap.");
    error.statusCode = 400;
    throw error;
  }

  const player = room.players.find((p) => p.id === playerId);
  if (room.bag.length < player.rack.length) {
    const error = new Error("Not enough tiles in bag to swap rack.");
    error.statusCode = 400;
    throw error;
  }

  for (const tile of player.rack) tile.chosenLetter = null;
  room.bag.push(...player.rack);
  room.bag = randomShuffle(room.bag);
  player.rack = drawFromBag(room, RACK_SIZE);

  room.consecutivePasses += 1;
  nextPlayer(room);
  room.status = `${player.name} swapped racks. ${findCurrentPlayer(room).name}, your move.`;
  room.updatedAt = nowMs();
}

function toggleStrict(room, playerId, strictValue) {
  if (room.hostId !== playerId) {
    const error = new Error("Only host can change dictionary mode.");
    error.statusCode = 403;
    throw error;
  }
  room.strictDictionary = Boolean(strictValue);
  room.status = `Dictionary mode set to ${room.strictDictionary ? "strict" : "relaxed"}.`;
  room.updatedAt = nowMs();
}

function cleanExpiredRooms() {
  const cutoff = nowMs() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    if (room.lastTouchedAt < cutoff) {
      rooms.delete(code);
    }
  }
}

function serializeRoomState(room, viewer) {
  const currentPlayer = findCurrentPlayer(room);
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    strictDictionary: room.strictDictionary,
    hostId: room.hostId,
    you: {
      id: viewer.id,
      name: viewer.name,
      score: viewer.score,
      rack: viewer.rack.map((tile) => ({
        id: tile.id,
        letter: tile.letter,
        value: tile.value,
        isBlank: tile.isBlank,
        chosenLetter: tile.chosenLetter || null
      }))
    },
    currentTurnPlayerId: currentPlayer ? currentPlayer.id : null,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      rackCount: player.rack.length
    })),
    bagCount: room.bag.length,
    board: room.board.map((row) =>
      row.map((tile) =>
        tile
          ? {
              letter: tile.letter,
              value: tile.value,
              isBlank: tile.isBlank,
              playerId: tile.playerId
            }
          : null
      )
    ),
    turnPlacements: Object.values(room.turnPlacements).map((p) => ({
      x: p.x,
      y: p.y,
      letter: tileLetter(p.tile),
      value: p.tile.value,
      isBlank: Boolean(p.tile.isBlank),
      byPlayerId: p.playerId
    })),
    winnerName: room.winnerName,
    updatedAt: room.updatedAt
  };
}

function parseAuth(req) {
  const playerId = String(req.body?.playerId || req.query?.playerId || "");
  const token = String(req.body?.token || req.query?.token || "");
  return { playerId, token };
}

function attachFamilyWordGameRoutes(app) {
  setInterval(cleanExpiredRooms, 10 * 60 * 1000).unref();

  app.post("/api/family-word-game/rooms", (req, res) => {
    try {
      const name = String(req.body?.name || "Host").trim().slice(0, 24);
      const strict = req.body?.strictDictionary !== false;
      const { room, host } = createRoom(name, strict);
      res.json({
        roomCode: room.code,
        playerId: host.id,
        token: host.token,
        isHost: true
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to create room." });
    }
  });

  app.post("/api/family-word-game/rooms/:roomCode/join", (req, res) => {
    try {
      const room = ensureRoom(req.params.roomCode);
      const player = joinRoom(room, String(req.body?.name || "Player").trim());
      res.json({
        roomCode: room.code,
        playerId: player.id,
        token: player.token,
        isHost: room.hostId === player.id
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to join room." });
    }
  });

  app.get("/api/family-word-game/rooms/:roomCode/state", (req, res) => {
    try {
      const room = ensureRoom(req.params.roomCode);
      const { playerId, token } = parseAuth(req);
      const player = authRoomPlayer(room, playerId, token);
      res.json(serializeRoomState(room, player));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to fetch room state." });
    }
  });

  app.post("/api/family-word-game/rooms/:roomCode/start", (req, res) => {
    try {
      const room = ensureRoom(req.params.roomCode);
      const { playerId, token } = parseAuth(req);
      authRoomPlayer(room, playerId, token);
      startGame(room, playerId);
      res.json({ ok: true });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Failed to start game." });
    }
  });

  app.post("/api/family-word-game/rooms/:roomCode/action", (req, res) => {
    try {
      const room = ensureRoom(req.params.roomCode);
      const { playerId, token } = parseAuth(req);
      authRoomPlayer(room, playerId, token);

      const type = String(req.body?.type || "");
      if (type === "place") {
        placeTile(room, playerId, req.body?.tileId, Number(req.body?.x), Number(req.body?.y), req.body?.blankLetter);
      } else if (type === "remove") {
        removePlacement(room, playerId, Number(req.body?.x), Number(req.body?.y));
      } else if (type === "recall") {
        recallTiles(room, playerId);
      } else if (type === "submit") {
        submitTurn(room, playerId);
      } else if (type === "pass") {
        passTurn(room, playerId);
      } else if (type === "swap") {
        swapRack(room, playerId);
      } else if (type === "toggle_strict") {
        toggleStrict(room, playerId, req.body?.strictDictionary);
      } else {
        const error = new Error("Unknown action type.");
        error.statusCode = 400;
        throw error;
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Action failed." });
    }
  });
}

module.exports = {
  attachFamilyWordGameRoutes
};
