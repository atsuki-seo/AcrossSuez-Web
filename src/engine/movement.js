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

function roadCost(fromHex, toHex) {
  if (!fromHex.edges?.road) return null;
  return 0.5;
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
