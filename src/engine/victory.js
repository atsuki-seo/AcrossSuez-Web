// STEP7: Victory Conditions, LOC, and Game End Check
// SPI Across Suez 勝利条件の最終確定ロジック

import hexes from "./hexes.js";
import { gameState } from "./gamestate.js";
import { computeZOC, getNeighbors } from "./movement.js";

// ----------------------------
// 1. 定数
// ----------------------------

const MATZMED = "0112";
const ISRAEL_LOC_TARGET = "1708";

// ----------------------------
// 2. LOC（Line of Communication）判定
// ----------------------------

export function checkLOC(fromHexId, toHexId, side) {
  const enemySide = side === "ISR" ? "EGY" : "ISR";
  const enemyZOC = computeZOC(enemySide);

  const visited = new Set();
  const queue = [fromHexId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toHexId) return true;

    visited.add(current);
    const hex = hexes[current];
    if (!hex) continue;

    const neighbors = getNeighbors(hex);
    neighbors.forEach(next => {
      if (visited.has(next.id)) return;

      // terrain restriction
      if (next.base !== "clear" && !next.edges?.road) return;

      // enemy unit blocks LOC
      if (Object.values(gameState.units).some(u => u.hex === next.id && u.side === enemySide)) return;

      // enemy ZOC blocks LOC unless friendly unit present
      if (enemyZOC.has(next.id)) {
        const friendlyPresent = Object.values(gameState.units)
          .some(u => u.hex === next.id && u.side === side);
        if (!friendlyPresent) return;
      }

      queue.push(next.id);
    });
  }

  return false;
}

// ----------------------------
// 3. 勝利条件チェック
// ----------------------------

export function checkVictory() {
  // Only check at end of Turn 7
  if (gameState.turn < 7) return null;

  // 1. Bridge unit at Matzmed
  const bridgeAtMatzmed = Object.values(gameState.units).some(u =>
    u.type === "bridge" && u.hex === MATZMED
  );

  if (!bridgeAtMatzmed) return "EGY_WIN";

  // 2. LOC from Matzmed to 1708
  const locOk = checkLOC(MATZMED, ISRAEL_LOC_TARGET, "ISR");
  if (!locOk) return "EGY_WIN";

  // 3. Cross Suez Unit Box count
  const crossed = gameState.crossSuezBox.length;
  if (crossed < 6) return "EGY_WIN";

  return "ISR_WIN";
}

// ----------------------------
// 4. 橋ユニット即敗判定
// ----------------------------

export function checkBridgeFailure(unitId, fromHex, toHex) {
  const unit = gameState.units[unitId];
  if (!unit || unit.type !== "bridge") return false;

  // If bridge already at Matzmed and moves -> instant loss
  if (fromHex === MATZMED && toHex !== MATZMED) {
    return "EGY_WIN";
  }

  return false;
}

// ----------------------------
// 5. ゲーム終了判定
// ----------------------------

export function checkGameEnd() {
  const victory = checkVictory();
  if (victory) {
    gameState.log.push(`Game Over: ${victory}`);
    return victory;
  }
  return null;
}

// STEP7 completes game-end logic
