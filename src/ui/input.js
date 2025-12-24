// Input Handler - ユニット選択、移動UI、戦闘UI

import { pixelToHex, highlightHexes, highlightSelectedHex, render } from './renderer.js';
import { hexToPixel, getContext, hexes } from './renderer.js';
import { getViewportTransform, setViewportTransform } from './renderer.js';
import { gameState, isIsraeliPhase, isEgyptianPhase, canCrossSuez, executeCrossSuez, getCrossSuezCost, canUseIsraelArtillery, getIsraelArtilleryRemaining, canBombard } from '../engine/gamestate.js';
import { getReachableHexes, getReachableHexesWithCost, moveUnit, getNeighbors } from '../engine/movement.js';
import { resolveCombat, resolveEgyptBombard, getValidBombardTargets } from '../engine/combat.js';
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
let reachableHexesWithCost = [];  // コスト情報付き移動可能ヘクス

// 戦闘モード
let selectedAttackers = [];
let selectedDefender = null;
let attackBtnElement = null;
let actionControlsTitle = null;

// 渡河モード
let crossSuezBtnElement = null;
let canCrossSelected = false;  // 選択中のユニットが渡河可能か

// 砲兵支援UI
let artillerySupportDiv = null;
let useArtilleryCheckbox = null;
let artilleryRemainingSpan = null;

// 砲撃モード（エジプト軍砲撃フェイズ用）
let bombardControlsDiv = null;
let bombardBtnElement = null;
let bombardInstructionElement = null;
let selectedBombardTargets = [];
let validBombardTargets = [];

// ズーム・パン状態
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let totalDragDistance = 0;
let canvas = null;

// ツールチップ
let tooltipElement = null;
let tooltipContent = null;

// ===========================
// ユニット選択（移動モード）
// ===========================
function selectUnit(unit) {
  selectedUnit = unit;
  reachableHexes = getReachableHexes(unit);
  reachableHexesWithCost = getReachableHexesWithCost(unit);  // コスト情報付きで取得

  // 渡河可能かチェック
  canCrossSelected = canCrossSuez(unit.id);
  updateCrossSuezButton();

  console.log(`Selected unit: ${unit.id} at ${unit.hex}`);
  console.log(`Reachable hexes: ${reachableHexes.length}`);
  if (canCrossSelected) {
    console.log(`Can cross Suez Canal (cost: ${getCrossSuezCost()} MP)`);
  }
}

function deselectUnit() {
  selectedUnit = null;
  reachableHexes = [];
  reachableHexesWithCost = [];  // コスト情報もクリア
  canCrossSelected = false;
  hideCrossSuezButton();
  hideTooltip();  // ツールチップ非表示
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
  hideArtillerySupportUI();
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
  if (actionControlsTitle) actionControlsTitle.style.display = 'block';
}

function hideAttackButton() {
  if (!attackBtnElement) return;
  attackBtnElement.style.display = 'none';
  if (actionControlsTitle) actionControlsTitle.style.display = 'none';
}

// ===========================
// 渡河ボタン制御
// ===========================
function updateCrossSuezButton() {
  if (!crossSuezBtnElement) return;

  if (canCrossSelected && selectedUnit) {
    const cost = getCrossSuezCost();
    crossSuezBtnElement.textContent = `渡河 (${cost} MP)`;
    crossSuezBtnElement.style.display = 'block';
    crossSuezBtnElement.disabled = false;
    if (actionControlsTitle) actionControlsTitle.style.display = 'block';
  } else {
    hideCrossSuezButton();
  }
}

function hideCrossSuezButton() {
  if (!crossSuezBtnElement) return;
  crossSuezBtnElement.style.display = 'none';
}

function executeCrossSuezAction() {
  if (!selectedUnit || !canCrossSelected) return;

  const success = executeCrossSuez(selectedUnit.id);
  if (success) {
    console.log(`Unit ${selectedUnit.id} crossed the Suez Canal`);
    deselectUnit();
    redrawWithHighlights();
    if (window.updateUI) window.updateUI();
  }
}

// ===========================
// 砲兵支援UI制御
// ===========================
function updateArtillerySupportUI() {
  if (!artillerySupportDiv) return;

  // ISR_COMBATフェイズかつ砲兵支援使用可能な場合のみ表示
  if (gameState.phase === 'ISR_COMBAT' && canUseIsraelArtillery()) {
    artillerySupportDiv.classList.remove('hidden');
    if (artilleryRemainingSpan) {
      artilleryRemainingSpan.textContent = `残: ${getIsraelArtilleryRemaining()}回`;
    }
    // チェックボックスを有効化
    if (useArtilleryCheckbox) {
      useArtilleryCheckbox.disabled = false;
    }
  } else {
    hideArtillerySupportUI();
  }
}

function hideArtillerySupportUI() {
  if (!artillerySupportDiv) return;
  artillerySupportDiv.classList.add('hidden');
  if (useArtilleryCheckbox) {
    useArtilleryCheckbox.checked = false;
    useArtilleryCheckbox.disabled = true;
  }
}

// ===========================
// 砲撃モード制御（エジプト軍砲撃フェイズ用）
// ===========================
function showBombardUI() {
  if (!bombardControlsDiv) return;

  // 砲撃可能かチェック
  if (!canBombard() || gameState.egyBombardUsed) {
    hideBombardUI();
    return;
  }

  // 有効な砲撃対象を取得
  validBombardTargets = getValidBombardTargets();

  if (validBombardTargets.length === 0) {
    hideBombardUI();
    return;
  }

  bombardControlsDiv.classList.remove('hidden');
  updateBombardInstruction();
  updateBombardButton();
  if (actionControlsTitle) actionControlsTitle.style.display = 'block';
}

function hideBombardUI() {
  if (!bombardControlsDiv) return;
  bombardControlsDiv.classList.add('hidden');
  selectedBombardTargets = [];
  validBombardTargets = [];
}

function updateBombardInstruction() {
  if (!bombardInstructionElement) return;

  if (gameState.egyBombardUsed) {
    bombardInstructionElement.textContent = '砲撃済み';
  } else if (selectedBombardTargets.length === 0) {
    bombardInstructionElement.textContent = `隣接する敵を最大2体選択 (対象: ${validBombardTargets.length}体)`;
  } else {
    bombardInstructionElement.textContent = `選択中: ${selectedBombardTargets.length}/2体`;
  }
}

function updateBombardButton() {
  if (!bombardBtnElement) return;

  if (selectedBombardTargets.length > 0 && !gameState.egyBombardUsed) {
    bombardBtnElement.disabled = false;
  } else {
    bombardBtnElement.disabled = true;
  }
}

function toggleBombardTarget(unit) {
  // 有効な対象かチェック
  if (!validBombardTargets.find(u => u.id === unit.id)) {
    console.log(`${unit.id} is not a valid bombard target`);
    return;
  }

  const idx = selectedBombardTargets.findIndex(u => u.id === unit.id);
  if (idx >= 0) {
    // 既に選択済み → 解除
    selectedBombardTargets.splice(idx, 1);
    console.log(`Bombard target removed: ${unit.id}`);
  } else if (selectedBombardTargets.length < 2) {
    // 未選択かつ2体未満 → 追加
    selectedBombardTargets.push(unit);
    console.log(`Bombard target added: ${unit.id}`);
  } else {
    console.log('Maximum 2 targets already selected');
  }

  updateBombardInstruction();
  updateBombardButton();
}

function clearBombardSelection() {
  selectedBombardTargets = [];
  updateBombardInstruction();
  updateBombardButton();
}

function executeBombard() {
  if (selectedBombardTargets.length === 0) return;

  const targetIds = selectedBombardTargets.map(u => u.id);
  const results = resolveEgyptBombard(targetIds);

  // ログ出力
  results.forEach(r => {
    let msg;
    if (r.result === 'eliminated') {
      msg = `Bombard: ${r.id} - Die ${r.die} → 除去`;
    } else if (r.result === 'miss') {
      msg = `Bombard: ${r.id} - Die ${r.die} → 失敗`;
    } else {
      msg = `Bombard: ${r.id} → ${r.result}`;
    }
    console.log(msg);
    gameState.log.push(msg);
  });

  clearBombardSelection();
  hideBombardUI();
  redrawWithHighlights();
  if (window.updateUI) window.updateUI();
}

function executeCombat() {
  if (selectedAttackers.length === 0 || !selectedDefender) return;

  const attackerIds = selectedAttackers.map(u => u.id);

  // 砲兵支援チェックボックスの状態を取得
  const useArtillery = useArtilleryCheckbox?.checked || false;

  const result = resolveCombat({
    attackers: attackerIds,
    defenderId: selectedDefender.id,
    useArtillery
  });

  if (result) {
    const msg = `Combat: ${result.attackStrength} vs ${result.defenseStrength}, Column ${result.column}, Die ${result.die} → ${result.result}`;
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

  // 砲撃モードハイライト
  if (gameState.phase === 'EGY_BOMBARD' && validBombardTargets.length > 0) {
    // 有効な砲撃対象をハイライト（薄い黄色）
    const validTargetHexes = validBombardTargets.map(u => u.hex);
    highlightHexes(validTargetHexes, 'rgba(255, 200, 0, 0.3)');

    // 選択済み対象をハイライト（オレンジ）
    if (selectedBombardTargets.length > 0) {
      const selectedTargetHexes = selectedBombardTargets.map(u => u.hex);
      highlightHexes(selectedTargetHexes, 'rgba(255, 100, 0, 0.5)');
    }
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

  // 砲撃フェイズ
  if (gameState.phase === 'EGY_BOMBARD') {
    handleBombardClick(unitOnHex);
    return;
  }

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
    // イスラエル戦闘フェイズなら砲兵支援UI更新
    if (gameState.phase === 'ISR_COMBAT') {
      updateArtillerySupportUI();
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

function handleBombardClick(unitOnHex) {
  // 砲撃済みなら何もしない
  if (gameState.egyBombardUsed) {
    console.log('Bombard already used this turn');
    return;
  }

  // ユニットがない場合は選択解除
  if (!unitOnHex) {
    clearBombardSelection();
    redrawWithHighlights();
    return;
  }

  // イスラエル軍ユニットのみ対象
  if (unitOnHex.side === 'ISR') {
    toggleBombardTarget(unitOnHex);
    redrawWithHighlights();
    return;
  }

  // エジプト軍ユニットをクリックしても何もしない
  console.log('Cannot target Egyptian units');
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

// ドラッグ中のパン + ツールチップ表示
function handleMouseMove(event) {
  // パン操作中
  if (isDragging) {
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    totalDragDistance += Math.abs(deltaX) + Math.abs(deltaY);

    const vt = getViewportTransform();
    setViewportTransform(vt.x + deltaX, vt.y + deltaY, vt.zoom);

    dragStartX = event.clientX;
    dragStartY = event.clientY;

    redrawWithHighlights();
    return;
  }

  // ツールチップ表示（ユニット選択中かつ移動可能ヘクスあり）
  if (selectedUnit && reachableHexesWithCost.length > 0) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hex = pixelToHex(x, y);
    if (hex) {
      const costInfo = reachableHexesWithCost.find(h => h.hexId === hex.id);
      if (costInfo) {
        showTooltip(event.clientX, event.clientY, costInfo);
        return;
      }
    }
  }

  hideTooltip();
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
  hideTooltip();
}

// ===========================
// ツールチップ表示・非表示
// ===========================
function showTooltip(screenX, screenY, costInfo) {
  if (!tooltipElement || !tooltipContent) return;

  const cost = costInfo.cost.toFixed(1);
  const remaining = costInfo.remainingMP.toFixed(1);
  tooltipContent.textContent = `コスト: ${cost} MP / 残: ${remaining} MP`;

  tooltipElement.style.left = `${screenX + 15}px`;
  tooltipElement.style.top = `${screenY + 15}px`;
  tooltipElement.classList.remove('hidden');
}

function hideTooltip() {
  if (!tooltipElement) return;
  tooltipElement.classList.add('hidden');
}

// ===========================
// エクスポート
// ===========================
export function initInputHandler(canvasElement, attackBtn, crossSuezBtn = null) {
  canvas = canvasElement;

  // ツールチップ要素取得
  tooltipElement = document.getElementById('move-tooltip');
  tooltipContent = document.getElementById('tooltip-content');

  // アクションコントロールタイトル取得
  actionControlsTitle = document.getElementById('action-controls-title');

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

  // 渡河ボタン
  crossSuezBtnElement = crossSuezBtn;
  if (crossSuezBtnElement) {
    crossSuezBtnElement.addEventListener('click', executeCrossSuezAction);
    hideCrossSuezButton();
  }

  // 砲兵支援UI要素取得
  artillerySupportDiv = document.getElementById('artillery-support');
  useArtilleryCheckbox = document.getElementById('use-artillery');
  artilleryRemainingSpan = document.getElementById('artillery-remaining');
  hideArtillerySupportUI();

  // 砲撃UI要素取得
  bombardControlsDiv = document.getElementById('bombard-controls');
  bombardBtnElement = document.getElementById('bombard-btn');
  bombardInstructionElement = document.getElementById('bombard-instruction');
  if (bombardBtnElement) {
    bombardBtnElement.addEventListener('click', executeBombard);
  }
  hideBombardUI();
}

export function clearSelection() {
  deselectUnit();
  clearCombatSelection();
  clearBombardSelection();
  hideBombardUI();
  redrawWithHighlights();
}

export function getSelectedUnit() {
  return selectedUnit;
}

export function updatePhaseUI() {
  // フェイズに応じたUI更新
  if (gameState.phase === 'EGY_BOMBARD') {
    showBombardUI();
  } else {
    hideBombardUI();
  }
}
