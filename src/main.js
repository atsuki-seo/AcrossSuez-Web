// Across Suez - メインエントリーポイント
import './style.css';
import { initRenderer, render, hexToPixel, getContext, updateCanvasSize, restoreInitialViewport } from './ui/renderer.js';
import { placeUnits } from './engine/units.js';
import { gameState, advancePhase } from './engine/gamestate.js';
import { initInputHandler, clearSelection, updatePhaseUI } from './ui/input.js';

// デバッグユーティリティ（開発環境でのみ）
import './debug.js';

// ===========================
// UI要素
// ===========================
let turnDisplay, phaseDisplay, logContent, nextPhaseBtn, attackBtn, crossSuezBtn;
let gameOverModal, gameOverTitle, gameOverMessage, restartBtn;
let crossSuezCountDisplay, crossSuezListDisplay;

// 表示トグル状態
export const displaySettings = {
  showHexId: true,
  showTerrainIcon: true
};

// ===========================
// UI更新関数
// ===========================
function updateUI() {
  turnDisplay.textContent = gameState.turn;
  phaseDisplay.textContent = `${gameState.phase}${gameState.isNight ? ' (Night)' : ''}`;

  // ターントラック更新
  updateTurnTrack();

  // 渡河ユニット表示更新
  updateCrossSuezBox();

  // ログ更新
  logContent.innerHTML = '';
  gameState.log.slice(-10).forEach(msg => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    // ログの種類に応じてクラス追加
    if (msg.includes('Turn')) entry.classList.add('log-turn');
    else if (msg.includes('Phase')) entry.classList.add('log-phase');
    else if (msg.includes('Move')) entry.classList.add('log-move');
    else if (msg.includes('Combat')) entry.classList.add('log-combat');
    else if (msg.includes('Game Over')) entry.classList.add('log-victory');

    entry.textContent = msg;
    logContent.appendChild(entry);
  });

  // 自動スクロール
  logContent.scrollTop = logContent.scrollHeight;

  // ゲーム終了チェック
  if (gameState.gameOver) {
    showGameOverModal(gameState.gameOver);
  }
}

// ターントラック更新関数
function updateTurnTrack() {
  const cells = document.querySelectorAll('.turn-cell');
  cells.forEach(cell => {
    const turn = parseInt(cell.dataset.turn);
    if (turn === gameState.turn) {
      cell.classList.add('active');
    } else {
      cell.classList.remove('active');
    }
  });
}

// 渡河ユニット表示更新関数
function updateCrossSuezBox() {
  if (!crossSuezCountDisplay || !crossSuezListDisplay) return;

  const count = gameState.crossSuezBox.length;
  crossSuezCountDisplay.textContent = `${count} ユニット`;

  // ユニット一覧表示
  crossSuezListDisplay.innerHTML = '';
  gameState.crossSuezBox.forEach(unitId => {
    const unit = gameState.units[unitId];
    if (unit) {
      const item = document.createElement('div');
      item.className = 'cross-suez-item';
      item.textContent = `${unitId} (${unit.strength})`;
      crossSuezListDisplay.appendChild(item);
    }
  });
}

function redrawAll() {
  const ctx = getContext();
  render(true);
  placeUnits(ctx, hexToPixel);
}

function showGameOverModal(winner) {
  const winnerText = winner === 'ISR_WIN' ? 'イスラエル軍の勝利！' : 'エジプト軍の勝利！';
  const details = winner === 'ISR_WIN'
    ? 'イスラエル軍は勝利条件を達成しました。Matzmedに橋を架け、LOCを確保し、十分な戦力をスエズ運河の西岸に送り込みました。'
    : 'イスラエル軍は勝利条件を達成できませんでした。エジプト軍の勝利です。';

  gameOverTitle.textContent = winnerText;
  gameOverMessage.textContent = details;
  gameOverModal.classList.remove('hidden');
}

// ===========================
// リサイズハンドラ（デバウンス付き）
// ===========================
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateCanvasSize();
    redrawAll();
    console.log('Canvas resized and redrawn');
  }, 300);
}

// ===========================
// 初期化処理
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Across Suez - Initializing...');

  // Canvas取得と初期化
  const canvas = document.getElementById('map');
  if (!canvas) {
    console.error('Canvas element #map not found');
    return;
  }

  // UI要素取得
  turnDisplay = document.getElementById('turn-display');
  phaseDisplay = document.getElementById('phase-display');
  logContent = document.getElementById('log-content');
  nextPhaseBtn = document.getElementById('next-phase-btn');
  attackBtn = document.getElementById('attack-btn');
  crossSuezBtn = document.getElementById('cross-suez-btn');

  // ゲーム終了モーダル要素取得
  gameOverModal = document.getElementById('game-over-modal');
  gameOverTitle = document.getElementById('game-over-title');
  gameOverMessage = document.getElementById('game-over-message');
  restartBtn = document.getElementById('restart-btn');

  // 渡河ユニット表示要素取得
  crossSuezCountDisplay = document.getElementById('cross-suez-count');
  crossSuezListDisplay = document.getElementById('cross-suez-list');

  // レンダラー初期化
  initRenderer(canvas);

  // マップ描画
  render(true);

  // ユニット配置
  const ctx = getContext();
  placeUnits(ctx, hexToPixel);

  // UI初期化
  updateUI();

  // 入力ハンドラ初期化（移動・戦闘・渡河UI）
  initInputHandler(canvas, attackBtn, crossSuezBtn);

  // 表示設定パネルのエクスパンド・コラプス
  const displayTogglesHeader = document.getElementById('display-toggles-header');
  const displayTogglesPanel = document.getElementById('display-toggles');

  if (displayTogglesHeader && displayTogglesPanel) {
    displayTogglesHeader.addEventListener('click', () => {
      displayTogglesPanel.classList.toggle('collapsed');
    });
  }

  // 表示トグルイベントリスナー
  const toggleHexId = document.getElementById('toggle-hex-id');
  const toggleTerrainIcon = document.getElementById('toggle-terrain-icon');

  if (toggleHexId) {
    toggleHexId.addEventListener('change', (e) => {
      displaySettings.showHexId = e.target.checked;
      redrawAll();
    });
  }

  if (toggleTerrainIcon) {
    toggleTerrainIcon.addEventListener('change', (e) => {
      displaySettings.showTerrainIcon = e.target.checked;
      redrawAll();
    });
  }

  // 倍率リセットボタン
  const resetZoomBtn = document.getElementById('reset-zoom-btn');
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => {
      restoreInitialViewport();
      redrawAll();
    });
  }

  // イベントリスナー
  nextPhaseBtn.addEventListener('click', () => {
    advancePhase();
    clearSelection(); // フェイズ変更時に選択解除
    updatePhaseUI();  // フェイズに応じたUI更新（砲撃モード等）
    redrawAll();
    updateUI();
  });

  restartBtn.addEventListener('click', () => {
    location.reload();
  });

  // ウィンドウリサイズイベント
  window.addEventListener('resize', handleResize);

  // デバッグ用にUI更新関数をグローバルに公開
  if (typeof window !== 'undefined') {
    window.updateUI = updateUI;
    window.redrawAll = redrawAll;
    window.handleResize = handleResize;  // デバッグ用
  }

  console.log('Map and units rendered successfully!');
});
