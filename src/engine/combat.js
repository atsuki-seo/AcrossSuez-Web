// STEP6: Combat Resolution (CRT, Retreat, Advance)
// SPI Across Suez 準拠の戦闘処理ロジック

import hexes from "./hexes.js";
import { gameState, canCombat, canBombard, useIsraelArtillery, canUseIsraelArtillery } from "./gamestate.js";
import { computeZOC, getNeighbors } from "./movement.js";

// ----------------------------
// 1. CRT 定義
// ----------------------------

// Combat Differential columns indexed from -3 to +7
const CRT = {
  "-3": ["Ar","Ar","Ar","Ae","Ae","Ae"],
  "-2": ["Dr","Ar","Ar","Ar","Ar","Ae"],
  "-1": ["Dr","Ar","Ar","Ar","Ar","Ar"],
  "0":  ["Dr","Dr","Dr","Ar","Ar","Ar"],
  "1":  ["Dr","Dr","Dr","Dr","Ee","Ar"],
  "2":  ["Dr","Dr","Dr","Dr","Dr","Ee"],
  "3":  ["Dr","Dr","Dr","Dr","Dr","Ee"],
  "4":  ["Dr","Dr","Dr","Dr","Dr","Ee"],
  "5":  ["Dr","Dr","Dr","Dr","Dr","Ee"],
  "6":  ["De","De","Dr","Dr","Dr","Ee"],
  "7":  ["De","De","Dr","Dr","Dr","Ee"]
};

function clampColumn(diff) {
  if (diff <= -3) return "-3";
  if (diff >= 7) return "7";
  return String(diff);
}

// ----------------------------
// 2. ダイス
// ----------------------------

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

// ----------------------------
// 3. 戦闘解決
// ----------------------------

export function resolveCombat({ attackers, defenderId, useArtillery = false }) {
  if (!canCombat()) return null;

  const defender = gameState.units[defenderId];
  if (!defender || !defender.hex) return null;

  // 攻撃力合計
  const attackStrength = attackers.reduce((sum, id) => sum + gameState.units[id].strength, 0);
  const defenseStrength = defender.strength;

  let diff = attackStrength - defenseStrength;

  // 諸兵科連合効果（Combined Arms）: armor + inf/mech で +1 シフト [SPI Rule 8.0]
  const hasArmor = attackers.some(id => gameState.units[id].type === 'armor');
  const hasInfantry = attackers.some(id => ['inf', 'mech'].includes(gameState.units[id].type));
  if (hasArmor && hasInfantry) diff += 1;

  // イスラエル軍砲兵支援 [SPI Rule 13.3, 13.4]
  let artilleryUsed = false;
  if (useArtillery && canUseIsraelArtillery()) {
    useIsraelArtillery();
    diff += 1;
    artilleryUsed = true;
  }

  // 地形修正（左シフト）
  const defHex = hexes[defender.hex];
  if (defHex.overlay?.chineseFarm) diff -= 2;
  else if (defHex.overlay?.elevatedSand || defHex.overlay?.barLev) diff -= 1;

  const column = clampColumn(diff);
  const die = rollDie();
  const result = CRT[column][die - 1];

  applyCombatResult(result, attackers, defender);

  return {
    column,
    die,
    result,
    attackStrength,
    defenseStrength,
    diff,
    combinedArms: hasArmor && hasInfantry,
    artilleryUsed
  };
}

// ----------------------------
// 4. 戦闘結果適用
// ----------------------------

function applyCombatResult(result, attackers, defender) {
  switch (result) {
    case "Ae":
      attackers.forEach(id => eliminateUnit(id));
      break;
    case "Ar":
      attackers.forEach(id => retreatUnit(id));
      break;
    case "De":
      eliminateUnit(defender.id);
      advanceAttackers(attackers, defender.hex);
      break;
    case "Dr":
      retreatUnit(defender.id);
      advanceAttackers(attackers, defender.hex);
      break;
    case "Ee":
      eliminateUnit(defender.id);
      // 攻撃側は戦闘力 >= 防御力の分だけ除去（簡略）
      let remaining = defender.strength;
      for (const id of attackers) {
        if (remaining <= 0) break;
        eliminateUnit(id);
        remaining -= gameState.units[id]?.strength || 0;
      }
      break;
  }
}

// ----------------------------
// 5. 退却処理
// ----------------------------

function retreatUnit(unitId) {
  const unit = gameState.units[unitId];
  if (!unit || !unit.hex) return;

  const enemyZOC = computeZOC(unit.side === "ISR" ? "EGY" : "ISR");
  const neighbors = getNeighbors(hexes[unit.hex]);

  const safeHex = neighbors.find(h =>
    !enemyZOC.has(h.id) &&
    h.base !== "lake" &&
    h.base !== "swamp" &&
    !Object.values(gameState.units).some(u => u.hex === h.id)
  );

  if (!safeHex) {
    eliminateUnit(unitId);
  } else {
    unit.hex = safeHex.id;
  }
}

// ----------------------------
// 6. 前進処理
// ----------------------------

function advanceAttackers(attackers, targetHexId) {
  const id = attackers.find(id => gameState.units[id]?.hex);
  if (!id) return;
  gameState.units[id].hex = targetHexId;
}

// ----------------------------
// 7. 除去
// ----------------------------

function eliminateUnit(unitId) {
  const unit = gameState.units[unitId];
  if (!unit) return;
  unit.hex = null;
}

// ----------------------------
// 8. エジプト軍砲撃 [SPI Rule 13.1]
// ----------------------------

/**
 * エジプト軍砲撃を解決
 * - EGY_BOMBARDフェイズで使用可能
 * - 隣接するイスラエル軍ユニット最大2体を対象
 * - 1d6で「1」が出れば除去
 * @param {string[]} targetIds - 対象ユニットID（最大2）
 * @returns {Object[]} - 各対象の砲撃結果
 */
export function resolveEgyptBombard(targetIds) {
  if (!canBombard()) return [];
  if (gameState.egyBombardUsed) return [];

  // 最大2体まで
  const targets = targetIds.slice(0, 2);

  const results = targets.map(id => {
    const unit = gameState.units[id];
    if (!unit || !unit.hex || unit.side !== "ISR") {
      return { id, die: 0, result: "invalid" };
    }

    // 隣接チェック：いずれかのエジプト軍ユニットに隣接しているか
    const isAdjacentToEgyptian = Object.values(gameState.units).some(egyUnit => {
      if (egyUnit.side !== "EGY" || !egyUnit.hex) return false;
      const neighbors = getNeighbors(hexes[egyUnit.hex]);
      return neighbors.some(n => n.id === unit.hex);
    });

    if (!isAdjacentToEgyptian) {
      return { id, die: 0, result: "not_adjacent" };
    }

    const die = rollDie();
    if (die === 1) {
      eliminateUnit(id);
      return { id, die, result: "eliminated" };
    }
    return { id, die, result: "miss" };
  });

  gameState.egyBombardUsed = true;
  return results;
}

/**
 * 砲撃対象として有効なイスラエル軍ユニットを取得
 * @returns {Object[]} - 隣接しているイスラエル軍ユニットの配列
 */
export function getValidBombardTargets() {
  if (!canBombard()) return [];

  const targets = [];

  Object.values(gameState.units).forEach(isrUnit => {
    if (isrUnit.side !== "ISR" || !isrUnit.hex) return;

    // いずれかのエジプト軍ユニットに隣接しているかチェック
    const isAdjacentToEgyptian = Object.values(gameState.units).some(egyUnit => {
      if (egyUnit.side !== "EGY" || !egyUnit.hex) return false;
      const neighbors = getNeighbors(hexes[egyUnit.hex]);
      return neighbors.some(n => n.id === isrUnit.hex);
    });

    if (isAdjacentToEgyptian) {
      targets.push(isrUnit);
    }
  });

  return targets;
}

// STEP6 completes combat resolution logic
