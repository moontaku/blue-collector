const canvas = document.getElementById("canvas");
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const gameStage = document.getElementById("game");
const feedbackLayer = document.getElementById("feedback-layer");
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
  feedbackLayer.classList.toggle("mode-change", kind.includes("mode-change"));
  feedbackPrimary.textContent = primary;
  feedbackSecondary.textContent = secondary;
  feedbackPrimary.className = `active ${kind}`;
  feedbackSecondary.className = secondary ? `active ${kind}` : "";
}
function updateFeedback(now) {
  if (feedbackUntil && now >= feedbackUntil) {
    feedbackUntil = 0;
    feedbackPriority = 0;
    feedbackLayer.classList.remove("mode-change");
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
const nearMissResult = document.getElementById("near-miss-result");
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
  effectButton.textContent = effectsEnabled ? "EFFECTS ON" : "EFFECTS OFF";
  effectButton.setAttribute("aria-pressed", String(effectsEnabled));
  gameStage.classList.toggle("low-effects", !effectsEnabled);
  if (!effectsEnabled) {
    feedbackUntil = 0;
    feedbackPriority = 0;
    feedbackLayer.classList.remove("mode-change");
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
    const display = `${gameMode === "war" ? "위험" : "안전"} FPS ${fps} · 끊김 ${perfLongFrames}회`;
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
// AUDIO v1.1.1: 기존 메타/도전 과제 저장값과 분리한 오디오 취향 설정.
// 기존 사용자는 저장값이 없으므로 SFX와 MUSIC 모두 ON이 기본입니다.
const AUDIO_PREFERENCES_KEY = "blue-collector-audio-v1";
function loadAudioPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) || "null");
    return {
      sound: typeof raw?.sound === "boolean" ? raw.sound : true,
      music: typeof raw?.music === "boolean" ? raw.music : true
    };
  } catch (_) {
    return { sound: true, music: true }; // 사파리 비공개 모드 등 저장소 접근 실패
  }
}
const initialAudioPreferences = loadAudioPreferences();
let soundEnabled = initialAudioPreferences.sound;
let bgmEnabled = initialAudioPreferences.music;
function saveAudioPreferences() {
  try {
    localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({
      sound: soundEnabled, music: bgmEnabled
    }));
  } catch (_) { /* 저장 실패는 게임 실행이나 버튼 변경을 막지 않습니다. */ }
}
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
  soundButton.textContent = soundEnabled ? "SFX ON" : "SFX OFF";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
}
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();
  saveAudioPreferences();
  if (soundEnabled) {
    ensureAudio();
    startBgm(); // 게임 중이라면 사용자가 소리를 다시 켠 클릭으로 재생 재시도
  } else {
    pauseBgm(); // SOUND(SFX) OFF는 BGM도 음소거. MUSIC 취향 값은 유지
  }
  syncSettingsAudio();
});
updateSoundButton(); // 최초 진입 시에도 이모지 대신 상태 텍스트를 표시



// AUDIO v1.1.1: START GAME 클릭을 BGM의 첫 재생 사용자 제스처로 활용.
// SFX OFF는 모든 소리를 음소거하고, MUSIC은 별도의 재생 선호도로 유지합니다.
const bgmButton = document.getElementById("bgm-button");
const bgmAudio = new Audio("blue-collector-bgm-original.wav");
bgmAudio.loop = true;
bgmAudio.preload = "auto";
bgmAudio.volume = 0.18; // 기존 음량 유지
let bgmStartAuthorized = false; // 실제 START GAME / 처음 도움말 완료 클릭 이후에만 true
let bgmPlayAttempt = 0;
let bgmPlayPending = false;
function updateBgmButton() {
  bgmButton.textContent = bgmEnabled ? "MUSIC ON" : "MUSIC OFF";
  bgmButton.setAttribute("aria-pressed", String(bgmEnabled));
}
function startBgm() {
  if (!soundEnabled || !bgmEnabled || !bgmStartAuthorized) return;
  if (!bgmAudio.paused || bgmPlayPending) return; // 중복 play()/재시작 방지
  const attempt = ++bgmPlayAttempt;
  bgmPlayPending = true;
  try {
    const result = bgmAudio.play();
    if (result && typeof result.then === "function") {
      result.then(() => {
        if (attempt === bgmPlayAttempt) bgmPlayPending = false;
      }).catch(() => {
        if (attempt !== bgmPlayAttempt) return; // 사용자가 끈 뒤 발생한 AbortError 등
        bgmPlayPending = false;
        // 브라우저/장치가 재생을 거절했다면 ON이라는 잘못된 표시를 남기지 않음.
        // 재생 제한은 일시적일 수 있으므로 이 자동 OFF는 저장하지 않습니다.
        bgmEnabled = false;
        updateBgmButton();
        syncSettingsAudio();
      });
    } else {
      bgmPlayPending = false;
    }
  } catch (_) {
    if (attempt !== bgmPlayAttempt) return;
    bgmPlayPending = false;
    bgmEnabled = false;
    updateBgmButton();
    syncSettingsAudio();
  }
}
function pauseBgm() {
  bgmPlayAttempt++; // 이전 play()의 비동기 결과가 새 상태를 덮지 못하게 함
  bgmPlayPending = false;
  bgmAudio.pause();
  // currentTime을 0으로 되돌리지 않음: 재시작 시 곡을 처음부터 다시 재생하지 않음.
}
bgmButton.addEventListener("click", () => {
  bgmEnabled = !bgmEnabled;
  saveAudioPreferences();
  updateBgmButton();
  if (bgmEnabled) startBgm();
  else pauseBgm();
  syncSettingsAudio();
});
updateBgmButton();


// REDESIGN 02: 설정 페이지의 사운드 메뉴는 기존 사운드 버튼을 그대로 조작합니다.
const settingsSoundToggle = document.getElementById("settings-sound-toggle");
const settingsBgmToggle = document.getElementById("settings-bgm-toggle");
function syncSettingsAudio() {
  settingsSoundToggle.textContent = soundEnabled ? "SFX : ON" : "SFX : OFF";
  settingsBgmToggle.textContent = bgmEnabled ? "MUSIC : ON" : "MUSIC : OFF";
  settingsSoundToggle.setAttribute("aria-pressed", String(soundEnabled));
  settingsBgmToggle.setAttribute("aria-pressed", String(bgmEnabled));
}
settingsSoundToggle.addEventListener("click", () => { soundButton.click(); syncSettingsAudio(); });
settingsBgmToggle.addEventListener("click", () => { bgmButton.click(); syncSettingsAudio(); });
syncSettingsAudio();


const GAME_VERSION = "v1.2.3-test"; // 표시용 버전. 규칙/CSV/저장 구조와 무관.
document.getElementById("game-version").textContent = GAME_VERSION;

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
// STEP 08: 새 적의 실제 생성 위치를 최소 1초 동안 미리 보여줍니다.
const OBSTACLE_WARNING_MS = 1000;

// GAMEPLAY 11: NEAR MISS test parameters (display/gameplay experiment only).
const NEAR_MISS_GAP_PX = 24;
const NEAR_MISS_POINTS = 20;
const NEAR_MISS_COOLDOWN_MS = 2000;
const NEAR_MISS_MAX_PER_RUN = 10;
const NEAR_MISS_SPAWN_GRACE_MS = 1000;

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
  { id: "war10", name: "위험을 즐기는 자", description: "한 판의 위험 모드에서 아이템 10개 획득" },
  { id: "warfinish", name: "위험 생존자", description: "위험 모드에서 아이템을 1개 이상 획득하고 30초 완주" }
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
  buyShieldButton.textContent = meta.shields >= MAX_SHIELDS ? "SHIELD LIMIT 3" : meta.coins < SHIELD_PRICE ? "COINS REQUIRED" : "BUY SHIELD";
}
// STEP 6-3: achievement / personal records overlays. All data shares the existing save key.
const achievementsOverlay = document.getElementById("achievements-overlay");
const settingsOverlay = document.getElementById("settings-overlay");
let lastMetaTrigger = null;
function renderAchievements() {
  const summary = document.getElementById("record-summary");
  summary.replaceChildren();
  for (const [title, value] of [["HIGH SCORE", `${meta.bestScore} PTS`], ["NO-SHIELD BEST", `${meta.bestWithoutShield} PTS`], ["MAX COMBO", `${meta.bestCombo} HIT`], ["TOTAL RUNS", `${meta.totalRuns}`]]) {
    const el = document.createElement("div"); el.className="record-cell";
    const label = document.createElement("span"); label.textContent=title;
    const strong = document.createElement("strong"); strong.textContent=value;
    el.append(label,strong); summary.append(el);
  }
  const list=document.getElementById("achievements-list"); list.replaceChildren();
  for (const entry of ACHIEVEMENTS) {
    const unlocked = meta.achievements?.[entry.id] === true;
    const el = document.createElement("div"); el.className = `achievement-row ${unlocked ? "unlocked" : "locked"}`;
    const symbol = document.createElement("span"); symbol.className="achievement-symbol"; symbol.textContent=unlocked?"■":"□";
    const body = document.createElement("div");
    const name = document.createElement("strong"); name.textContent=entry.name;
    const desc=document.createElement("small"); desc.textContent=entry.description;
    body.append(name,desc);
    const state=document.createElement("span"); state.className="achievement-state"; state.textContent=unlocked?"CLEAR":"LOCKED";
    el.append(symbol,body,state); list.append(el);
  }
}
function openMetaOverlay(which, trigger) {
  if (running || !shopOverlay.hidden) return;
  lastMetaTrigger=trigger;
  if (which === "achievements") { renderAchievements(); achievementsOverlay.hidden=false; document.getElementById("achievements-close").focus(); }
  else { syncSettingsAudio(); settingsOverlay.hidden=false; document.getElementById("settings-close").focus(); }
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
  shopMessage.textContent = "구매 완료! 다음 플레이의 위험 모드에서 충돌하면 자동 발동합니다.";
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
// 적 객체를 키로 사용해 근접 상태와 등장 시각을 별도로 기록합니다.
// 기존 적의 위치/크기/이동 로직과 저장 데이터 구조를 건드리지 않습니다.
let nearMissStates = new WeakMap();
let nearMissCount = 0;
let nearMissPoints = 0;
function registerNearMissEnemy(obstacle, spawnedAt = performance.now()) {
  nearMissStates.set(obstacle, { spawnedAt, nearby: false, lastAwardedAt: -Infinity });
}

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
    const color = "#F5CF37";
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${effect.streak >= 3 ? 30 : 25}px "Apple SD Gothic Neo", sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#0B0B10";
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

// v1.2.3-test: NEAR MISS canvas feedback, independent of pickup/scoring logic.
const nearMissEffects = [];
const NEAR_MISS_EFFECT_DURATION_MS = 800;
let nearMissHintShown = false; // Page-session only: no storage key.
function addNearMissEffect(now) {
  if (!effectsEnabled) return;
  const showHint = !nearMissHintShown;
  nearMissHintShown = true;
  const centerX = player.x + player.size / 2;
  // Avoid the upper HUD and screen edges; keep the text beside the player.
  const below = player.y < 180;
  const baseY = below ? player.y + player.size + 29 : player.y - 27;
  nearMissEffects.push({ x: centerX, y: baseY, below, createdAt: now, showHint });
  if (nearMissEffects.length > 8) nearMissEffects.shift();
}
function drawNearMissEffects(now) {
  if (!effectsEnabled) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0B0B10";
  for (const effect of nearMissEffects) {
    const t = Math.max(0, Math.min(1, (now - effect.createdAt) / NEAR_MISS_EFFECT_DURATION_MS));
    ctx.globalAlpha = t < 0.62 ? 1 : Math.max(0, (1 - t) / 0.38);
    const y = Math.max(18, Math.min(GAME_HEIGHT - 25, effect.y - 25 * t));
    const title = `NEAR MISS +${NEAR_MISS_POINTS}`;
    ctx.font = 'bold 22px "Apple SD Gothic Neo", sans-serif';
    const titleHalf = ctx.measureText(title).width / 2;
    const x = Math.max(titleHalf + 8, Math.min(GAME_WIDTH - titleHalf - 8, effect.x));
    ctx.strokeText(title, x, y);
    ctx.fillStyle = "#6DE5F2";
    ctx.fillText(title, x, y);
    if (effect.showHint) {
      ctx.font = 'bold 12px "Apple SD Gothic Neo", sans-serif';
      const hint = "적을 아슬하게 지나면 +20";
      const hintHalf = ctx.measureText(hint).width / 2;
      const hintX = Math.max(hintHalf + 8, Math.min(GAME_WIDTH - hintHalf - 8, effect.x));
      const hintY = effect.below ? Math.min(GAME_HEIGHT - 12, y + 21) : Math.max(12, y - 21);
      ctx.strokeText(hint, hintX, hintY);
      ctx.fillStyle = "#C5F9FF";
      ctx.fillText(hint, hintX, hintY);
    }
  }
  ctx.restore();
}
function pruneNearMissEffects(now) {
  for (let i = nearMissEffects.length - 1; i >= 0; i--) {
    if (now - nearMissEffects[i].createdAt >= NEAR_MISS_EFFECT_DURATION_MS) nearMissEffects.splice(i, 1);
  }
}

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};
const arrowToDirection = { ArrowUp: "w", ArrowLeft: "a", ArrowDown: "s", ArrowRight: "d" };
const heldWasd = { w: false, a: false, s: false, d: false };
const heldArrows = { w: false, a: false, s: false, d: false };
function setMovementInput(event, down) {
  const arrowDirection = arrowToDirection[event.code];
  const letter = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" }[event.code];
  const direction = arrowDirection || letter || null;
  if (!direction) return false;
  if (arrowDirection) heldArrows[direction] = down;
  else heldWasd[direction] = down;
  keys[direction] = heldWasd[direction] || heldArrows[direction];
  return true;
}
function clearMovementInput() {
  for (const direction of ["w", "a", "s", "d"]) {
    keys[direction] = heldWasd[direction] = heldArrows[direction] = false;
  }
}

// STEP 5-2: 전쟁 모드에서는 기본/콤보 점수의 50%를 미확정 보너스로 적립합니다.
// 안전 모드로 복귀하면 확정되고, 전쟁 중 충돌하면 미확정분만 잃습니다.
// 제한 시간 종료 시에는 미확정 보너스를 자동 확정합니다.
const WAR_BONUS_RATE = 0.5;
// STEP 5-6: 전쟁 모드에서 마지막으로 아이템을 획득한 뒤 2초를 생존해야 안전 모드 복귀 가능.
// 전쟁 모드에 진입만 했다면 잠금 없음. 추가 아이템을 먹을 때마다 2초 타이머를 갱신.
const WAR_PICKUP_SURVIVAL_MS = 2000;
let lastWarPickupAt = null;
let lastWarLockDisplay = "";
let bankReadyNoticeShown = false;
function remainingWarLockMs(now = performance.now()) {
  return gameMode === "war" && lastWarPickupAt !== null
    ? Math.max(0, WAR_PICKUP_SURVIVAL_MS - (now - lastWarPickupAt)) : 0;
}
function updateWarLockDisplay(now = performance.now()) {
  const element = document.getElementById("war-lock-status");
  const remaining = remainingWarLockMs(now);
  const canBank = gameMode === "war" && lastWarPickupAt !== null && remaining === 0 && pendingWarBonus > 0;
  if (!canBank) {
    bankReadyNoticeShown = false;
  } else if (!bankReadyNoticeShown) {
    bankReadyNoticeShown = true;
    showFeedback(`SPACE → 안전 복귀 · +${pendingWarBonus} 확정`, "", "mode-change bank-ready", 950, 3);
  }
  const message = gameMode !== "war"
    ? "SPACE : RISK"
    : remaining > 0
      ? `LOCK ${(remaining / 1000).toFixed(1)}s`
      : canBank
        ? `SPACE → 안전 복귀 · +${pendingWarBonus} 확정`
        : "SPACE : SAFE";
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
  modeText.textContent = isWar ? "RISK MODE" : "SAFE MODE";
  bonusStatus.textContent = isWar
    ? `PENDING +${pendingWarBonus}  /  BONUS 50%`
    : `SECURED +${securedWarBonus}`;
  const speedBonusPercent = Math.round(currentWarSpeedBonus() * 100);
  dangerStatus.textContent = isWar
    ? `RISK ${Math.min(warStreakPickups, WAR_SPEED_MAX_ITEMS)}/5  /  SPEED +${speedBonusPercent}%`
    : `RISK 0/5  /  CHASERS ${obstacleSpeed.toFixed(0)}px/s`;
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
    if (justSecured > 0) {
      showFeedback(`BONUS SECURED +${justSecured}`, "SAFE MODE", "safe mode-change bank-secured", 1000, 5);
    } else {
      showFeedback("SAFE MODE", "위험도 초기화", "safe mode-change", 750, 2);
    }
    gameMode = "safe";
    lastWarPickupAt = null;
    warStreakPickups = 0;
  } else {
    gameMode = "war";
    lastWarPickupAt = null;
    warStreakPickups = 0;
    showFeedback("RISK MODE", "아이템 획득 시 2초 생존 · 보너스 +50%", "war mode-change", 800, 2);
  }
  updateObstacleSpeed();
  renderGameMode();
}
let running = false;
let readyActive = false;
let readyTimerId = null;
let readyGeneration = 0;
const READY_DURATION_MS = 1500;
const readyOverlay = document.getElementById("ready-overlay");
function cancelReady() {
  readyGeneration += 1;
  if (readyTimerId !== null) clearTimeout(readyTimerId);
  readyTimerId = null;
  readyActive = false;
  readyOverlay.hidden = true;
}
function startReadyGame() {
  if (!readyActive) return;
  cancelReady(); // Cancels timeout and prevents a second GO from starting another loop.
  gameStartsAt = performance.now();
  // READY 동안 소비된 유예 시간을 GO 시점 기준으로 돌림.
  obstacles.forEach(enemy => registerNearMissEnemy(enemy, gameStartsAt));
  gameEndsAt = gameStartsAt + GAME_DURATION_MS;
  lastFrameAt = null;
  running = true;
  draw(gameStartsAt); // GO 후 안내 라벨은 화면에 유지하고 매 프레임 갱신.
  animationId = requestAnimationFrame(loop);
}
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
    if (lastComboDisplay !== "×0") { comboText.textContent = "×0"; lastComboDisplay = "×0"; }
    if (lastComboRemaining !== "") { comboTimeText.textContent = ""; lastComboRemaining = ""; }
    return;
  }
  const remaining = Math.max(0, COMBO_WINDOW_MS - (now - lastPickupAt));
  const comboLabel = `×${Math.min(combo, MAX_COMBO_MULTIPLIER)}`;
  const remainingLabel = `${combo} HIT  /  ${(remaining / 1000).toFixed(1)}s`;
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
let pendingObstacleWarning = null; // 위치, 예고 시작 시점, 예정 등장 시점

function centerDistance(a, b) {
  return Math.hypot(a.x + a.size / 2 - (b.x + b.size / 2),
                    a.y + a.size / 2 - (b.y + b.size / 2));
}

function findObstacleSpawnPosition() {
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
  return { x: selected.x, y: selected.y, size };
}

// 시작 시 최초 적은 즉시 등장. 이후 적은 사전에 예고된 좌표에만 등장합니다.
function spawnObstacle(position = null) {
  const selected = position ?? findObstacleSpawnPosition();
  if (!selected) return false;
  const obstacle = { x: selected.x, y: selected.y, size: selected.size };
  obstacles.push(obstacle);
  registerNearMissEnemy(obstacle);
  obstacleCountText.textContent = obstacles.length;
  return true;
}

// GAMEPLAY 09: 기본 추적은 유지하되, 겹침에 가까워지면 이동 방향만 보정합니다.
// 속도 상한, 크기, 적 생성과 충돌 판정은 기존 규칙을 유지합니다.
const ENEMY_SEPARATION_RADIUS = 95; // 적 48px 기준, 근접했을 때만 반발 방향 추가
const ENEMY_SEPARATION_STRENGTH = 3.0; // 첫 밸런스 테스트용; 확정 수치 아님

function moveObstacles(deltaSeconds) {
  // 같은 프레임 안에서 앞 적의 이동 결과가 뒤 적의 판단에 영향을 주지 않도록 고정 위치 사용.
  const snapshot = obstacles.map(({ x, y, size }) => ({ x, y, size }));
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    const origin = snapshot[i];
    const dx = player.x + player.size / 2 - (origin.x + origin.size / 2);
    const dy = player.y + player.size / 2 - (origin.y + origin.size / 2);
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue; // 기존: 플레이어 중심에 도착하면 이동 종료
    const chaseX = dx / distance;
    const chaseY = dy / distance;

    let avoidX = 0;
    let avoidY = 0;
    for (let j = 0; j < snapshot.length; j++) {
      if (i === j) continue;
      const other = snapshot[j];
      const awayX = origin.x + origin.size / 2 - (other.x + other.size / 2);
      const awayY = origin.y + origin.size / 2 - (other.y + other.size / 2);
      const gap = Math.hypot(awayX, awayY);
      if (gap >= ENEMY_SEPARATION_RADIUS) continue;
      // 두 적의 중심이 완전히 같아도 NaN 없이 서로 반대 방향으로 벗어나게 처리.
      const unitX = gap > 0.0001 ? awayX / gap : (i < j ? -1 : 1);
      const unitY = gap > 0.0001 ? awayY / gap : 0;
      const weight = ((ENEMY_SEPARATION_RADIUS - gap) / ENEMY_SEPARATION_RADIUS)
        * ENEMY_SEPARATION_STRENGTH;
      avoidX += unitX * weight;
      avoidY += unitY * weight;
    }

    const steerX = chaseX + avoidX;
    const steerY = chaseY + avoidY;
    const steerLength = Math.hypot(steerX, steerY);
    if (steerLength < 0.000001) continue;
    // 기존과 동일한 초당 이동거리 상한. 분리 벡터가 속도를 높이지 않도록 정규화.
    const step = Math.min(obstacleSpeed * deltaSeconds, distance);
    obstacle.x += (steerX / steerLength) * step;
    obstacle.y += (steerY / steerLength) * step;
    keepObstacleInside(obstacle);
  }
}

function addObstaclesForElapsedTime(now) {
  const nextEnemyIndex = obstacles.length; // 1개 존재 → 10초, 2개 존재 → 20초
  if (nextEnemyIndex >= MAX_OBSTACLES) {
    pendingObstacleWarning = null;
    return;
  }

  const dueAt = gameStartsAt + nextEnemyIndex * OBSTACLE_ADD_INTERVAL_MS;
  if (now < dueAt - OBSTACLE_WARNING_MS) return;

  if (!pendingObstacleWarning) {
    // 기존 위치 선정의 260px 선호 / 110px 최소 거리와 후보 탐색 규칙은 유지.
    const position = findObstacleSpawnPosition();
    if (!position) return;
    pendingObstacleWarning = { ...position, warnedAt: now, dueAt };
  }

  // 예고 위치를 1초 이상 노출하고, 기존 등장 예정 시각도 지나야 생성합니다.
  if (now < Math.max(pendingObstacleWarning.warnedAt + OBSTACLE_WARNING_MS,
                     pendingObstacleWarning.dueAt)) return;

  // STEP 09.1: 경고한 위치를 끝까지 고정합니다.
  // 플레이어가 경고 칸으로 접근해도 다른 위치를 새로 뽑지 않습니다.
  // 예고 시간(1초)과 예정 시각이 지나면 반드시 그 위치에서 등장합니다.
  // 주의: 그 자리에 서 있으면 기존 충돌 규칙에 따라 즉시 위험해질 수 있습니다.
  spawnObstacle(pendingObstacleWarning);
  pendingObstacleWarning = null;
}

function overlaps(a, b) {
  return a.x < b.x + b.size &&
         a.x + a.size > b.x &&
         a.y < b.y + b.size &&
         a.y + a.size > b.y;
}

// 두 정사각형의 실제 가장자리 사이 최단 거리: 대각선 방향도 직각 거리로 계산.
// 충돌 판정(overlaps)은 그대로 사용하고, NEAR MISS 근접 판단에만 활용합니다.
function rectangleEdgeGap(a, b) {
  const horizontalGap = Math.max(0, a.x - (b.x + b.size), b.x - (a.x + a.size));
  const verticalGap = Math.max(0, a.y - (b.y + b.size), b.y - (a.y + a.size));
  return Math.hypot(horizontalGap, verticalGap);
}

function updateNearMisses(now) {
  if (nearMissCount >= NEAR_MISS_MAX_PER_RUN) return;
  const invulnerable = now < shieldInvulnerableUntil;
  for (const enemy of obstacles) {
    let state = nearMissStates.get(enemy);
    if (!state) {
      registerNearMissEnemy(enemy, now);
      state = nearMissStates.get(enemy);
    }

    // 등장 직후 / 충돌 / 보호막 무적 중에는 어떤 근접 기록도 쌓지 않습니다.
    if (now - state.spawnedAt < NEAR_MISS_SPAWN_GRACE_MS ||
        invulnerable || overlaps(player, enemy)) {
      state.nearby = false;
      continue;
    }

    const gap = rectangleEdgeGap(player, enemy);
    if (gap <= NEAR_MISS_GAP_PX) {
      // 쿨다운 중 접촉은 새 근접 이벤트로 인정하지 않습니다.
      if (now - state.lastAwardedAt >= NEAR_MISS_COOLDOWN_MS) state.nearby = true;
    } else if (gap > NEAR_MISS_GAP_PX + 6 && state.nearby) {
      state.nearby = false;
      if (now - state.lastAwardedAt < NEAR_MISS_COOLDOWN_MS) continue;
      if (nearMissCount >= NEAR_MISS_MAX_PER_RUN) break;
      state.lastAwardedAt = now;
      nearMissCount += 1;
      nearMissPoints += NEAR_MISS_POINTS;
      score += NEAR_MISS_POINTS; // 기본 점수: 코인에 포함, 콤보/전쟁 보너스에는 제외
      scoreText.textContent = score;
      addNearMissEffect(now);
    }
  }
}

// 플레이어/적이 실제 HUD 영역 아래에 있을 때 HUD만 반투명하게 표시합니다.
// Canvas(게임 좌표)와 DOM(HUD 화면 좌표)을 동일한 기준으로 비교합니다.
function updateModeBoardOcclusion() {
  const hudBoards = [scoreBoard, comboBoard, obstacleBoard, timerBoard, modeBoard];
  const controlButtons = [restartButton, soundButton, bgmButton];
  if (hudBoards.every(board => board.hidden)) {
    [...hudBoards, ...controlButtons].forEach(board => board.classList.remove("hud-occluded"));
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / GAME_WIDTH;
  const scaleY = canvasRect.height / GAME_HEIGHT;
  if (!scaleX || !scaleY) return;
  for (const board of [...hudBoards, ...controlButtons]) {
    if (board.hidden) {
      board.classList.remove("hud-occluded");
      continue;
    }
    const hudRect = board.getBoundingClientRect();
    const left = (hudRect.left - canvasRect.left) / scaleX;
    const right = (hudRect.right - canvasRect.left) / scaleX;
    const top = (hudRect.top - canvasRect.top) / scaleY;
    const bottom = (hudRect.bottom - canvasRect.top) / scaleY;
    const overlapsHud = entity =>
      entity.x < right && entity.x + entity.size > left &&
      entity.y < bottom && entity.y + entity.size > top;
    board.classList.toggle("hud-occluded", overlapsHud(player) || obstacles.some(overlapsHud));
  }
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

// GAMEPLAY 10: 무작위성은 유지하면서 접근 가능한 위치와 적 간격을 우선합니다.
// 이 값들은 새 플레이 테스트에서 조정할 초기 제안값이며 점수/속도 규칙은 변경하지 않습니다.
const ITEM_PREFERRED_NEAR_DISTANCE = 100;
const ITEM_PREFERRED_FAR_DISTANCE = 350;
const ITEM_PREFERRED_ENEMY_DISTANCE = 150;
const ITEM_POSITION_SAMPLES = 250; // 기존 랜덤 탐색 250회 유지
function isPreferredItemPosition(candidate) {
  const playerDistance = centerDistance(candidate, player);
  if (playerDistance < ITEM_PREFERRED_NEAR_DISTANCE ||
      playerDistance > ITEM_PREFERRED_FAR_DISTANCE) return false;
  if (obstacles.some(obstacle => centerDistance(candidate, obstacle) < ITEM_PREFERRED_ENEMY_DISTANCE)) return false;
  if (pendingObstacleWarning && centerDistance(candidate, pendingObstacleWarning) < ITEM_PREFERRED_ENEMY_DISTANCE) return false;
  return true;
}

function resetItem() {
  item.collected = false;
  const maxX = Math.max(0, canvas.width - item.size);
  const maxY = Math.max(0, canvas.height - item.size);
  const preferred = [];
  let fallback = null;

  // 기존 유효 위치 조건(HUD, 플레이어, 적 + 16px)을 반드시 통과한 후보만 사용.
  for (let i = 0; i < ITEM_POSITION_SAMPLES; i++) {
    const candidate = { x: Math.random() * maxX, y: Math.random() * maxY, size: item.size };
    if (!isValidItemPosition(candidate)) continue;
    if (!fallback) fallback = candidate;
    if (isPreferredItemPosition(candidate)) preferred.push(candidate);
  }
  const selected = preferred.length
    ? preferred[Math.floor(Math.random() * preferred.length)]
    : fallback;
  if (selected) {
    item.x = selected.x;
    item.y = selected.y;
    return;
  }

  // 기존 격자 폴백 유지: 어려운 지형에서도 유효한 후보가 있으면 반드시 배치.
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
  clearMovementInput();
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
        showFeedback("RISK SHIELD!", "위험 모드 충돌 방어 · 미확정 보너스 유지", "safe", 1050, 4);
      } else {
        finishGame("obstacle");
        return;
      }
    }
  }

  // 기존 적 충돌/보호막 처리 이후, 아이템 획득 및 콤보 갱신 이전에 실행.
  updateNearMisses(now);

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
        showFeedback(`DANGER UP! +${Math.round(currentWarSpeedBonus()*100)}%`, `RISK BONUS +${earnedBonus} · 미확정 ${pendingWarBonus}`, "war", 1100, 2);
      } else {
        showFeedback(`RISK BONUS +${earnedBonus}`, `미확정 ${pendingWarBonus}점`, "war", 750, 1);
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
  // V5.1: 인게임 격자도 메인 화면과 같은 계열의 조용한 픽셀 배경으로 통일.
  // 게임 좌표/충돌 판정은 유지하고, 라인 대비만 낮춰 플레이 요소가 먼저 보이게 한다.
  ctx.fillStyle = gameMode === "war" ? "#100D12" : "#0B0B10";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const gridSize = 62;
  const gridColor = gameMode === "war"
    ? "rgba(240,82,82,0.055)"
    : "rgba(166,175,185,0.075)";

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0.5; x < GAME_WIDTH; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_WIDTH > 0 ? GAME_HEIGHT : 0);
  }
  for (let y = 0.5; y < GAME_HEIGHT; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
  }
  ctx.stroke();
}

function drawEnergyCrystal(now) {
  const cx = Math.round(item.x + item.size / 2);
  const cy = Math.round(item.y + item.size / 2);
  const pulse = 0.6 + 0.4 * Math.sin(now / 280);
  // 마름모를 만드는 계단식 픽셀. 기존 아이템 22px 판정은 변경 없음.
  ctx.save();
  // 가장자리 직각 계단을 유지하는 20×20 픽셀 마름모.
  ctx.fillStyle = "#705817";
  ctx.fillRect(cx - 2 + 3, cy - 10 + 3, 4, 4);
  ctx.fillRect(cx - 6 + 3, cy - 6 + 3, 12, 4);
  ctx.fillRect(cx - 10 + 3, cy - 2 + 3, 20, 4);
  ctx.fillRect(cx - 6 + 3, cy + 2 + 3, 12, 4);
  ctx.fillRect(cx - 2 + 3, cy + 6 + 3, 4, 4);
  ctx.fillStyle = "#F5CF37";
  ctx.fillRect(cx - 2, cy - 10, 4, 4);
  ctx.fillRect(cx - 6, cy - 6, 12, 4);
  ctx.fillRect(cx - 10, cy - 2, 20, 4);
  ctx.fillRect(cx - 6, cy + 2, 12, 4);
  ctx.fillRect(cx - 2, cy + 6, 4, 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#fff0aa";
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.restore();
}

function drawSentinel(obstacle, now) {
  const { x, y, size } = obstacle;
  const px = Math.round(x), py = Math.round(y);
  const risk = gameMode === "war" ? currentWarSpeedBonus() : 0;
  const dangerAlpha = 0.18 + risk * 0.7;
  ctx.save();
  ctx.fillStyle = "#6e242b";
  ctx.fillRect(px + 4, py + 5, size - 4, size - 4);
  ctx.fillStyle = "#F05252";
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  ctx.strokeStyle = "#ffb6b6";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  ctx.strokeStyle = "#fff1ef";
  ctx.lineWidth = 4;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(px + 15, py + 15); ctx.lineTo(px + size - 15, py + size - 15);
  ctx.moveTo(px + size - 15, py + 15); ctx.lineTo(px + 15, py + size - 15);
  ctx.stroke();
  if (risk > 0) {
    ctx.strokeStyle = `rgba(240,82,82,${dangerAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 3, py - 3, size + 6, size + 6);
  }
  ctx.restore();
}

function drawEnergyCore(now) {
  const { x, y, size } = player;
  const px = Math.round(x), py = Math.round(y);
  const remaining = shieldInvulnerableUntil - now;
  const invulnerable = remaining > 0;
  const shieldFade = invulnerable ? Math.min(1, remaining / 300) : 0;
  const hasShield = gameMode === "war" && shieldAvailableThisRun && !shieldUsedThisRun && running;
  ctx.save();
  ctx.fillStyle = "#203c88";
  ctx.fillRect(px + 5, py + 6, size - 6, size - 6);
  ctx.fillStyle = invulnerable ? "#77c5ff" : "#3976FF";
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  ctx.strokeStyle = invulnerable ? "#f3efe4" : "#a4bcff";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  ctx.fillStyle = invulnerable ? "#f3efe4" : "#a4bcff";
  ctx.fillRect(px + 19, py + 19, 10, 10);
  if (invulnerable || hasShield) {
    ctx.globalAlpha = invulnerable ? shieldFade : 0.75;
    ctx.strokeStyle = "#9dd8ff";
    ctx.lineWidth = invulnerable ? 3 : 2;
    ctx.strokeRect(px - 5, py - 5, size + 10, size + 10);
  }
  ctx.restore();
}

// STEP 08: 전역 경고창이 아닌 실제 스폰 좌표에 픽셀 프레임을 표시합니다.
function drawObstacleSpawnWarning(now) {
  if (!pendingObstacleWarning) return;
  const { x, y, size } = pendingObstacleWarning;
  const pulse = 0.80 + 0.10 * Math.sin(now / 160); // 점멸 없이 은은한 강도 변화
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(240,82,82,0.13)";
  ctx.fillRect(Math.round(x), Math.round(y), size, size);
  ctx.strokeStyle = "#F05252";
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(Math.round(x) - 2, Math.round(y) - 2, size + 4, size + 4);
  ctx.setLineDash([]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + size - 14, y + size - 14);
  ctx.moveTo(x + size - 14, y + 14); ctx.lineTo(x + 14, y + size - 14);
  ctx.stroke();
  // 주변에서 먼저 인지할 수 있도록 짧은 라벨을 프레임 바로 옆에 배치.
  ctx.fillStyle = "#F05252";
  ctx.font = "bold 10px monospace";
  ctx.textBaseline = "bottom";
  const label = "ENEMY INCOMING";
  const labelX = Math.min(Math.max(4, x), GAME_WIDTH - 111);
  const labelY = y >= 18 ? y - 7 : y + size + 15;
  ctx.fillText(label, labelX, labelY);
  ctx.restore();
}

function drawReadyLabels(now = performance.now()) {
  if (meta.totalRuns >= 3) return;
  const elapsed = now - gameStartsAt;
  if (!readyActive && (!running || gameStartsAt <= 0 || elapsed >= 2500)) return;
  const alpha = readyActive || elapsed <= 2000 ? 1 : Math.max(0, (2500 - elapsed) / 500);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = 'bold 14px "Apple SD Gothic Neo", sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0B0B10";
  function label(text, entity, color) {
    const halfWidth = ctx.measureText(text).width / 2;
    const x = Math.max(halfWidth + 4, Math.min(GAME_WIDTH - halfWidth - 4, entity.x + entity.size / 2));
    const y = entity.y >= 34 ? entity.y - 15 : Math.min(GAME_HEIGHT - 14, entity.y + entity.size + 16);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  label("나", player, "#3976FF");
  if (!item.collected) label("모으세요", item, "#F5CF37");
  if (obstacles.length) label("피하세요", obstacles[0], "#F05252");
  ctx.restore();
}

function draw(now = performance.now()) {
  drawArena();
  if (!item.collected) drawEnergyCrystal(now);
  for (const obstacle of obstacles) drawSentinel(obstacle, now);
  drawObstacleSpawnWarning(now);
  drawEnergyCore(now);
  drawPickupEffects(now);
  drawNearMissEffects(now);
  drawReadyLabels(now);
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
    for (const value of [difficulty.toUpperCase(), total, average("score"), total ? `${average("survival")}s` : "-", completionRate, total ? `${average("maxCombo")} HIT` : "-"]) {
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
  const lines = ["회차,난이도,장애물속도(px/s),최종점수,생존시간(초),종료사유,최대연속획득,확정보너스,손실보너스,전쟁중획득수,안전모드평균FPS,전쟁모드평균FPS,안전모드50ms초과프레임,전쟁모드50ms초과프레임,기본점수(코인기준),획득코인,보호막사용여부,종료시보유코인,개인최고점수,game_version,near_miss_count,near_miss_points"];
  testRecords.forEach((record, index) => {
    lines.push([index + 1, DIFFICULTY_NAMES[record.difficulty], DIFFICULTY_SPEEDS[record.difficulty], record.score, record.survival.toFixed(1), record.reason === "time" ? "시간 완료" : "장애물 충돌", record.maxCombo, record.securedBonus, record.lostBonus, record.warPickups, record.safeFps, record.warFps, record.safeJank, record.warJank, record.baseScore, record.earnedCoins, record.shieldUsed ? "사용" : "미사용", record.walletCoins, record.bestScore, record.game_version, record.near_miss_count, record.near_miss_points].join(","));
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
  bonusResult.textContent = `위험 보너스: 확정 +${securedWarBonus}점 · 손실 ${lostWarBonus}점 · 위험 아이템 ${warPickupCount}개`;
  nearMissResult.textContent = `NEAR MISS ${nearMissCount}회 +${nearMissPoints}점`;
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
  // NEW RECORD는 점수 바로 아래에서 한 번만 표시합니다.
  // 알림 영역에는 중복 문구 없이 도전 과제만 표시합니다.
  if (unlocked.length) announcements.push(`ACHIEVEMENT: ${unlocked.join(", ")}`);
  recordAnnouncement.hidden = announcements.length === 0;
  recordAnnouncement.textContent = announcements.join(" · ");
  saveMeta();
  renderMeta();
  economyResult.textContent = `기본 점수 ${earnedCoinsThisRun}점 → +${earnedCoinsThisRun.toLocaleString("ko-KR")} 코인 · 위험 보너스는 코인 제외 · 보유 ${meta.coins.toLocaleString("ko-KR")} 코인 · 최고 기록 ${meta.bestScore}점`;
  shieldResult.textContent = shieldUsedThisRun ? "SHIELD USED · 미확정 위험 보너스 유지" : "SHIELD NOT USED · 무보조 최고 기록 " + meta.bestWithoutShield + "점";
  playEndSound(reason);
  const survivedSeconds = Math.min(30, Math.max(0, (performance.now() - gameStartsAt) / 1000));
  endStats.textContent = `${selectedDifficulty.toUpperCase()} / ${survivedSeconds.toFixed(1)}s`;
  testRecords.push({ difficulty: selectedDifficulty, score, survival: survivedSeconds, reason, maxCombo, securedBonus: securedWarBonus, lostBonus: lostWarBonus, warPickups: warPickupCount, safeFps: averageFps("safe"), warFps: averageFps("war"), safeJank: perfByMode.safe.longFrames, warJank: perfByMode.war.longFrames, baseScore: score - securedWarBonus, earnedCoins: earnedCoinsThisRun, shieldUsed: shieldUsedThisRun, walletCoins: meta.coins, bestScore: meta.bestScore, game_version: GAME_VERSION, near_miss_count: nearMissCount, near_miss_points: nearMissPoints });
  const performanceResult = document.getElementById("performance-result");
  performanceResult.hidden = !debugMode;
  if (debugMode) performanceResult.textContent = `성능 측정: 안전 ${averageFps("safe") || "-"} FPS / 위험 ${averageFps("war") || "-"} FPS · 50ms 초과 프레임 안전 ${perfByMode.safe.longFrames}회 / 위험 ${perfByMode.war.longFrames}회`;
  renderTestSummary();
  playRecords.unshift(`${DIFFICULTY_NAMES[selectedDifficulty]} | ${score}점 | ${survivedSeconds.toFixed(1)}초 | ${reason === "obstacle" ? "장애물 충돌" : "시간 완료"} | 최대 콤보 ${maxCombo}연속 | 위험 보너스 +${securedWarBonus}`);
  if (playRecords.length > 3) playRecords.pop();
  recordList.replaceChildren();
  for (const record of playRecords) {
    const li = document.createElement("li");
    li.textContent = record;
    recordList.appendChild(li);
  }
  running = false;
  bgmStartAuthorized = false;
  pauseBgm();
  feedbackUntil = 0;
  updateFeedback(performance.now());
  animationId = null;
  lastFrameAt = null;
  clearMovementInput();
  player.vx = player.vy = 0;
  restartButton.hidden = true;
  scoreBoard.hidden = true;
  timerBoard.hidden = true;
  obstacleBoard.hidden = true;
  finalScoreText.textContent = score;
  const gameplayTip = document.getElementById("result-gameplay-tip");
  if (warPickupCount === 0 && meta.totalRuns <= 5) {
    gameplayTip.textContent = "TIP  SPACE로 위험 모드: 보너스를 쌓고, 확정하기 전에 부딪히면 잃어요.";
    gameplayTip.hidden = false;
  } else if (lostWarBonus > 0 && meta.totalRuns <= 10) {
    gameplayTip.textContent = `TIP  위험 보너스 ${lostWarBonus}점을 잃었어요. 마지막 아이템 뒤 2초 버티고 SPACE로 안전 복귀하면 확정돼요.`;
    gameplayTip.hidden = false;
  } else {
    gameplayTip.textContent = "";
    gameplayTip.hidden = true;
  }
  // 이전 최고 점수를 기준으로 표시만 계산하며 저장값이나 보상은 변경하지 않습니다.
  const resultBestText = document.getElementById("result-best-comparison");
  resultBestText.textContent = score > previousBest
    ? "NEW RECORD"
    : `BEST ${previousBest.toLocaleString("ko-KR")} (${score - previousBest})`;
  resultBestText.classList.toggle("new-record", score > previousBest);
  finalComboText.textContent = `${maxCombo} HIT`;
  // REDESIGN 06: 별도 표시 필드는 기존 점수/재화 계산값을 그대로 사용.
  document.getElementById("result-war-bonus").textContent = `+${securedWarBonus.toLocaleString("ko-KR")}`;
  document.getElementById("result-coin-earned").textContent = `+${earnedCoinsThisRun.toLocaleString("ko-KR")}`;
  comboBoard.hidden = true;
  modeBoard.hidden = true;
  for (const board of [scoreBoard, comboBoard, obstacleBoard, timerBoard, modeBoard, restartButton, soundButton, bgmButton]) {
    board.classList.remove("hud-occluded");
  }
  perfPanel.hidden = true;
  endScreen.dataset.result = reason === "obstacle" ? "over" : "clear";
  document.getElementById("end-title").textContent = reason === "obstacle" ? "GAME OVER" : "RUN CLEAR";
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
  updateModeBoardOcclusion();
  prunePickupEffects(now);
  pruneNearMissEffects(now);
  updateFeedback(now);
  updateWarLockDisplay(now);
  draw(now);
  if (running) animationId = requestAnimationFrame(loop);
}

function beginGame() {
  if (!helpOverlay.hidden) return;
  ensureAudio();
  selectedDifficulty = difficultySelect.value;
  obstacleSpeed = DIFFICULTY_SPEEDS[selectedDifficulty];
  // 새로운 30초 게임 시작: 점수·위치·아이템·시계를 전부 초기화합니다.
  cancelReady();
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
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
  bankReadyNoticeShown = false;
  warStreakPickups = 0;
  pendingWarBonus = 0;
  securedWarBonus = 0;
  lostWarBonus = 0;
  warPickupCount = 0;
  updateObstacleSpeed();
  renderGameMode();
  resetScore();
  pickupEffects.length = 0;
  nearMissEffects.length = 0;
  resetCombo();
  resetPlayer();
  obstacles.length = 0;
  nearMissStates = new WeakMap();
  nearMissCount = 0;
  nearMissPoints = 0;
  nearMissResult.textContent = "NEAR MISS 0회 +0점";
  pendingObstacleWarning = null;

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
  gameStartsAt = 0;
  gameEndsAt = 0;

  readyActive = true;
  draw();
  updateModeBoardOcclusion();
  readyOverlay.querySelector(".ready-top").textContent = meta.totalRuns < 3
    ? "READY · 30초 안에 최대한 모으세요" : "READY";
  readyOverlay.hidden = false;
  const thisReadyGeneration = ++readyGeneration;
  readyTimerId = setTimeout(() => {
    if (readyActive && readyGeneration === thisReadyGeneration) startReadyGame();
  }, READY_DURATION_MS);
  bgmStartAuthorized = true;
  startBgm(); // START 버튼에서 재생했다면 중복 호출해도 재시작하지 않음
}

// REDESIGN 03: 메인 픽셀 UI와 동일한 어휘의 첫 진입 3색 시퀀스.
// 게임 플레이 타이머, BGM, localStorage에는 영향을 주지 않습니다.
const colorIntro = document.getElementById("color-intro");
const introSymbol = document.getElementById("intro-symbol");
const introWord = document.getElementById("intro-word");
const introSub = document.getElementById("intro-sub");
const introSkipButton = document.getElementById("intro-skip");
const introFrame = document.getElementById("intro-pixel-frame");
const introStepCounter = document.getElementById("intro-step-counter");
const introColorLabel = document.getElementById("intro-color-label");
const introProgress = [...document.querySelectorAll("#intro-progress i")];
const introLettering = document.getElementById("intro-lettering");
const introScenes = [
  { key:"blue", label:"YOU", sub:"BLUE / PLAYER", footer:"BLUE / 01", ms:650 },
  { key:"yellow", label:"COLLECT", sub:"YELLOW / REWARD", footer:"YELLOW / 02", ms:650 },
  { key:"red", label:"SURVIVE", sub:"RED / DANGER", footer:"RED / 03", ms:650 },
  { key:"logo", label:"BLUE COLLECTOR", sub:"COLLECT MORE. RISK MORE.", footer:"READY / 04", ms:1050 }
];
let introTimeout = null;
let introIsPlaying = false;

function drawIntroLettering(scene) {
  const ctx = introLettering.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, introLettering.width, introLettering.height);
  ctx.imageSmoothingEnabled = false;
  // 타이틀은 메인 화면의 도트 로고 캔버스를 그대로 공유해 그래픽 일관성을 확보.
  if (scene.key === "logo") {
    // Keep the full raster logo inside the intro canvas, no edge clipping.
    ctx.drawImage(pixelTitleCanvas, 0, 0, 476, 190, 82, 8, 476, 190);
    return;
  }
  const scale = scene.label.length >= 7 ? 12 : 15;
  const letterWidth = 6 * scale;
  const offsetX = Math.floor((640 - scene.label.length * letterWidth + scale) / 2);
  const offsetY = 64;
  const shadow = scene.key === "blue" ? "#273C7D" : scene.key === "yellow" ? "#8D671B" : "#832A39";
  const face = scene.key === "blue" ? "#88B4FF" : scene.key === "yellow" ? "#F5CF37" : "#F07575";
  for (let i = 0; i < scene.label.length; i++) {
    const glyph = PIXEL_GLYPHS[scene.label[i]];
    if (!glyph) continue;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      if (glyph[y][x] !== "1") continue;
      const px = offsetX + (i * 6 + x) * scale;
      const py = offsetY + y * scale;
      ctx.fillStyle = shadow;
      ctx.fillRect(px + 5, py + 6, scale + 2, scale + 2);
      ctx.fillStyle = face;
      ctx.fillRect(px - 1, py - 1, scale + 2, scale + 2);
    }
  }
}
function showIntroScene(index) {
  if (!introIsPlaying) return;
  if (index >= introScenes.length) { completeIntro(); return; }
  const scene = introScenes[index];
  introFrame.className = "intro-pixel-frame " + scene.key;
  introSymbol.className = "intro-symbol " + scene.key;
  introWord.textContent = scene.label; // 캔버스 타이틀의 접근성 텍스트
  introSub.textContent = scene.sub;
  introColorLabel.textContent = scene.footer;
  introStepCounter.textContent = String(index + 1).padStart(2, "0") + " / 04";
  introProgress.forEach((element, i) => element.classList.toggle("active", i <= index));
  drawIntroLettering(scene);
  // 모든 색을 화면 전체에 번쩍이지 않고 도형과 프레임만 단계적으로 교체.
  introTimeout = window.setTimeout(() => showIntroScene(index + 1), scene.ms);
}
function completeIntro() {
  if (!introIsPlaying) return;
  window.clearTimeout(introTimeout);
  introTimeout = null;
  introIsPlaying = false;
  colorIntro.hidden = true;
  startButton.focus();
}
function playLandingIntro() {
  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    colorIntro.hidden = true;
    startButton.focus();
    return;
  }
  introIsPlaying = true;
  colorIntro.hidden = false;
  showIntroScene(0);
  // Avoid auto-scrolling the scaled mobile opening frame when focusing SKIP.
  introSkipButton.focus({ preventScroll: true });
}
function startGame() {
  if (introIsPlaying || !helpOverlay.hidden) return;
  bgmStartAuthorized = true;
  startBgm(); // 첫 START GAME 클릭 안에서 호출: 브라우저 자동재생 제한 대응
  if (!helpSeen) {
    startAfterHelp = true;
    openHelp(startButton);
    return;
  }
  beginGame();
}
introSkipButton.addEventListener("click", completeIntro);
window.addEventListener("keydown", event => {
  if (introIsPlaying && ["Space", "Enter", "Escape"].includes(event.code)) {
    event.preventDefault();
    completeIntro();
  }
});
function restartGame() { startGame(); }

window.addEventListener("keydown", (event) => {
  if (readyActive && (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code))) {
    event.preventDefault();
    if (!event.repeat) {
      startReadyGame();
      if (event.code !== "Space") setMovementInput(event, true);
    }
    return; // SPACE skips READY without switching to WAR.
  }
  if (event.code === "Space" && running) {
    event.preventDefault();
    if (!event.repeat) toggleGameMode(); // 누르고 있는 동안 반복 전환 방지
    return;
  }
  if (setMovementInput(event, true)) event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  if (setMovementInput(event, false)) event.preventDefault();
});

// STEP 6-5.2: 한 번 읽으면 자동으로 다시 뜨지 않는 첫 방문 게임 방법.
// 기존 코인/기록 저장 키는 변경하지 않습니다.
const HELP_SEEN_KEY = "blue-collector-help-seen-v1";
const helpOverlay = document.getElementById("help-overlay");
const helpOpenButton = document.getElementById("help-start-button");
const helpCloseButton = document.getElementById("help-close-button");
const helpDoneButton = document.getElementById("help-done-button");
let previousHelpFocus = null;
let startAfterHelp = false;
function openHelp(trigger = null) {
  if (running || !shopOverlay.hidden || !achievementsOverlay.hidden || !settingsOverlay.hidden) return;
  previousHelpFocus = trigger || document.activeElement;
  helpOverlay.hidden = false;
  // HOW TO PLAY를 메뉴에서 직접 연 경우 BACK은 상단에 하나만 표시한다.
  // 첫 START 클릭으로 들어왔다면 기존 게임 시작 흐름을 위해 하단 START GAME만 표시한다.
  helpDoneButton.hidden = !startAfterHelp;
  helpDoneButton.textContent = "START GAME →";
  (startAfterHelp ? helpDoneButton : helpCloseButton).focus();
}
function closeHelp(continueToGame = false) {
  if (helpOverlay.hidden) return;
  helpOverlay.hidden = true;
  try { localStorage.setItem(HELP_SEEN_KEY, "1"); } catch (_) { /* 스토리지 제한에서도 정상 동작 */ }
  helpSeen = true;
  startAfterHelp = false;
  if (!continueToGame && !running && bgmStartAuthorized) {
    bgmStartAuthorized = false; // 첫 실행 도움말을 취소한 경우 메뉴 BGM 중단
    pauseBgm();
  }
  if (previousHelpFocus && document.contains(previousHelpFocus)) previousHelpFocus.focus();
  else startButton.focus();
}
helpOpenButton.addEventListener("click", () => openHelp(helpOpenButton));
helpCloseButton.addEventListener("click", closeHelp);
helpDoneButton.addEventListener("click", () => {
  const shouldStart = startAfterHelp;
  closeHelp(shouldStart);
  if (shouldStart) {
    bgmStartAuthorized = true;
    startBgm(); // 도움말의 START GAME 클릭도 직접적인 사용자 제스처
    beginGame();
  }
});
window.addEventListener("keydown", event => {
  if (helpOverlay.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeHelp(); }
  // 게임 키 입력 및 뒤쪽 버튼으로 포커스가 이동하지 않도록 팝업 내부에 묶습니다.
  if (event.key === "Tab") {
    const focusables = startAfterHelp ? [helpCloseButton, helpDoneButton] : [helpCloseButton];
    const index = focusables.indexOf(document.activeElement);
    if (event.shiftKey && (index === 0 || index === -1)) { event.preventDefault(); focusables[focusables.length - 1].focus(); }
    else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0].focus(); }
  }
});
let helpSeen = false;
try { helpSeen = localStorage.getItem(HELP_SEEN_KEY) === "1"; } catch (_) {}
// 첫 방문 설명창은 인트로가 끝난 뒤에 엽니다.

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
  for (const board of [scoreBoard, comboBoard, obstacleBoard, timerBoard, modeBoard, restartButton, soundButton, bgmButton]) {
    board.classList.remove("hud-occluded");
  }
  perfPanel.hidden = true;
  document.getElementById("game").classList.remove("war-mode");
  startMenuDemo();
});


// REDESIGN 02: 외부 폰트 파일 없이 5x7 도트 글리프로 원본 타이틀 디자인을 그립니다.
const pixelTitleCanvas = document.getElementById("pixel-title-canvas");
const PIXEL_GLYPHS = {
  B:["11110","10001","10001","11110","10001","10001","11110"],
  L:["10000","10000","10000","10000","10000","10000","11111"],
  U:["10001","10001","10001","10001","10001","10001","01110"],
  E:["11111","10000","10000","11110","10000","10000","11111"],
  C:["01111","10000","10000","10000","10000","10000","01111"],
  O:["01110","10001","10001","10001","10001","10001","01110"],
  T:["11111","00100","00100","00100","00100","00100","00100"],
  R:["11110","10001","10001","11110","10100","10010","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"],
  S:["01111","10000","10000","01110","00001","00001","11110"],
  V:["10001","10001","10001","10001","10001","01010","00100"],
  I:["11111","00100","00100","00100","00100","00100","11111"]
};
function drawPixelTitle() {
  if (!pixelTitleCanvas) return;
  const ctx = pixelTitleCanvas.getContext("2d");
  const width = 476, height = 190;
  pixelTitleCanvas.width=width; pixelTitleCanvas.height=height;
  ctx.clearRect(0,0,width,height);
  function word(text, originX, originY, scale) {
    for (let n=0;n<text.length;n++) {
      const glyph=PIXEL_GLYPHS[text[n]];
      if (!glyph) continue;
      for (let y=0;y<7;y++) for(let x=0;x<5;x++) if(glyph[y][x]==="1") {
        const px=originX+(n*6+x)*scale, py=originY+y*scale;
        // 1픽셀씩 어긋나는 투톤 그림자는 현대식 글로우가 아닌 레트로 스프라이트 효과.
        // BLUE is the title identity: one blue face, a restrained dark-blue pixel shadow.
        // Preserve the heavier 5x7 pixels chosen during redesign V4.
        ctx.fillStyle="#203C88";ctx.fillRect(px+5,py+6,scale+2,scale+2);
        ctx.fillStyle="#5E91FF";ctx.fillRect(px-1,py-1,scale+2,scale+2);
      }
    }
  }
  word("BLUE",8,6,13);
  word("COLLECTOR",8,124,7);
}
drawPixelTitle();

// REDESIGN 01: 타이틀 화면 전용 자동 시연. 실제 게임의 난이도·점수·저장 데이터에 영향 없음.
const menuDemoCanvas = document.getElementById("menu-demo-canvas");
const menuDemoContext = menuDemoCanvas.getContext("2d");
let menuDemoAnimationId = null;
const menuRoute = [
  [.15,.70],[.16,.38],[.29,.20],[.55,.16],[.79,.31],[.83,.70],[.65,.82],[.40,.80]
];
function menuPositionAt(phase) {
  const n = menuRoute.length;
  const wrap = ((phase % n) + n) % n;
  const index = Math.floor(wrap);
  const fraction = wrap-index;
  const a = menuRoute[index], b = menuRoute[(index+1)%n];
  const smooth = fraction*fraction*(3-2*fraction);
  return [a[0]+(b[0]-a[0])*smooth,a[1]+(b[1]-a[1])*smooth];
}
function drawMenuDemo(now) {
  const canvas = menuDemoCanvas;
  const ctx = menuDemoContext;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h || !ctx) return;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const sw=Math.max(1,Math.round(w*dpr)),sh=Math.max(1,Math.round(h*dpr));
  if(canvas.width!==sw || canvas.height!==sh) {canvas.width=sw;canvas.height=sh;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#101318";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(166,175,185,.075)";ctx.lineWidth=1;
  const grid=62;
  for(let x=0;x<w;x+=grid){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,h);ctx.stroke();}
  for(let y=0;y<h;y+=grid){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(w,y+.5);ctx.stroke();}
  // 이동 경로의 흔적. 플레이어와 적 모두 타이틀 중앙을 가리지 않도록 낮은 대비를 사용.
  const period = now/1530;
  const size=Math.max(18,Math.min(37,Math.min(w,h)*.061));
  function square(x,y,size,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);}
  function diamond(x,y,size){ctx.fillStyle="#F5CF37";const a=Math.max(4,Math.round(size/4));ctx.fillRect(Math.round(x-a),Math.round(y-a),2*a,2*a);ctx.fillRect(Math.round(x-a/2),Math.round(y-1.5*a),a,3*a);ctx.fillRect(Math.round(x-1.5*a),Math.round(y-a/2),3*a,a);}
  // 아이템은 등장 위치를 고정해 수집 게임의 목적을 즉시 전달한다.
  [[.29,.20],[.83,.70],[.40,.80]].forEach(([x,y],i)=>{
    const pulse=0.96+0.08*Math.sin(now/380+i*2);
    diamond(x*w,y*h,Math.round(size*.52*pulse));
  });
  const hero=menuPositionAt(period), red1=menuPositionAt(period-1.00), red2=menuPositionAt(period-1.94);
  square(red2[0]*w,red2[1]*h,size*.78,"#F05252");
  square(red1[0]*w,red1[1]*h,size*.83,"#F05252");
  square(hero[0]*w,hero[1]*h,size,"#3976FF");
  // 얇은 플레이어 외곽선은 네온이 아닌 형태 차별화 역할만 한다.
  ctx.strokeStyle="#C4D8FF";ctx.lineWidth=1;
  ctx.strokeRect(Math.round(hero[0]*w-size/2)-.5,Math.round(hero[1]*h-size/2)-.5,size+1,size+1);
  // 타이틀과 메뉴에 시선이 가도록 좌표 표기는 생략합니다.
}
function animateMenuDemo(now) {
  if (startScreen.hidden || document.hidden) {menuDemoAnimationId=null;return;}
  if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    drawMenuDemo(now);
    menuDemoAnimationId=requestAnimationFrame(animateMenuDemo);
  } else {
    drawMenuDemo(0);
    menuDemoAnimationId=null;
  }
}
function startMenuDemo() {
  if (menuDemoAnimationId !== null || startScreen.hidden || document.hidden) return;
  menuDemoAnimationId=requestAnimationFrame(animateMenuDemo);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)startMenuDemo();});

// 다른 창으로 전환했을 때 키가 눌린 채로 남지 않도록 처리
window.addEventListener("blur", () => {
  clearMovementInput();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  updateModeBoardOcclusion();
  draw();
});

resizeCanvas();
placePlayerInCenter();
resetItem();
draw();
playLandingIntro();
startMenuDemo();
