// STEP4: Turn & Phase Management for Across Suez
// 目的: ゲーム進行の正典（Single Source of Truth）を定義する

import { units, applyReinforcements } from "./units.js";
import { checkGameEnd } from "./victory.js";

// ----------------------------
// 1. 定数定義
// ----------------------------

export const PHASES = [
  "ISR_MOVE",
  "ISR_COMBAT",
  "EGY_MOVE",
  "EGY_BOMBARD",
  "EGY_COMBAT"
];

export const NIGHT_TURNS = [1, 4, 7];
export const MAX_TURN = 7;

// ----------------------------
// 2. GameState 定義
// ----------------------------

export const gameState = {
  turn: 1,
  phaseIndex: 0,
  phase: PHASES[0],
  isNight: true,

  units,                // STEP3で定義されたユニット群
  crossSuezBox: [],     // 渡河済みISRユニットID
  log: [],
  gameOver: null        // "ISR_WIN" or "EGY_WIN" when game ends
};

// ----------------------------
// 3. フェイズ制御
// ----------------------------

export function advancePhase() {
  gameState.phaseIndex++;

  if (gameState.phaseIndex >= PHASES.length) {
    endTurn();
    return;
  }

  gameState.phase = PHASES[gameState.phaseIndex];
  log(`Phase -> ${gameState.phase}`);
}

function endTurn() {
  // Check victory conditions at end of Turn 7
  if (gameState.turn >= MAX_TURN) {
    const result = checkGameEnd();
    if (result) {
      gameState.gameOver = result;
    }
    log("Game End: Turn 7 completed");
    return;
  }

  gameState.turn++;
  gameState.phaseIndex = 0;
  gameState.phase = PHASES[0];
  gameState.isNight = NIGHT_TURNS.includes(gameState.turn);

  // Reinforcements enter at Movement Phase
  applyReinforcements(gameState.turn);

  log(`--- Game Turn ${gameState.turn} (${gameState.isNight ? "Night" : "Day"}) ---`);
}

// ----------------------------
// 4. 補助関数
// ----------------------------

export function isIsraeliPhase() {
  return gameState.phase.startsWith("ISR");
}

export function isEgyptianPhase() {
  return gameState.phase.startsWith("EGY");
}

export function canMove() {
  return gameState.phase === "ISR_MOVE" || gameState.phase === "EGY_MOVE";
}

export function canCombat() {
  return gameState.phase === "ISR_COMBAT" || gameState.phase === "EGY_COMBAT";
}

export function canBombard() {
  return gameState.phase === "EGY_BOMBARD" && !gameState.isNight;
}

export function movementModifier() {
  return gameState.isNight ? -2 : 0;
}

function log(message) {
  gameState.log.push(message);
  console.log(message);
}

// ----------------------------
// 5. 初期ログ
// ----------------------------

log("--- Game Start: Turn 1 (Night) ---");
log("Phase -> ISR_MOVE");
