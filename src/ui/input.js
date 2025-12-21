// Input Handler - ユニット選択、移動UI、戦闘UI

import { pixelToHex, highlightHexes, highlightSelectedHex, render } from './renderer.js';
import { hexToPixel, getContext, hexes } from './renderer.js';
import { getViewportTransform, setViewportTransform } from './renderer.js';
import { gameState, isIsraeliPhase, isEgyptianPhase } from '../engine/gamestate.js';
import { getReachableHexes, moveUnit, getNeighbors } from '../engine/movement.js';
import { resolveCombat } from '../engine/combat.js';
import { placeUnits } from '../engine/units.js';

// ===========================
// ズーム・パン設定
// ===========================
const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.5;      // 最小50%
const MAX_ZOOM = 3.0;      // 最大300%
const DRAG_THRESHOLD = 5;  // ドラッグ判定閾値（ピクセル）

// ===========================
// 状態管理
// ===========================
let selectedUnit = null;
let reachableHexes = [];

// 戦闘モード
let selectedAttackers = [];
let selectedDefender = null;
let attackBtnElement = null;

// ズーム・パン状態
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let totalDragDistance = 0;
let canvas = null;

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
  if (window.updateUI) window.updateUI();
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
  // 左クリック以外は無視（パン用途）
  if (event.button !== 0) return;

  // ドラッグ後のクリックは無視（閾値チェック）
  if (totalDragDistance > DRAG_THRESHOLD) {
    totalDragDistance = 0;
    return;
  }

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
        gameState.log.push(`Move: ${selectedUnit.id} -> ${clickedHex.id}`);
        deselectUnit();
        redrawWithHighlights();
        if (window.updateUI) window.updateUI();
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
// ズーム・パンハンドラ
// ===========================

// マウスホイールでズーム
function handleWheel(event) {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const vt = getViewportTransform();
  const oldZoom = vt.zoom;

  // 新しいズーム値計算（ホイール上=拡大、下=縮小）
  let newZoom = oldZoom - event.deltaY * ZOOM_SENSITIVITY;
  newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

  // ズーム中心点調整（マウス位置を中心に）
  const zoomRatio = newZoom / oldZoom;
  const newX = mouseX - (mouseX - vt.x) * zoomRatio;
  const newY = mouseY - (mouseY - vt.y) * zoomRatio;

  setViewportTransform(newX, newY, newZoom);
  redrawWithHighlights();
}

// 右クリックでパン開始
function handleMouseDown(event) {
  // 中クリック(1)または右クリック(2)でパン
  if (event.button === 1 || event.button === 2) {
    event.preventDefault();
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    totalDragDistance = 0;
    canvas.style.cursor = 'grabbing';
  }
}

// ドラッグ中のパン
function handleMouseMove(event) {
  if (!isDragging) return;

  const deltaX = event.clientX - dragStartX;
  const deltaY = event.clientY - dragStartY;

  totalDragDistance += Math.abs(deltaX) + Math.abs(deltaY);

  const vt = getViewportTransform();
  setViewportTransform(vt.x + deltaX, vt.y + deltaY, vt.zoom);

  dragStartX = event.clientX;
  dragStartY = event.clientY;

  redrawWithHighlights();
}

// パン終了
function handleMouseUp(event) {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'default';
  }
}

// Canvas外に出た場合
function handleMouseLeave(event) {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'default';
  }
}

// ===========================
// エクスポート
// ===========================
export function initInputHandler(canvasElement, attackBtn) {
  canvas = canvasElement;

  // 既存のクリックイベント
  canvas.addEventListener('click', (e) => handleCanvasClick(canvas, e));

  // ズーム・パンイベント
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());  // 右クリックメニュー無効化

  // 攻撃ボタン
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
