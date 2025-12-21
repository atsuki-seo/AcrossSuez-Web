// STEP5: Movement, ZOC, and Reachable Hex Calculation
// 目的: SPI Across Suez の移動ルールをロジックとして確定させる

import hexes, { qrIndex } from "./hexes.js";
import { gameState, movementModifier, canMove } from "./gamestate.js";
import { checkBridgeFailure } from "./victory.js";

// ----------------------------
// 1. 隣接ヘクス取得
// ----------------------------

const DIRS = [
  { dq: 1, dr: 0 },   // E
  { dq: 0, dr: 1 },   // SE
  { dq: -1, dr: 1 },  // SW
  { dq: -1, dr: 0 },  // W
  { dq: 0, dr: -1 },  // NW
  { dq: 1, dr: -1 }   // NE
];

export function getNeighbors(hex) {
  return DIRS
    .map(d => {
      const q = hex.q + d.dq;
      const r = hex.r + d.dr;
      return qrIndex.get(`${q},${r}`);
    })
    .filter(Boolean);
}

// ----------------------------
// 2. ZOC 計算
// ----------------------------

export function computeZOC(side) {
  const zoc = new Set();

  Object.values(gameState.units)
    .filter(u => u.side === side && u.hex)
    .forEach(unit => {
      const hex = hexes[unit.hex];
      getNeighbors(hex).forEach(n => zoc.add(n.id));
    });

  return zoc;
}

// ----------------------------
// 3. 移動コスト計算
// ----------------------------

function baseMoveCost(hex) {
  if (hex.base === "swamp") return Infinity;
  if (hex.base === "lake") return Infinity;
  if (hex.overlay?.chineseFarm) return 3;
  if (hex.overlay?.elevatedSand) return 3;
  if (hex.base === "sand") return 3;
  return 1; // clear / barLev
}

function edgeCost(fromHex, toHex) {
  if (!fromHex.edges) return 0;
  // Ridge cost (simplified: if ridge exists on any edge)
  if (fromHex.edges.ridge) return 2;
  return 0;
}

function dirFromTo(fromHex, toHex) {
  const dq = toHex.q - fromHex.q;
  const dr = toHex.r - fromHex.r;
  for (let dir = 0; dir < DIRS.length; dir++) {
    if (DIRS[dir].dq === dq && DIRS[dir].dr === dr) return dir;
  }
  return null;
}

function roadCost(fromHex, toHex) {
  const roadDirs = fromHex.edges?.road;
  if (!roadDirs || roadDirs.length === 0) return null;

  const dir = dirFromTo(fromHex, toHex);
  if (dir === null) return null;

  return roadDirs.includes(dir) ? 0.5 : null;
}

// ----------------------------
// 4. 移動可能ヘクス探索（BFS）
// ----------------------------

export function getReachableHexes(unit) {
  if (!canMove()) return [];

  const startHex = hexes[unit.hex];
  const maxMP = unit.move + movementModifier();
  if (maxMP <= 0) return [];

  const enemyZOC = computeZOC(unit.side === "ISR" ? "EGY" : "ISR");

  const visited = new Map(); // hexId -> remaining MP
  const frontier = [{ hex: startHex, mp: maxMP }];

  visited.set(startHex.id, maxMP);

  const results = new Set();

  while (frontier.length > 0) {
    const { hex, mp } = frontier.shift();

    getNeighbors(hex).forEach(next => {
      // Cannot enter enemy-occupied hex
      if (Object.values(gameState.units).some(u => u.hex === next.id)) return;

      let cost = baseMoveCost(next) + edgeCost(hex, next);
      const road = roadCost(hex, next);
      if (road !== null) cost = road;

      const remaining = mp - cost;
      if (remaining < 0) return;

      // ZOC: entering enemy ZOC stops further movement
      const inEnemyZOC = enemyZOC.has(next.id);

      if (!visited.has(next.id) || visited.get(next.id) < remaining) {
        visited.set(next.id, remaining);
        results.add(next.id);
        if (!inEnemyZOC) {
          frontier.push({ hex: next, mp: remaining });
        }
      }
    });
  }

  return Array.from(results);
}

// コスト情報付きの移動可能ヘクス取得（UI表示用）
export function getReachableHexesWithCost(unit) {
  if (!canMove()) return [];

  const startHex = hexes[unit.hex];
  const maxMP = unit.move + movementModifier();
  if (maxMP <= 0) return [];

  const enemyZOC = computeZOC(unit.side === "ISR" ? "EGY" : "ISR");

  const visited = new Map(); // hexId -> { remainingMP, cost }
  const frontier = [{ hex: startHex, mp: maxMP, totalCost: 0 }];

  visited.set(startHex.id, { remainingMP: maxMP, cost: 0 });

  while (frontier.length > 0) {
    const { hex, mp, totalCost } = frontier.shift();

    getNeighbors(hex).forEach(next => {
      // Cannot enter enemy-occupied hex
      if (Object.values(gameState.units).some(u => u.hex === next.id)) return;

      let cost = baseMoveCost(next) + edgeCost(hex, next);
      const road = roadCost(hex, next);
      if (road !== null) cost = road;

      const remaining = mp - cost;
      const newTotalCost = totalCost + cost;
      if (remaining < 0) return;

      // ZOC: entering enemy ZOC stops further movement
      const inEnemyZOC = enemyZOC.has(next.id);

      if (!visited.has(next.id) || visited.get(next.id).remainingMP < remaining) {
        visited.set(next.id, { remainingMP: remaining, cost: newTotalCost });
        if (!inEnemyZOC) {
          frontier.push({ hex: next, mp: remaining, totalCost: newTotalCost });
        }
      }
    });
  }

  // visited Map からコスト情報付きの配列を生成
  const results = [];
  visited.forEach((info, hexId) => {
    if (hexId !== startHex.id) {  // 開始ヘクスは除外
      results.push({ hexId, cost: info.cost, remainingMP: info.remainingMP });
    }
  });

  return results;
}

// ----------------------------
// 5. 実移動
// ----------------------------

export function moveUnit(unit, targetHexId) {
  const reachable = getReachableHexes(unit);
  if (!reachable.includes(targetHexId)) return false;

  // Check bridge unit instant loss condition
  const bridgeFailure = checkBridgeFailure(unit.id, unit.hex, targetHexId);
  if (bridgeFailure) {
    gameState.gameOver = bridgeFailure;
    gameState.log.push(`Bridge unit moved from Matzmed! Instant Loss: ${bridgeFailure}`);
    return false;
  }

  unit.hex = targetHexId;
  return true;
}

// STEP5 completes movement legality & ZOC logic
