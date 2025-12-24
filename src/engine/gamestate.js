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
  crossSuezThisTurn: 0, // このターンの渡河ユニット数
  log: [],
  gameOver: null,       // "ISR_WIN" or "EGY_WIN" when game ends

  // 砲兵関連状態 [SPI Rule 13]
  israelArtilleryUsed: 0,   // このターンに使用した砲兵支援回数
  egyBombardUsed: false     // エジプト軍砲撃使用済みフラグ
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

  // ターン開始時リセット
  gameState.israelArtilleryUsed = 0;
  gameState.egyBombardUsed = false;
  gameState.crossSuezThisTurn = 0;

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

// ----------------------------
// 5. 砲兵支援関連 [SPI Rule 13]
// ----------------------------

/**
 * イスラエル軍砲兵支援の最大使用可能回数を取得
 * 基本1回 + 渡河ユニット数
 */
export function getIsraelArtilleryMaxUses() {
  return 1 + gameState.crossSuezBox.length;
}

/**
 * イスラエル軍砲兵支援が使用可能かチェック
 * - 夜間は使用不可
 * - イスラエル戦闘フェイズのみ
 * - 使用回数が上限に達していないこと
 */
export function canUseIsraelArtillery() {
  if (gameState.isNight) return false;
  if (gameState.phase !== "ISR_COMBAT") return false;
  return gameState.israelArtilleryUsed < getIsraelArtilleryMaxUses();
}

/**
 * イスラエル軍砲兵支援を使用
 */
export function useIsraelArtillery() {
  if (!canUseIsraelArtillery()) return false;
  gameState.israelArtilleryUsed++;
  return true;
}

/**
 * イスラエル軍砲兵支援の残り回数を取得
 */
export function getIsraelArtilleryRemaining() {
  return Math.max(0, getIsraelArtilleryMaxUses() - gameState.israelArtilleryUsed);
}

// ----------------------------
// 6. スエズ運河渡河関連 [SPI Rule 11.0]
// ----------------------------

const MATZMED = "0112";
const MAX_CROSSING_WITHOUT_BRIDGE = 2;

/**
 * 橋ユニットがMatzmedに存在するかチェック
 */
export function hasBridgeAtMatzmed() {
  return Object.values(gameState.units).some(
    u => u.type === "bridge" && u.hex === MATZMED
  );
}

/**
 * スエズ運河渡河のコストを取得
 * - 橋あり: 1MP
 * - 橋なし: 3MP
 */
export function getCrossSuezCost() {
  return hasBridgeAtMatzmed() ? 1 : 3;
}

/**
 * 指定ユニットがスエズ運河を渡河可能かチェック
 * - イスラエル軍ユニットのみ
 * - Matzmed (0112) にいること
 * - イスラエル移動フェイズであること
 * - 橋なし時: ターンあたり2ユニットまで
 */
export function canCrossSuez(unitId) {
  const unit = gameState.units[unitId];
  if (!unit) return false;
  if (unit.side !== "ISR") return false;
  if (unit.hex !== MATZMED) return false;
  if (gameState.phase !== "ISR_MOVE") return false;

  // 橋がある場合は無制限
  if (hasBridgeAtMatzmed()) return true;

  // 橋がない場合はターンあたり2ユニットまで
  return gameState.crossSuezThisTurn < MAX_CROSSING_WITHOUT_BRIDGE;
}

/**
 * スエズ運河渡河を実行
 * @returns {boolean} 成功した場合true
 */
export function executeCrossSuez(unitId) {
  if (!canCrossSuez(unitId)) return false;

  const unit = gameState.units[unitId];

  // ユニットをマップから除去し、crossSuezBoxに追加
  unit.hex = null;
  gameState.crossSuezBox.push(unitId);
  gameState.crossSuezThisTurn++;

  log(`${unitId} crossed the Suez Canal (Total: ${gameState.crossSuezBox.length})`);
  return true;
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
