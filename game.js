const canvas = document.getElementById("canvas");
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const gameStage = document.getElementById("game");
const feedbackPrimary = document.getElementById("feedback-primary");
const feedbackSecondary = document.getElementById("feedback-secondary");
let feedbackUntil = 0;
let feedbackPriority = 0;
function showFeedback(primary, secondary = "", kind = "", duration = 1000, priority = 1) {
  if (!effectsEnabled) return;
  const now = performance.now();
  if (now < feedbackUntil && priority < feedbackPriority) return;
  feedbackPriority = priority;
  feedbackUntil = now + duration;
  feedbackPrimary.textContent = primary;
  feedbackSecondary.textContent = secondary;
  feedbackPrimary.className = `active ${kind}`;
  feedbackSecondary.className = secondary ? `active ${kind}` : "";
}
function updateFeedback(now) {
  if (feedbackUntil && now >= feedbackUntil) {
    feedbackUntil = 0;
    feedbackPriority = 0;
    feedbackPrimary.className = "";
    feedbackSecondary.className = "";
    feedbackPrimary.textContent = "";
    feedbackSecondary.textContent = "";
  }
}

const ctx = canvas.getContext("2d", { alpha: false });
const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const scoreBoard = document.getElementById("score-board");
const scoreText = document.getElementById("score");
const timerBoard = document.getElementById("timer-board");
const timeText = document.getElementById("time");
const timerProgress = document.getElementById("timer-progress");
const endScreen = document.getElementById("end-screen");
const finalScoreText = document.getElementById("final-score");
const playAgainButton = document.getElementById("play-again-button");
const obstacleBoard = document.getElementById("obstacle-board");
const obstacleCountText = document.getElementById("obstacle-count");
const comboBoard = document.getElementById("combo-board");
const modeBoard = document.getElementById("mode-board");
const modeText = document.getElementById("mode-text");
const bonusStatus = document.getElementById("bonus-status");
const bonusResult = document.getElementById("bonus-result");
const comboText = document.getElementById("combo-text");
const comboTimeText = document.getElementById("combo-time");
const finalComboText = document.getElementById("final-combo");
const soundButton = document.getElementById("sound-button");

// STEP 5-7: safe/war FPS diagnostics with independent counters. Values are only
// recorded while the game is running; the first frame of each run is excluded.
// QA 전용: ?debug=1로 진입한 경우에만 FPS/끊김/연출 설정 UI를 표시합니다.
const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";
const perfPanel = document.getElementById("perf-panel");
const perfText = document.getElementById("perf-text");
const effectButton = document.getElementById("effect-button");
let effectsEnabled = true;
let perfWindowStart = null;
let perfFrameCount = 0;
let perfLongFrames = 0;
let perfLastAt = null;
const perfByMode = {
  safe: { frames: 0, elapsed: 0, longFrames: 0 },
  war: { frames: 0, elapsed: 0, longFrames: 0 }
};
let lastPerfDisplay = "";
function updateEffectButton() {
  effectButton.textContent = effectsEnabled ? "✨ 연출 ON" : "연출 OFF";
  effectButton.setAttribute("aria-pressed", String(effectsEnabled));
  gameStage.classList.toggle("low-effects", !effectsEnabled);
  if (!effectsEnabled) {
    feedbackUntil = 0;
    feedbackPriority = 0;
    feedbackPrimary.className = "";
    feedbackSecondary.className = "";
    feedbackPrimary.textContent = "";
    feedbackSecondary.textContent = "";
  }
}
effectButton.addEventListener("click", () => {
  effectsEnabled = !effectsEnabled;
  updateEffectButton();
});
function resetPerformance() {
  perfWindowStart = null;
  perfFrameCount = 0;
  perfLongFrames = 0;
  perfLastAt = null;
  lastPerfDisplay = "";
  for (const mode of ["safe", "war"]) {
    perfByMode[mode] = { frames: 0, elapsed: 0, longFrames: 0 };
  }
  perfText.textContent = "FPS 측정 중…";
}
function trackPerformance(now) {
  if (perfLastAt === null) {
    perfLastAt = now;
    perfWindowStart = now;
    return;
  }
  const elapsed = now - perfLastAt;
  perfLastAt = now;
  // Tab resumes / hidden windows produce large gaps unrelated to rendering.
  if (elapsed > 250) {
    perfWindowStart = now;
    perfFrameCount = 0;
    perfLongFrames = 0;
    return;
  }
  const bucket = perfByMode[gameMode];
  bucket.frames++;
  bucket.elapsed += elapsed;
  if (elapsed > 50) bucket.longFrames++;
  perfFrameCount++;
  if (elapsed > 50) perfLongFrames++;
  const period = now - perfWindowStart;
  if (period >= 1000) {
    const fps = Math.round(perfFrameCount * 1000 / period);
    const display = `${gameMode === "war" ? "전쟁" : "안전"} FPS ${fps} · 끊김 ${perfLongFrames}회`;
    if (display !== lastPerfDisplay) {
      perfText.textContent = display;
      lastPerfDisplay = display;
    }
    perfWindowStart = now;
    perfFrameCount = 0;
    perfLongFrames = 0;
  }
}
function averageFps(mode) {
  const p = perfByMode[mode];
  return p.elapsed ? (p.frames * 1000 / p.elapsed).toFixed(1) : "";
}


// STEP 3-11: 짧은 효과음은 외부 파일 없이 Web Audio API로 생성합니다.
// 브라우저 자동재생 제한을 피하기 위해 실제 버튼 클릭 이후에만 오디오를 초기화합니다.
let soundEnabled = true;
let audioContext = null;
function ensureAudio() {
  if (!soundEnabled) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // 미지원 브라우저도 게임은 정상 진행
  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  } catch (error) {
    return null;
  }
}
function playTone(frequency, duration, type = "sine", volume = 0.065, offset = 0) {
  if (!soundEnabled) return;
  const audio = ensureAudio();
  if (!audio || audio.state === "closed") return;
  try {
    const start = audio.currentTime + offset;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch (error) {
    // 소리 장치가 없는 환경에서도 게임 진행에는 영향이 없어야 합니다.
  }
}
function playPickupSound(streak) {
  if (streak === 1) playTone(523.25, 0.115);
  else if (streak === 2) playTone(659.25, 0.13);
  else {
    playTone(783.99, 0.11);
    playTone(1046.5, 0.14, "sine", 0.045, 0.085);
  }
}
function playEndSound(reason) {
  if (reason === "obstacle") {
    playTone(196, 0.22, "triangle", 0.075);
    playTone(146.83, 0.30, "triangle", 0.065, 0.12);
  } else {
    playTone(523.25, 0.16, "sine", 0.055);
    playTone(659.25, 0.18, "sine", 0.055, 0.13);
    playTone(783.99, 0.24, "sine", 0.055, 0.26);
  }
}
function updateSoundButton() {
  soundButton.textContent = soundEnabled ? "🔊 사운드 ON" : "🔇 사운드 OFF";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
}
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();
  if (soundEnabled) ensureAudio();
});


const GAME_DURATION_MS = 30_000; // 30초
const COMBO_WINDOW_MS = 4000; // 아이템을 먹은 뒤 4초 동안 콤보 유지
const MAX_COMBO_MULTIPLIER = 3; // 점수 배수 상한
const OBSTACLE_COLOR = "#ef4444";
const DIFFICULTY_SPEEDS = { easy: 55, normal: 85, hard: 115 };
const DIFFICULTY_NAMES = { easy: "쉬움", normal: "보통", hard: "어려움" };
const difficultySelect = document.getElementById("difficulty");
const endStats = document.getElementById("end-stats");
const recordList = document.getElementById("record-list");
const changeDifficultyButton = document.getElementById("change-difficulty-button");
let selectedDifficulty = "normal";
let obstacleSpeed = DIFFICULTY_SPEEDS.normal;
const playRecords = []; // 최근 3개 기록(화면 표시용)
const testRecords = []; // 이 페이지에서 완료된 모든 게임의 분석 데이터
const summaryBody = document.getElementById("summary-body");
const exportCsvButton = document.getElementById("export-csv-button");
const OBSTACLE_ADD_INTERVAL_MS = 10_000; // 10초마다 적 1개 추가
const MAX_OBSTACLES = 3; // 시작 1개 + 10초에 1개 + 20초에 1개

// STEP 6-2: 기본 점수만 코인으로 지급 / 전쟁 모드에서만 보호막 발동.
// 기존 localStorage 키는 유지하므로 STEP 6-1에서 모은 코인/구매 내역도 보존됩니다.
const SHIELD_PRICE = 1000;
const MAX_SHIELDS = 3;
const SHIELD_INVULNERABILITY_MS = 1000;
const META_STORAGE_KEY = "blue-square-meta-v1";
const ACHIEVEMENTS = [
  { id: "first", name: "첫 번째 도전", description: "게임 1판 완료" },
  { id: "combo10", name: "콤보 마스터", description: "한 판에서 10콤보 달성" },
  { id: "score1000", name: "고득점 수집가", description: "한 판에서 1,000점 달성" },
  { id: "war10", name: "위험을 즐기는 자", description: "한 판의 전쟁 모드에서 아이템 10개 획득" },
  { id: "warfinish", name: "전쟁 생존자", description: "전쟁 아이템을 1개 이상 획득하고 30초 완주" }
];
const defaultMeta = () => ({ coins: 0, shields: 0, bestScore: 0, bestWithoutShield: 0, bestCombo: 0, totalRuns: 0, achievements: {} });
let meta = loadMeta();
let metaStorageAvailable = true;
let shieldAvailableThisRun = false;
let shieldUsedThisRun = false;
let shieldInvulnerableUntil = 0;
let earnedCoinsThisRun = 0;
let lastShopTrigger = null;
const startCoinsText = document.getElementById("start-coins");
const startBestText = document.getElementById("start-best");
const startShieldsText = document.getElementById("start-shields");
const shopCoinsText = document.getElementById("shop-coins");
const shopShieldsText = document.getElementById("shop-shields");
const shopOverlay = document.getElementById("shop-overlay");
const shopMessage = document.getElementById("shop-message");
const buyShieldButton = document.getElementById("buy-shield-button");
const shieldResult = document.getElementById("shield-result");
const economyResult = document.getElementById("economy-result");
function validStoredNumber(value, max) {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
}
function loadMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(META_STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultMeta();
    return {
      coins: validStoredNumber(raw.coins, 1000000000),
      shields: validStoredNumber(raw.shields, MAX_SHIELDS),
      bestScore: validStoredNumber(raw.bestScore, 1000000000),
      bestWithoutShield: validStoredNumber(raw.bestWithoutShield, 1000000000),
      bestCombo: validStoredNumber(raw.bestCombo, 1000000000),
      totalRuns: validStoredNumber(raw.totalRuns, 1000000000),
      achievements: Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, (raw.achievements?.[a.id] === true || (a.id === "score1000" && validStoredNumber(raw.bestScore, 1000000000) >= 1000))]))
    };
  } catch (error) { return defaultMeta(); }
}
function saveMeta() {
  try { localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta)); return true; }
  catch (error) { metaStorageAvailable = false; return false; }
}
function renderMeta() {
  startCoinsText.textContent = meta.coins.toLocaleString("ko-KR");
  startBestText.textContent = meta.bestScore.toLocaleString("ko-KR");
  startShieldsText.textContent = meta.shields;
  shopCoinsText.textContent = meta.coins.toLocaleString("ko-KR");
  shopShieldsText.textContent = meta.shields;
  buyShieldButton.disabled = meta.coins < SHIELD_PRICE || meta.shields >= MAX_SHIELDS;
  buyShieldButton.textContent = meta.shields >= MAX_SHIELDS ? "보유 한도 3개" : meta.coins < SHIELD_PRICE ? "코인 부족" : "보호막 구매";
}
// STEP 6-3: achievement / personal records overlays. All data shares the existing save key.
const achievementsOverlay = document.getElementById("achievements-overlay");
const settingsOverlay = document.getElementById("settings-overlay");
let lastMetaTrigger = null;
function renderAchievements() {
  const summary = document.getElementById("record-summary");
  summary.replaceChildren();
  for (const [title, value] of [["최고 점수", `${meta.bestScore}점`], ["무보조 최고 점수", `${meta.bestWithoutShield}점`], ["최고 콤보", `${meta.bestCombo}연속`], ["누적 플레이", `${meta.totalRuns}판`]]) {
    const el = document.createElement("div"); el.className="record-cell";
    const label = document.createElement("span"); label.textContent=title;
    const strong = document.createElement("strong"); strong.textContent=value;
    el.append(label,strong); summary.append(el);
  }
  const list=document.getElementById("achievements-list"); list.replaceChildren();
  for (const entry of ACHIEVEMENTS) {
    const unlocked = meta.achievements?.[entry.id] === true;
    const el = document.createElement("div"); el.className = `achievement-row ${unlocked ? "unlocked" : "locked"}`;
    const symbol = document.createElement("span"); symbol.className="achievement-symbol"; symbol.textContent=unlocked?"🏅":"🔒";
    const body = document.createElement("div");
    const name = document.createElement("strong"); name.textContent=entry.name;
    const desc=document.createElement("small"); desc.textContent=entry.description;
    body.append(name,desc);
    const state=document.createElement("span"); state.className="achievement-state"; state.textContent=unlocked?"달성":"미달성";
    el.append(symbol,body,state); list.append(el);
  }
}
function openMetaOverlay(which, trigger) {
  if (running || !shopOverlay.hidden) return;
  lastMetaTrigger=trigger;
  if (which === "achievements") { renderAchievements(); achievementsOverlay.hidden=false; document.getElementById("achievements-close").focus(); }
  else { settingsOverlay.hidden=false; document.getElementById("settings-close").focus(); }
}
function closeMetaOverlays() {
  achievementsOverlay.hidden=true;
  settingsOverlay.hidden=true;
  if (lastMetaTrigger && document.contains(lastMetaTrigger)) lastMetaTrigger.focus();
}
for (const id of ["achievements-start-button","achievements-end-button"]) document.getElementById(id).addEventListener("click", event=>openMetaOverlay("achievements", event.currentTarget));
for (const id of ["settings-start-button","settings-end-button"]) document.getElementById(id).addEventListener("click", event=>openMetaOverlay("settings", event.currentTarget));
document.getElementById("achievements-close").addEventListener("click", closeMetaOverlays);
document.getElementById("settings-close").addEventListener("click", closeMetaOverlays);
window.addEventListener("keydown", event=>{ if(event.key === "Escape" && (!achievementsOverlay.hidden || !settingsOverlay.hidden)) {event.preventDefault();closeMetaOverlays();} });
function resetGameData(scope) {
  if (running) return;
  const message={records:"최고 점수·콤보·도전 과제를 모두 초기화할까요?", wallet:"보유 코인·보호막을 모두 삭제할까요?", all:"코인·보호막·기록·도전 과제를 모두 초기화할까요?"}[scope];
  if (!window.confirm(`${message}\n되돌릴 수 없습니다.`)) return;
  if (scope==="records" || scope==="all") {
    meta.bestScore=0; meta.bestWithoutShield=0; meta.bestCombo=0; meta.totalRuns=0; meta.achievements={};
    playRecords.length=0; testRecords.length=0; renderTestSummary();
    recordList.replaceChildren();
  }
  if (scope==="wallet" || scope==="all") { meta.coins=0; meta.shields=0; }
  saveMeta(); renderMeta(); renderAchievements();
  document.getElementById("reset-message").textContent="선택한 데이터가 초기화되었습니다.";
}
document.getElementById("reset-records").addEventListener("click",()=>resetGameData("records"));
document.getElementById("reset-wallet").addEventListener("click",()=>resetGameData("wallet"));
document.getElementById("reset-all").addEventListener("click",()=>resetGameData("all"));
function unlockAchievements(reason) {
  const conditions={first:meta.totalRuns>=1,combo10:maxCombo>=10,score1000:score>=1000,war10:warPickupCount>=10,warfinish:reason==="time" && warPickupCount>=1};
  const newly=[];
  for (const achievement of ACHIEVEMENTS) {
    if (conditions[achievement.id] && meta.achievements[achievement.id] !== true) {
      meta.achievements[achievement.id]=true; newly.push(achievement.name);
    }
  }
  return newly;
}
function openShop(trigger) {
  if (running) return;
  lastShopTrigger = trigger;
  renderMeta();
  shopOverlay.hidden = false;
  shopMessage.textContent = metaStorageAvailable
    ? "점수는 기록으로 남고, 코인만 구매에 사용돼요."
    : "이 환경에서는 로컬 저장이 제한되어 새로고침하면 구매 내역이 사라질 수 있어요.";
  document.getElementById("shop-close-button").focus();
}
function closeShop() {
  shopOverlay.hidden = true;
  if (lastShopTrigger && !lastShopTrigger.hidden) lastShopTrigger.focus();
}
function buyShield() {
  if (meta.coins < SHIELD_PRICE || meta.shields >= MAX_SHIELDS) return;
  meta.coins -= SHIELD_PRICE;
  meta.shields += 1;
  saveMeta();
  renderMeta();
  shopMessage.textContent = "구매 완료! 다음 플레이의 전쟁 모드에서 충돌하면 자동 발동합니다.";
}
document.getElementById("shop-start-button").addEventListener("click", event => openShop(event.currentTarget));
document.getElementById("shop-end-button").addEventListener("click", event => openShop(event.currentTarget));
document.getElementById("shop-close-button").addEventListener("click", closeShop);
buyShieldButton.addEventListener("click", buyShield);
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !shopOverlay.hidden) { event.preventDefault(); closeShop(); }
});
renderMeta();


const player = {
  x: 0,
  y: 0,
  size: 48,
  speed: 450, // 최고 속도(px/s): 320보다 빠르되 이전 600보다 낮게 설정
  acceleration: 4500, // 정지 상태에서 최고 속도까지 약 0.10초
  deceleration: 6500, // 최고 속도에서 정지까지 약 0.07초
  vx: 0,
  vy: 0,
  color: "#3b82f6",
};

const item = {
  x: 0,
  y: 0,
  size: 22,
  collected: false,
};

const obstacles = []; // 추적 장애물들을 보관하는 배열

// 아이템 획득 순간의 짧은 시각 효과 (게임 점수/충돌 판정과는 독립적)
const pickupEffects = [];
const PICKUP_EFFECT_DURATION_MS = 650;
function addPickupEffect(x, y, points, streak, now) {
  pickupEffects.push({ x, y, points, streak, createdAt: now });
  // 게임 시간이 길어져도 애니메이션 데이터가 과도하게 쌓이지 않게 제한
  if (pickupEffects.length > 12) pickupEffects.shift();
}
function drawPickupEffects(now) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const effect of pickupEffects) {
    const t = Math.min(1, (now - effect.createdAt) / PICKUP_EFFECT_DURATION_MS);
    const alpha = t < 0.65 ? 1 : Math.max(0, (1 - t) / 0.35);
    const y = effect.y - t * 42;
    const color = effect.streak >= 3 ? "#fb7185" : effect.streak === 2 ? "#fb923c" : "#fde047";
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${effect.streak >= 3 ? 30 : 25}px "Apple SD Gothic Neo", sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#0f172a";
    ctx.strokeText(`+${effect.points}`, effect.x, y);
    ctx.fillStyle = color;
    ctx.fillText(`+${effect.points}`, effect.x, y);
  }
  ctx.restore();
}
function prunePickupEffects(now) {
  for (let i = pickupEffects.length - 1; i >= 0; i--) {
    if (now - pickupEffects[i].createdAt >= PICKUP_EFFECT_DURATION_MS) pickupEffects.splice(i, 1);
  }
}

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

// STEP 5-2: 전쟁 모드에서는 기본/콤보 점수의 50%를 미확정 보너스로 적립합니다.
// 안전 모드로 복귀하면 확정되고, 전쟁 중 충돌하면 미확정분만 잃습니다.
// 제한 시간 종료 시에는 미확정 보너스를 자동 확정합니다.
const WAR_BONUS_RATE = 0.5;
// STEP 5-6: 전쟁 모드에서 마지막으로 아이템을 획득한 뒤 2초를 생존해야 안전 모드 복귀 가능.
// 전쟁 모드에 진입만 했다면 잠금 없음. 추가 아이템을 먹을 때마다 2초 타이머를 갱신.
const WAR_PICKUP_SURVIVAL_MS = 2000;
let lastWarPickupAt = null;
let lastWarLockDisplay = "";
function remainingWarLockMs(now = performance.now()) {
  return gameMode === "war" && lastWarPickupAt !== null
    ? Math.max(0, WAR_PICKUP_SURVIVAL_MS - (now - lastWarPickupAt)) : 0;
}
function updateWarLockDisplay(now = performance.now()) {
  const element = document.getElementById("war-lock-status");
  const remaining = remainingWarLockMs(now);
  const message = gameMode !== "war"
    ? "SPACE · 전쟁 모드 진입"
    : remaining > 0
      ? `🔒 마지막 획득 후 생존 ${(remaining / 1000).toFixed(1)}초`
      : lastWarPickupAt === null
        ? "✓ 아이템 획득 전 · 언제든 복귀 가능"
        : "✓ 생존 성공 · SPACE로 보너스 확정";
  if (message !== lastWarLockDisplay) {
    element.textContent = message;
    element.classList.toggle("locked", remaining > 0);
    lastWarLockDisplay = message;
  }
}

// STEP 5-3: 전쟁 모드에서 아이템 획득마다 적 속도 +5%, 최대 +25%.
// 전쟁 모드를 떠나면 누적 위험도는 초기화됩니다.
const WAR_SPEED_STEP = 0.05;
const WAR_SPEED_MAX_BONUS = 0.25;
const WAR_SPEED_MAX_ITEMS = Math.round(WAR_SPEED_MAX_BONUS / WAR_SPEED_STEP);
const dangerStatus = document.getElementById("danger-status");
let warStreakPickups = 0;
function currentWarSpeedBonus() {
  return gameMode === "war" ? Math.min(warStreakPickups, WAR_SPEED_MAX_ITEMS) * WAR_SPEED_STEP : 0;
}
function updateObstacleSpeed() {
  obstacleSpeed = DIFFICULTY_SPEEDS[selectedDifficulty] * (1 + currentWarSpeedBonus());
}

let gameMode = "safe";
let pendingWarBonus = 0;
let securedWarBonus = 0;
let lostWarBonus = 0;
let warPickupCount = 0;

function renderGameMode() {
  const isWar = gameMode === "war";
  modeText.textContent = isWar ? "⚔ 전쟁 모드" : "🛡 안전 모드";
  bonusStatus.textContent = isWar
    ? `추가 보상 +50% · 미확정 ${pendingWarBonus}점`
    : `확정 전쟁 보너스 ${securedWarBonus}점 · SPACE 전환`;
  const speedBonusPercent = Math.round(currentWarSpeedBonus() * 100);
  dangerStatus.textContent = isWar
    ? `위험도 ${Math.min(warStreakPickups, WAR_SPEED_MAX_ITEMS)}/5 · 적 속도 +${speedBonusPercent}% (${obstacleSpeed.toFixed(1)}px/초)`
    : `위험도 0/5 · 적 기본 속도 ${obstacleSpeed.toFixed(1)}px/초`;
  modeBoard.classList.toggle("war", isWar);
  modeBoard.classList.toggle("safe", !isWar);
  // 위험도 표시 바는 5단계의 비율만 표현하며, 게임 밸런스에는 관여하지 않습니다.
  modeBoard.style.setProperty("--risk-fill", `${isWar ? Math.min(warStreakPickups, WAR_SPEED_MAX_ITEMS) * 20 : 0}%`);
  document.getElementById("game").classList.toggle("war-mode", isWar);
  updateWarLockDisplay();
}

function secureWarBonus() {
  if (pendingWarBonus === 0) return;
  securedWarBonus += pendingWarBonus;
  score += pendingWarBonus;
  pendingWarBonus = 0;
  scoreText.textContent = score;
}

function toggleGameMode() {
  if (!running) return;
  if (gameMode === "war") {
    const remaining = remainingWarLockMs();
    if (remaining > 0) {
      showFeedback("SURVIVE!", `마지막 아이템 획득 후 ${(remaining / 1000).toFixed(1)}초 생존 필요`, "war", 800, 1);
      return;
    }
    const justSecured = pendingWarBonus;
    secureWarBonus();
    showFeedback("SAFE MODE", justSecured ? `BONUS SECURED +${justSecured}` : "위험도 초기화", "safe", 1150, 2);
    gameMode = "safe";
    lastWarPickupAt = null;
    warStreakPickups = 0;
  } else {
    gameMode = "war";
    lastWarPickupAt = null;
    warStreakPickups = 0;
    showFeedback("WAR MODE", "아이템 획득 시 2초 생존 · 보너스 +50%", "war", 1200, 2);
  }
  updateObstacleSpeed();
  renderGameMode();
}
let running = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let lastPickupAt = null;
let gameEndsAt = 0;
let gameStartsAt = 0;
let lastShownTime = 30;
let animationId = null;
let lastFrameAt = null;
let lastTimerProgressTick = -1;
let lastComboDisplay = "";
let lastComboRemaining = "";

function resetScore() {
  score = 0;
  scoreText.textContent = score;
}

function resetCombo() {
  combo = 0;
  maxCombo = 0;
  lastPickupAt = null;
  renderCombo(performance.now());
}

function renderCombo(now) {
  if (combo === 0 || lastPickupAt === null) {
    if (lastComboDisplay !== "콤보 없음") { comboText.textContent = "콤보 없음"; lastComboDisplay = "콤보 없음"; }
    if (lastComboRemaining !== "") { comboTimeText.textContent = ""; lastComboRemaining = ""; }
    return;
  }
  const remaining = Math.max(0, COMBO_WINDOW_MS - (now - lastPickupAt));
  const comboLabel = `콤보 x${Math.min(combo, MAX_COMBO_MULTIPLIER)} (${combo}연속)`;
  const remainingLabel = `다음 획득까지 ${(remaining / 1000).toFixed(1)}초`;
  if (comboLabel !== lastComboDisplay) { comboText.textContent = comboLabel; lastComboDisplay = comboLabel; }
  if (remainingLabel !== lastComboRemaining) { comboTimeText.textContent = remainingLabel; lastComboRemaining = remainingLabel; }
}

function expireComboIfNeeded(now) {
  if (combo > 0 && lastPickupAt !== null && now - lastPickupAt >= COMBO_WINDOW_MS) {
    if (combo >= 2) showFeedback("COMBO LOST", `${combo}연속 기록`, "", 620, 0);
    combo = 0;
    lastPickupAt = null;
  }
  renderCombo(now);
}


function resizeCanvas() {
  const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT, 1.5);
  gameStage.style.setProperty("--stage-scale", String(scale));
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  keepPlayerInside();
  keepItemInside();
  obstacles.forEach(keepObstacleInside);
  if (typeof isValidItemLayoutPosition === "function" && !item.collected && !isValidItemLayoutPosition(item)) {
    resetItem();
  }
}

function placePlayerInCenter() {
  player.x = (canvas.width - player.size) / 2;
  player.y = (canvas.height - player.size) / 2;
}

function keepPlayerInside() {
  const maxX = Math.max(0, canvas.width - player.size);
  const maxY = Math.max(0, canvas.height - player.size);
  player.x = Math.min(Math.max(0, player.x), maxX);
  player.y = Math.min(Math.max(0, player.y), maxY);
}

function keepItemInside() {
  item.x = Math.min(Math.max(0, item.x), Math.max(0, canvas.width - item.size));
  item.y = Math.min(Math.max(0, item.y), Math.max(0, canvas.height - item.size));
}

function keepObstacleInside(obstacle) {
  obstacle.x = Math.min(Math.max(0, obstacle.x), Math.max(0, canvas.width - obstacle.size));
  obstacle.y = Math.min(Math.max(0, obstacle.y), Math.max(0, canvas.height - obstacle.size));
}

// 장애물이 등장할 때 플레이어와 안전거리를 확보합니다.
// 좁은 화면에서는 가능한 가장 멀리 배치하되, 즉시 충돌할 위험이 있으면 생성을 미룹니다.
const PREFERRED_SPAWN_DISTANCE = 260;
const ABSOLUTE_MIN_SPAWN_DISTANCE = 110;
const OBSTACLE_SPAWN_SAMPLES = 180;

function centerDistance(a, b) {
  return Math.hypot(a.x + a.size / 2 - (b.x + b.size / 2),
                    a.y + a.size / 2 - (b.y + b.size / 2));
}

function spawnObstacle() {
  const size = 48;
  const maxX = canvas.width - size;
  const maxY = canvas.height - size;
  if (maxX < 0 || maxY < 0) return false;

  const others = [player, ...obstacles];
  const candidates = [];
  const MIN_DISTANCE = ABSOLUTE_MIN_SPAWN_DISTANCE;

  function consider(x, y) {
    const candidate = { x, y, size };
    if (!item.collected && overlapsObstacleWithGap(item, candidate)) return;
    if (overlapsVisibleUI(candidate)) return;
    if (centerDistance(candidate, player) < MIN_DISTANCE) return;
    const nearestDistance = Math.min(...others.map(other => centerDistance(candidate, other)));
    candidates.push({ ...candidate, nearestDistance });
  }

  // 1. 안전한 위치를 무작위로 수집합니다. 가장 먼 한 지점을 고정 선택하지 않습니다.
  for (let i = 0; i < OBSTACLE_SPAWN_SAMPLES; i++) {
    consider(Math.random() * maxX, Math.random() * maxY);
  }

  // 2. 안전거리 260px 이상인 위치가 있다면 그중 무작위 선택합니다.
  // 없다면 안전한 후보 중 서로 멀리 떨어진 상위 25%에서 무작위 선택합니다.
  let pool = candidates.filter(c => c.nearestDistance >= PREFERRED_SPAWN_DISTANCE);
  if (pool.length === 0 && candidates.length > 0) {
    const ranked = [...candidates].sort((a, b) => b.nearestDistance - a.nearestDistance);
    pool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.25)));
  }

  // 3. 아주 좁은 화면에서 무작위 후보가 없으면 격자로 가능한 안전 위치를 검사합니다.
  if (pool.length === 0) {
    for (let y = 0; y <= maxY; y += Math.max(1, maxY / 6)) {
      for (let x = 0; x <= maxX; x += Math.max(1, maxX / 8)) consider(x, y);
    }
    if (candidates.length > 0) {
      const ranked = [...candidates].sort((a, b) => b.nearestDistance - a.nearestDistance);
      pool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.25)));
    }
  }

  if (pool.length === 0) return false;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  obstacles.push({ x: selected.x, y: selected.y, size });
  obstacleCountText.textContent = obstacles.length;
  return true;
}

function moveObstacles(deltaSeconds) {
  for (const obstacle of obstacles) {
    const dx = player.x + player.size / 2 - (obstacle.x + obstacle.size / 2);
    const dy = player.y + player.size / 2 - (obstacle.y + obstacle.size / 2);
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    const step = Math.min(obstacleSpeed * deltaSeconds, distance);
    obstacle.x += (dx / distance) * step;
    obstacle.y += (dy / distance) * step;
    keepObstacleInside(obstacle);
  }
}

function addObstaclesForElapsedTime(now) {
  const elapsed = Math.max(0, now - gameStartsAt);
  const wanted = Math.min(MAX_OBSTACLES, 1 + Math.floor(elapsed / OBSTACLE_ADD_INTERVAL_MS));
  while (obstacles.length < wanted) {
    if (!spawnObstacle()) break; // 적절한 생성 공간이 없으면 다음 프레임에 재시도
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.size &&
         a.x + a.size > b.x &&
         a.y < b.y + b.size &&
         a.y + a.size > b.y;
}

// 아이템은 실제로 보이는 게임 영역에만 생성합니다.
// 오른쪽 '다시 시작' 버튼과 왼쪽 HUD를 포함해 화면 UI를 피합니다.
function overlapsVisibleUI(candidate) {
  const canvasRect = canvas.getBoundingClientRect();
  const margin = 12;
  const uiElements = [restartButton, soundButton, scoreBoard, timerBoard, obstacleBoard, comboBoard, modeBoard, perfPanel, effectButton];

  return uiElements.some(element => {
    if (element.hidden) return false;
    const rect = element.getBoundingClientRect();
    const scale = canvasRect.width / GAME_WIDTH;
    const left = (rect.left - canvasRect.left) / scale - margin;
    const top = (rect.top - canvasRect.top) / scale - margin;
    const right = (rect.right - canvasRect.left) / scale + margin;
    const bottom = (rect.bottom - canvasRect.top) / scale + margin;
    return candidate.x < right && candidate.x + candidate.size > left &&
           candidate.y < bottom && candidate.y + candidate.size > top;
  });
}

// 왼쪽 HUD의 텍스트와 반투명 배경까지 확실히 피하도록
// 상단 전체를 아이템 생성 금지 구역으로 취급합니다.
// 실제 HUD의 가장 아래 좌표를 기준으로 계산해 글꼴/창 크기 변화도 반영합니다.
function getItemSafeTop() {
  const canvasRect = canvas.getBoundingClientRect();
  const margin = 20;
  const elements = [scoreBoard, timerBoard, obstacleBoard, comboBoard, modeBoard, restartButton, soundButton];
  const bottoms = elements
    .filter(element => !element.hidden)
    .map(element => (element.getBoundingClientRect().bottom - canvasRect.top) / (canvasRect.height / GAME_HEIGHT));
  // 기본 게임 화면에서는 최소 235px 아래에서만 아이템이 등장합니다.
  // 매우 작은 창에서는 이 영역에 공간이 없을 수 있으며 resetItem()이 숨김 처리합니다.
  return Math.max(200, ...bottoms.map(bottom => bottom + margin));
}

// 아이템과 장애물이 생성되는 순간에만 안전 간격을 검사합니다.
// 생성된 아이템은 추적 장애물이 다가와도 위치가 바뀌지 않습니다.
const ITEM_OBSTACLE_GAP = 16;
function overlapsObstacleWithGap(candidate, obstacle) {
  return candidate.x < obstacle.x + obstacle.size + ITEM_OBSTACLE_GAP &&
         candidate.x + candidate.size + ITEM_OBSTACLE_GAP > obstacle.x &&
         candidate.y < obstacle.y + obstacle.size + ITEM_OBSTACLE_GAP &&
         candidate.y + candidate.size + ITEM_OBSTACLE_GAP > obstacle.y;
}

function isValidItemLayoutPosition(candidate) {
  return candidate.y >= getItemSafeTop() &&
         !overlapsVisibleUI(candidate);
}

function isValidItemPosition(candidate) {
  return isValidItemLayoutPosition(candidate) &&
         !overlaps(player, candidate) &&
         !obstacles.some(obstacle => overlapsObstacleWithGap(candidate, obstacle));
}

function resetItem() {
  item.collected = false;
  const maxX = Math.max(0, canvas.width - item.size);
  const maxY = Math.max(0, canvas.height - item.size);

  // 먼저 무작위 위치를 탐색합니다.
  for (let i = 0; i < 250; i++) {
    const candidate = { x: Math.random() * maxX, y: Math.random() * maxY, size: item.size };
    if (isValidItemPosition(candidate)) {
      item.x = candidate.x;
      item.y = candidate.y;
      return;
    }
  }

  // 랜덤으로 못 찾으면 일정 간격으로 탐색합니다. 가려지는 (0,0) 강제 배치는 하지 않습니다.
  const step = Math.max(5, Math.floor(item.size / 2));
  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      const candidate = { x, y, size: item.size };
      if (isValidItemPosition(candidate)) {
        item.x = x;
        item.y = y;
        return;
      }
    }
  }

  // 창이 극도로 작아 안전한 공간이 없으면 아이템을 숨기고 다음 프레임에 재시도합니다.
  item.collected = true;
}

function resetPlayer() {
  placePlayerInCenter();
  player.vx = 0;
  player.vy = 0;
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
}

// 속도를 목표 방향으로 점진적으로 변경합니다. dt를 곱하므로 주사율에 의존하지 않습니다.
function approach(current, target, maxChange) {
  if (current < target) return Math.min(current + maxChange, target);
  if (current > target) return Math.max(current - maxChange, target);
  return target;
}

function update(deltaSeconds, now) {
  let dx = Number(keys.d) - Number(keys.a);
  let dy = Number(keys.s) - Number(keys.w);
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude; // 대각선에서도 최고 속도가 같도록 정규화
  }

  const targetVx = dx * player.speed;
  const targetVy = dy * player.speed;
  const change = (magnitude > 0 ? player.acceleration : player.deceleration) * deltaSeconds;
  // 방향을 바꿨을 때도 가속도 제한을 지키도록 벡터 속도 차이를 한 번에 보간합니다.
  const deltaVx = targetVx - player.vx;
  const deltaVy = targetVy - player.vy;
  const deltaV = Math.hypot(deltaVx, deltaVy);
  if (deltaV <= change || deltaV === 0) {
    player.vx = targetVx;
    player.vy = targetVy;
  } else {
    player.vx += deltaVx / deltaV * change;
    player.vy += deltaVy / deltaV * change;
  }

  player.x += player.vx * deltaSeconds;
  player.y += player.vy * deltaSeconds;

  // 경계에서 밖으로 향하는 속도를 없애 키를 뗐을 때 미끄러지는 현상을 방지합니다.
  const maxX = Math.max(0, canvas.width - player.size);
  const maxY = Math.max(0, canvas.height - player.size);
  if ((player.x <= 0 && player.vx < 0) || (player.x >= maxX && player.vx > 0)) player.vx = 0;
  if ((player.y <= 0 && player.vy < 0) || (player.y >= maxY && player.vy > 0)) player.vy = 0;

  keepPlayerInside();
  moveObstacles(deltaSeconds);

  // 창 크기가 극도로 작아 아이템을 배치하지 못했다면 재시도합니다.
  if (item.collected) resetItem();

  // 콤보는 획득 시간 간격으로만 판단합니다. 화면 갱신 속도와 무관합니다.
  expireComboIfNeeded(now);

  // 장애물에 먼저 부딪혔다면 아이템 점수는 얻지 못함
  if (obstacles.some(obstacle => overlaps(player, obstacle))) {
    if (now >= shieldInvulnerableUntil) {
      if (gameMode === "war" && shieldAvailableThisRun && !shieldUsedThisRun) {
        // 보호막은 충돌하는 순간 소모합니다. 사용하지 않고 끝나면 보유량이 유지됩니다.
        shieldUsedThisRun = true;
        shieldAvailableThisRun = false;
        meta.shields = Math.max(0, meta.shields - 1);
        saveMeta();
        renderMeta();
        shieldInvulnerableUntil = now + SHIELD_INVULNERABILITY_MS;
        const nearest = obstacles.filter(enemy => overlaps(player, enemy))[0];
        if (nearest) {
          const dx = player.x + player.size / 2 - (nearest.x + nearest.size / 2);
          const dy = player.y + player.size / 2 - (nearest.y + nearest.size / 2);
          const norm = Math.hypot(dx, dy) || 1;
          player.x += (dx / norm) * 60;
          player.y += (dy / norm) * 60;
          keepPlayerInside();
        }
        playTone(740, 0.17, "triangle", 0.07);
        showFeedback("WAR SHIELD!", "전쟁 모드 충돌 방어 · 미확정 보너스 유지", "safe", 1050, 4);
      } else {
        finishGame("obstacle");
        return;
      }
    }
  }

  if (!item.collected && overlaps(player, item)) {
    // 4초 안에 연속으로 획득하면 10점 → 20점 → 30점(상한)을 획득합니다.
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    lastPickupAt = now;
    const points = 10 * Math.min(combo, MAX_COMBO_MULTIPLIER);
    score += points;
    if (gameMode === "war") {
      // 획득 순간부터 2초 생존 필요. 이후 획득하면 타이머가 다시 2초로 갱신됩니다.
      lastWarPickupAt = now;
      pendingWarBonus += Math.round(points * WAR_BONUS_RATE);
      warPickupCount += 1;
      const previousRisk = warStreakPickups;
      warStreakPickups = Math.min(warStreakPickups + 1, WAR_SPEED_MAX_ITEMS);
      updateObstacleSpeed();
      renderGameMode();
      const earnedBonus = Math.round(points * WAR_BONUS_RATE);
      if (warStreakPickups !== previousRisk && (warStreakPickups === 3 || warStreakPickups === 5)) {
        showFeedback(`DANGER UP! +${Math.round(currentWarSpeedBonus()*100)}%`, `WAR BONUS +${earnedBonus} · 미확정 ${pendingWarBonus}`, "war", 1100, 2);
      } else {
        showFeedback(`WAR BONUS +${earnedBonus}`, `미확정 ${pendingWarBonus}점`, "war", 750, 1);
      }
    }
    if (combo === 2 || combo === 5 || combo === 10) {
      showFeedback(combo === 2 ? "NICE!" : combo === 5 ? "GREAT!" : "AMAZING!", `${combo} COMBO!`, "combo", 1250, 3);
    }
    playPickupSound(combo);
    addPickupEffect(item.x + item.size / 2, item.y + item.size / 2, points, combo, now);
    scoreText.textContent = score;
    renderCombo(now);
    resetItem(); // 다음 아이템을 무작위 위치에 다시 생성
  }
}

// STEP 6-4.1: Visual-only Canvas redesign. All collision boxes and game logic remain unchanged.
// Deliberately avoids shadowBlur/filter and external assets to minimize render overhead.
function roundedShape(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArena() {
  ctx.fillStyle = gameMode === "war" ? "#181b2b" : "#101d2e";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.strokeStyle = gameMode === "war" ? "#362739" : "#23354a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0.5; x < GAME_WIDTH; x += 48) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
  }
  for (let y = 0.5; y < GAME_HEIGHT; y += 48) {
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
  }
  ctx.stroke();
}

function drawEnergyCrystal(now) {
  const cx = item.x + item.size / 2;
  const cy = item.y + item.size / 2;
  const r = item.size / 2;
  const pulse = 0.55 + 0.45 * Math.sin(now / 290);
  // Decorative outlines may extend beyond the item hitbox; pickup range is unchanged.
  ctx.strokeStyle = `rgba(250,204,21,${0.32 + pulse * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4 + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.strokeStyle = "#fff0a0";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 4);
  ctx.lineTo(cx + r - 4, cy);
  ctx.lineTo(cx, cy + r - 4);
  ctx.lineTo(cx - r + 4, cy);
  ctx.closePath();
  ctx.fillStyle = "#fff0a0";
  ctx.fill();
}

function drawSentinel(obstacle, now) {
  const { x, y, size } = obstacle;
  const inset = 3;
  const danger = gameMode === "war" ? currentWarSpeedBonus() : 0;
  const alertPulse = 0.30 + 0.20 * Math.sin(now / 180);
  // The thin outer line communicates danger without changing its 48px collision box.
  ctx.strokeStyle = `rgba(251,113,133,${alertPulse + danger})`;
  ctx.lineWidth = 2;
  roundedShape(x + 1, y + 1, size - 2, size - 2, 7);
  ctx.stroke();
  roundedShape(x + inset, y + inset, size - inset * 2, size - inset * 2, 6);
  ctx.fillStyle = "#b91c1c";
  ctx.fill();
  ctx.strokeStyle = "#fda4af";
  ctx.lineWidth = 2;
  ctx.stroke();
  const center = size / 2;
  ctx.strokeStyle = "#ffe1e5";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + center - 9, y + center - 9);
  ctx.lineTo(x + center + 9, y + center + 9);
  ctx.moveTo(x + center + 9, y + center - 9);
  ctx.lineTo(x + center - 9, y + center + 9);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawEnergyCore(now) {
  const { x, y, size } = player;
  const invulnerableRemaining = shieldInvulnerableUntil - now;
  const invulnerable = invulnerableRemaining > 0;
  // STEP 6-4.2: 인지 가능한 무적 상태를 유지하되 화면 깜빡임은 제거합니다.
  // 마지막 0.3초에는 보호막 외곽 링만 서서히 투명해집니다.
  const shieldFade = invulnerable ? Math.min(1, invulnerableRemaining / 300) : 0;
  const hasShield = gameMode === "war" && shieldAvailableThisRun && !shieldUsedThisRun && running;
  roundedShape(x + 2, y + 2, size - 4, size - 4, 8);
  ctx.fillStyle = invulnerable ? "#38bdf8" : "#2563eb";
  ctx.fill();
  ctx.strokeStyle = invulnerable ? "#e0f2fe" : "#93c5fd";
  ctx.lineWidth = 2;
  ctx.stroke();
  roundedShape(x + 12, y + 12, size - 24, size - 24, 4);
  ctx.fillStyle = invulnerable ? "#f0f9ff" : "#93c5fd";
  ctx.fill();
  ctx.strokeStyle = invulnerable ? "#0284c7" : "#dbeafe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const cx = x + size / 2, cy = y + size / 2;
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  if (invulnerable || hasShield) {
    ctx.save();
    ctx.globalAlpha = invulnerable ? shieldFade : 0.75;
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = invulnerable ? 3 : 2;
    roundedShape(x - 4, y - 4, size + 8, size + 8, 10);
    ctx.stroke();
    ctx.restore();
  }
}

function draw(now = performance.now()) {
  drawArena();
  if (!item.collected) drawEnergyCrystal(now);
  for (const obstacle of obstacles) drawSentinel(obstacle, now);
  drawEnergyCore(now);
  drawPickupEffects(now);
}

function updateTimer(now) {
  const remainingMs = Math.max(0, gameEndsAt - now);
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds !== lastShownTime) {
    lastShownTime = seconds;
    timeText.textContent = seconds;
  }
  const progressPercent = Math.ceil(remainingMs / GAME_DURATION_MS * 1000) / 10;
  if (Math.floor(remainingMs / 100) !== lastTimerProgressTick) {
    lastTimerProgressTick = Math.floor(remainingMs / 100);
    timerProgress.style.width = `${progressPercent}%`;
  }
  timerBoard.classList.toggle("urgent", remainingMs <= 10000);
  return remainingMs;
}

// 완료된 게임 데이터를 난이도별로 요약합니다.
function renderTestSummary() {
  summaryBody.replaceChildren();
  for (const difficulty of ["easy", "normal", "hard"]) {
    const records = testRecords.filter(record => record.difficulty === difficulty);
    const total = records.length;
    const average = (key) => total === 0 ? "-" : (records.reduce((sum, r) => sum + r[key], 0) / total).toFixed(1);
    const completionRate = total === 0 ? "-" : `${(records.filter(r => r.reason === "time").length / total * 100).toFixed(1)}%`;
    const tr = document.createElement("tr");
    for (const value of [DIFFICULTY_NAMES[difficulty], total, average("score"), total ? `${average("survival")}초` : "-", completionRate, total ? `${average("maxCombo")}연속` : "-"]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    summaryBody.appendChild(tr);
  }
}

// 전체 플레이 기록을 엑셀에서도 열 수 있는 UTF-8 CSV 파일로 저장합니다.
function exportCsv() {
  if (testRecords.length === 0) return;
  const lines = ["회차,난이도,장애물속도(px/s),최종점수,생존시간(초),종료사유,최대연속획득,확정보너스,손실보너스,전쟁중획득수,안전모드평균FPS,전쟁모드평균FPS,안전모드50ms초과프레임,전쟁모드50ms초과프레임,기본점수(코인기준),획득코인,보호막사용여부,종료시보유코인,개인최고점수"];
  testRecords.forEach((record, index) => {
    lines.push([index + 1, DIFFICULTY_NAMES[record.difficulty], DIFFICULTY_SPEEDS[record.difficulty], record.score, record.survival.toFixed(1), record.reason === "time" ? "시간 완료" : "장애물 충돌", record.maxCombo, record.securedBonus, record.lostBonus, record.warPickups, record.safeFps, record.warFps, record.safeJank, record.warJank, record.baseScore, record.earnedCoins, record.shieldUsed ? "사용" : "미사용", record.walletCoins, record.bestScore].join(","));
  });
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "blue-square-playtest.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function finishGame(reason = "time") {
  if (!running) return;
  // 종료 결과를 기록하기 전에 남아 있는 전쟁 보너스를 정산합니다.
  if (reason === "time") {
    secureWarBonus();
  } else {
    lostWarBonus += pendingWarBonus;
    pendingWarBonus = 0;
  }
  bonusResult.textContent = `전쟁 보너스: 확정 +${securedWarBonus}점 · 손실 ${lostWarBonus}점 · 전쟁 아이템 ${warPickupCount}개`;
  // 정산은 finishGame에서 한 번만 수행되므로 점수/코인 중복 지급을 방지합니다.
  // 코인은 확정 전쟁 보너스를 제외한 기본 획득 점수만 지급합니다.
  // 기본 점수는 안전/전쟁 모두에서 얻은 아이템 점수의 합이며,
  // 전쟁 중 충돌해 소멸한 미확정 보너스도 코인에 포함되지 않습니다.
  earnedCoinsThisRun = Math.max(0, Math.floor(score - securedWarBonus));
  meta.coins = Math.min(1000000000, meta.coins + earnedCoinsThisRun);
  const previousBest = meta.bestScore;
  meta.bestScore = Math.max(meta.bestScore, score);
  if (!shieldUsedThisRun) meta.bestWithoutShield = Math.max(meta.bestWithoutShield, score);
  meta.bestCombo = Math.max(meta.bestCombo, maxCombo);
  meta.totalRuns += 1;
  const unlocked = unlockAchievements(reason);
  const recordAnnouncement = document.getElementById("record-announcement");
  const announcements = [];
  if (score > previousBest) announcements.push(`🏆 NEW RECORD! ${score}점`);
  if (unlocked.length) announcements.push(`🎖 신규 도전 과제: ${unlocked.join(", ")}`);
  recordAnnouncement.hidden = announcements.length === 0;
  recordAnnouncement.textContent = announcements.join(" · ");
  saveMeta();
  renderMeta();
  economyResult.textContent = `기본 점수 ${earnedCoinsThisRun}점 → +${earnedCoinsThisRun.toLocaleString("ko-KR")} 코인 · 전쟁 보너스는 코인 제외 · 보유 ${meta.coins.toLocaleString("ko-KR")} 코인 · 최고 기록 ${meta.bestScore}점`;
  shieldResult.textContent = shieldUsedThisRun ? "🛡 전쟁 보호막 1개 사용 · 미확정 전쟁 보너스 유지" : "🛡 보호막 사용 없음 · 무보조 최고 기록 " + meta.bestWithoutShield + "점";
  playEndSound(reason);
  const survivedSeconds = Math.min(30, Math.max(0, (performance.now() - gameStartsAt) / 1000));
  endStats.textContent = `난이도: ${DIFFICULTY_NAMES[selectedDifficulty]} · 생존 시간: ${survivedSeconds.toFixed(1)}초`;
  testRecords.push({ difficulty: selectedDifficulty, score, survival: survivedSeconds, reason, maxCombo, securedBonus: securedWarBonus, lostBonus: lostWarBonus, warPickups: warPickupCount, safeFps: averageFps("safe"), warFps: averageFps("war"), safeJank: perfByMode.safe.longFrames, warJank: perfByMode.war.longFrames, baseScore: score - securedWarBonus, earnedCoins: earnedCoinsThisRun, shieldUsed: shieldUsedThisRun, walletCoins: meta.coins, bestScore: meta.bestScore });
  const performanceResult = document.getElementById("performance-result");
  performanceResult.hidden = !debugMode;
  if (debugMode) performanceResult.textContent = `성능 측정: 안전 ${averageFps("safe") || "-"} FPS / 전쟁 ${averageFps("war") || "-"} FPS · 50ms 초과 프레임 안전 ${perfByMode.safe.longFrames}회 / 전쟁 ${perfByMode.war.longFrames}회`;
  renderTestSummary();
  playRecords.unshift(`${DIFFICULTY_NAMES[selectedDifficulty]} | ${score}점 | ${survivedSeconds.toFixed(1)}초 | ${reason === "obstacle" ? "장애물 충돌" : "시간 완료"} | 최대 콤보 ${maxCombo}연속 | 전쟁 보너스 +${securedWarBonus}`);
  if (playRecords.length > 3) playRecords.pop();
  recordList.replaceChildren();
  for (const record of playRecords) {
    const li = document.createElement("li");
    li.textContent = record;
    recordList.appendChild(li);
  }
  running = false;
  feedbackUntil = 0;
  updateFeedback(performance.now());
  animationId = null;
  lastFrameAt = null;
  keys.w = keys.a = keys.s = keys.d = false;
  player.vx = player.vy = 0;
  restartButton.hidden = true;
  scoreBoard.hidden = true;
  timerBoard.hidden = true;
  obstacleBoard.hidden = true;
  finalScoreText.textContent = score;
  finalComboText.textContent = `${maxCombo}연속`;
  comboBoard.hidden = true;
  modeBoard.hidden = true;
  perfPanel.hidden = true;
  document.getElementById("end-title").textContent = reason === "obstacle" ? "게임 오버!" : "시간 종료!";
  document.getElementById("end-reason").textContent = reason === "obstacle"
    ? "빨간 장애물에 닿았어요."
    : "30초가 지났어요.";
  endScreen.hidden = false;
}

function loop(now) {
  if (!running) return;

  // 화면이 잠시 멈춰도 제한 시간은 실제 경과 시간 기준으로 계산됩니다.
  if (updateTimer(now) === 0) {
    finishGame();
    return;
  }

  // 프레임 간 실제 경과 시간(초)을 계산해 플레이어와 장애물 모두 동일한 초당 속도를 사용합니다.
  // 백그라운드 탭 복귀 시 순간이동을 막기 위해 최대 0.05초로 제한합니다.
  const deltaSeconds = lastFrameAt === null ? 0 : Math.min((now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;
  trackPerformance(now);
  addObstaclesForElapsedTime(now);
  update(deltaSeconds, now);
  prunePickupEffects(now);
  updateFeedback(now);
  updateWarLockDisplay(now);
  draw(now);
  if (running) animationId = requestAnimationFrame(loop);
}

function startGame() {
  if (!helpOverlay.hidden) return;
  ensureAudio();
  selectedDifficulty = difficultySelect.value;
  obstacleSpeed = DIFFICULTY_SPEEDS[selectedDifficulty];
  // 새로운 30초 게임 시작: 점수·위치·아이템·시계를 전부 초기화합니다.
  if (animationId !== null) cancelAnimationFrame(animationId);
  running = false;
  lastFrameAt = null;
  resetPerformance();
  shieldAvailableThisRun = meta.shields > 0;
  shieldUsedThisRun = false;
  shieldInvulnerableUntil = 0;
  earnedCoinsThisRun = 0;
  lastComboDisplay = "";
  lastComboRemaining = "";
  feedbackUntil = 0;
  updateFeedback(performance.now());
  gameMode = "safe";
  lastWarPickupAt = null;
  lastWarLockDisplay = "";
  warStreakPickups = 0;
  pendingWarBonus = 0;
  securedWarBonus = 0;
  lostWarBonus = 0;
  warPickupCount = 0;
  updateObstacleSpeed();
  renderGameMode();
  resetScore();
  pickupEffects.length = 0;
  resetCombo();
  resetPlayer();
  obstacles.length = 0;

  // HUD를 먼저 표시해야 실제 버튼 좌표를 기준으로 아이템 위치를 검사할 수 있습니다.
  startScreen.hidden = true;
  endScreen.hidden = true;
  restartButton.hidden = false;
  scoreBoard.hidden = false;
  timerBoard.hidden = false;
  obstacleBoard.hidden = false;
  comboBoard.hidden = false;
  modeBoard.hidden = false;
  perfPanel.hidden = !debugMode;

  // 먼저 장애물을 배치하고, 그 장애물과 겹치지 않는 곳에 아이템을 생성합니다.
  // 지난 게임 아이템이 새 장애물 배치를 방해하지 않도록 처리합니다.
  item.collected = true;
  spawnObstacle();
  resetItem();
  lastShownTime = 30;
  lastTimerProgressTick = -1;
  timeText.textContent = 30;
  timerProgress.style.width = "100%";
  timerBoard.classList.remove("urgent");
  gameStartsAt = performance.now();
  gameEndsAt = gameStartsAt + GAME_DURATION_MS;

  draw();
  running = true;
  animationId = requestAnimationFrame(loop);
}

function restartGame() {
  startGame();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && running) {
    event.preventDefault();
    if (!event.repeat) toggleGameMode(); // 누르고 있는 동안 반복 전환 방지
    return;
  }
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = true;
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
  }
});

// STEP 6-5.2: 한 번 읽으면 자동으로 다시 뜨지 않는 첫 방문 게임 방법.
// 기존 코인/기록 저장 키는 변경하지 않습니다.
const HELP_SEEN_KEY = "blue-collector-help-seen-v1";
const helpOverlay = document.getElementById("help-overlay");
const helpOpenButton = document.getElementById("help-start-button");
const helpCloseButton = document.getElementById("help-close-button");
const helpDoneButton = document.getElementById("help-done-button");
let previousHelpFocus = null;
function openHelp(trigger = null) {
  if (running || !shopOverlay.hidden || !achievementsOverlay.hidden || !settingsOverlay.hidden) return;
  previousHelpFocus = trigger || document.activeElement;
  helpOverlay.hidden = false;
  helpDoneButton.focus();
}
function closeHelp() {
  if (helpOverlay.hidden) return;
  helpOverlay.hidden = true;
  try { localStorage.setItem(HELP_SEEN_KEY, "1"); } catch (_) { /* 스토리지 제한에서도 정상 동작 */ }
  if (previousHelpFocus && document.contains(previousHelpFocus)) previousHelpFocus.focus();
  else startButton.focus();
}
helpOpenButton.addEventListener("click", () => openHelp(helpOpenButton));
helpCloseButton.addEventListener("click", closeHelp);
helpDoneButton.addEventListener("click", closeHelp);
window.addEventListener("keydown", event => {
  if (helpOverlay.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeHelp(); }
  // 게임 키 입력 및 뒤쪽 버튼으로 포커스가 이동하지 않도록 팝업 내부에 묶습니다.
  if (event.key === "Tab") {
    const focusables = [helpCloseButton, helpDoneButton];
    const index = focusables.indexOf(document.activeElement);
    if (event.shiftKey && (index === 0 || index === -1)) { event.preventDefault(); helpDoneButton.focus(); }
    else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); helpCloseButton.focus(); }
  }
});
let helpSeen = false;
try { helpSeen = localStorage.getItem(HELP_SEEN_KEY) === "1"; } catch (_) {}
if (!helpSeen) openHelp();

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
playAgainButton.addEventListener("click", startGame);
exportCsvButton.addEventListener("click", exportCsv);
changeDifficultyButton.addEventListener("click", () => {
  endScreen.hidden = true;
  startScreen.hidden = false;
  restartButton.hidden = true;
  scoreBoard.hidden = true;
  timerBoard.hidden = true;
  obstacleBoard.hidden = true;
  comboBoard.hidden = true;
  modeBoard.hidden = true;
  perfPanel.hidden = true;
  document.getElementById("game").classList.remove("war-mode");
});

// 다른 창으로 전환했을 때 키가 눌린 채로 남지 않도록 처리
window.addEventListener("blur", () => {
  keys.w = keys.a = keys.s = keys.d = false;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

resizeCanvas();
placePlayerInCenter();
resetItem();
draw();
