// Input Handler - ユニット選択、移動UI、戦闘UI

import { pixelToHex, highlightHexes, highlightSelectedHex, render } from './renderer.js';
import { hexToPixel, getContext, hexes } from './renderer.js';
import { gameState, isIsraeliPhase, isEgyptianPhase } from '../engine/gamestate.js';
import { getReachableHexes, moveUnit, getNeighbors } from '../engine/movement.js';
import { resolveCombat } from '../engine/combat.js';
import { placeUnits } from '../engine/units.js';

// ===========================
// 状態管理
// ===========================
let selectedUnit = null;
let reachableHexes = [];

// 戦闘モード
let selectedAttackers = [];
let selectedDefender = null;
let attackBtnElement = null;

// ===========================
// ユニット選択（移動モード）
// ===========================
function selectUnit(unit) {
  selectedUnit = unit;
  reachableHexes = getReachableHexes(unit);

  console.log(`Selected unit: ${unit.id} at ${unit.hex}`);
  console.log(`Reachable hexes: ${reachableHexes.length}`);
}

function deselectUnit() {
  selectedUnit = null;
  reachableHexes = [];
}

// ===========================
// 戦闘ユニット選択
// ===========================
function selectAttacker(unit) {
  if (!selectedAttackers.find(u => u.id === unit.id)) {
    selectedAttackers.push(unit);
    console.log(`Attacker added: ${unit.id}`);
  }
  updateAttackButton();
}

function toggleAttacker(unit) {
  const idx = selectedAttackers.findIndex(u => u.id === unit.id);
  if (idx >= 0) {
    selectedAttackers.splice(idx, 1);
    console.log(`Attacker removed: ${unit.id}`);
  } else {
    selectedAttackers.push(unit);
    console.log(`Attacker added: ${unit.id}`);
  }
  updateAttackButton();
}

function selectDefender(unit) {
  selectedDefender = unit;
  console.log(`Defender selected: ${unit.id}`);
  updateAttackButton();
}

function clearCombatSelection() {
  selectedAttackers = [];
  selectedDefender = null;
  hideAttackButton();
}

// ===========================
// 攻撃ボタン制御
// ===========================
function updateAttackButton() {
  if (selectedAttackers.length > 0 && selectedDefender) {
    // 攻撃側が防御側に隣接しているかチェック
    const defHex = hexes[selectedDefender.hex];
    const neighbors = getNeighbors(defHex);
    const adjacent = selectedAttackers.some(att =>
      neighbors.some(n => n.id === att.hex)
    );

    if (adjacent) {
      showAttackButton();
    } else {
      hideAttackButton();
    }
  } else {
    hideAttackButton();
  }
}

function showAttackButton() {
  if (!attackBtnElement) return;
  attackBtnElement.style.display = 'block';
  attackBtnElement.disabled = false;
}

function hideAttackButton() {
  if (!attackBtnElement) return;
  attackBtnElement.style.display = 'none';
}

function executeCombat() {
  if (selectedAttackers.length === 0 || !selectedDefender) return;

  const attackerIds = selectedAttackers.map(u => u.id);
  const result = resolveCombat({
    attackers: attackerIds,
    defenderId: selectedDefender.id
  });

  if (result) {
    const msg = `戦闘: 攻撃力${result.attackStrength} vs 防御力${result.defenseStrength}, 修正後差分${result.diff}, ダイス${result.die}, 結果${result.result}`;
    console.log(msg);
    gameState.log.push(msg);
  }

  clearCombatSelection();
  redrawWithHighlights();
}

// ===========================
// 描画更新
// ===========================
function redrawWithHighlights() {
  const ctx = getContext();

  // マップとユニット再描画
  render(true);
  placeUnits(ctx, hexToPixel);

  // 移動モードハイライト
  if (selectedUnit) {
    highlightSelectedHex(selectedUnit.hex);
    highlightHexes(reachableHexes, 'rgba(255, 255, 0, 0.3)');
  }

  // 戦闘モードハイライト
  if (selectedAttackers.length > 0) {
    const attackerHexes = selectedAttackers.map(u => u.hex);
    highlightHexes(attackerHexes, 'rgba(255, 0, 0, 0.4)');
  }
  if (selectedDefender) {
    highlightSelectedHex(selectedDefender.hex, 'rgba(0, 0, 255, 0.5)');
  }
}

// ===========================
// クリックハンドラ
// ===========================
export function handleCanvasClick(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const clickedHex = pixelToHex(x, y);
  if (!clickedHex) {
    deselectUnit();
    redrawWithHighlights();
    return;
  }

  console.log(`Clicked hex: ${clickedHex.id}`);

  // ヘクス上のユニット検索
  const unitOnHex = Object.values(gameState.units).find(u => u.hex === clickedHex.id);

  // 戦闘フェイズ
  if (gameState.phase.includes('COMBAT')) {
    handleCombatClick(unitOnHex, event.shiftKey);
    return;
  }

  // 移動フェイズ
  if (gameState.phase.includes('MOVE')) {
    handleMoveClick(unitOnHex, clickedHex);
    return;
  }
}

function handleMoveClick(unitOnHex, clickedHex) {
  // ユニットが既に選択されている場合
  if (selectedUnit) {
    // 移動可能ヘクスをクリック → 移動実行
    if (reachableHexes.includes(clickedHex.id)) {
      const moved = moveUnit(selectedUnit, clickedHex.id);
      if (moved) {
        console.log(`Unit ${selectedUnit.id} moved to ${clickedHex.id}`);
        deselectUnit();
        redrawWithHighlights();
        return;
      }
    }
    // 別のユニットをクリック → 再選択
    if (unitOnHex && canSelectUnit(unitOnHex)) {
      selectUnit(unitOnHex);
      redrawWithHighlights();
      return;
    }
    // それ以外 → 選択解除
    deselectUnit();
    redrawWithHighlights();
    return;
  }

  // ユニット選択
  if (unitOnHex && canSelectUnit(unitOnHex)) {
    selectUnit(unitOnHex);
    redrawWithHighlights();
  }
}

function handleCombatClick(unitOnHex, shiftKey) {
  if (!unitOnHex) {
    clearCombatSelection();
    redrawWithHighlights();
    return;
  }

  const currentSide = isIsraeliPhase() ? 'ISR' : 'EGY';
  const enemySide = currentSide === 'ISR' ? 'EGY' : 'ISR';

  // 味方ユニット → 攻撃側選択/解除
  if (unitOnHex.side === currentSide) {
    if (shiftKey) {
      toggleAttacker(unitOnHex);
    } else {
      selectedAttackers = [unitOnHex];
      updateAttackButton();
    }
    redrawWithHighlights();
    return;
  }

  // 敵ユニット → 防御側選択
  if (unitOnHex.side === enemySide) {
    selectDefender(unitOnHex);
    redrawWithHighlights();
    return;
  }
}

// ===========================
// 選択可能判定（移動）
// ===========================
function canSelectUnit(unit) {
  // 移動フェイズでのみ選択可能
  if (!gameState.phase.includes('MOVE')) {
    return false;
  }

  // フェイズに応じた陣営のユニットのみ選択可能
  if (isIsraeliPhase() && unit.side !== 'ISR') {
    return false;
  }
  if (isEgyptianPhase() && unit.side !== 'EGY') {
    return false;
  }

  return true;
}

// ===========================
// エクスポート
// ===========================
export function initInputHandler(canvas, attackBtn) {
  canvas.addEventListener('click', (e) => handleCanvasClick(canvas, e));

  attackBtnElement = attackBtn;
  if (attackBtnElement) {
    attackBtnElement.addEventListener('click', executeCombat);
    hideAttackButton();
  }
}

export function clearSelection() {
  deselectUnit();
  clearCombatSelection();
  redrawWithHighlights();
}

export function getSelectedUnit() {
  return selectedUnit;
}
