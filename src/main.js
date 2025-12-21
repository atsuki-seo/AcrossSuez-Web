// Across Suez - メインエントリーポイント
import './style.css';
import { initRenderer, render, hexToPixel, getContext, updateCanvasSize } from './ui/renderer.js';
import { placeUnits } from './engine/units.js';
import { gameState, advancePhase } from './engine/gamestate.js';
import { initInputHandler, clearSelection } from './ui/input.js';

// デバッグユーティリティ（開発環境でのみ）
import './debug.js';

// ===========================
// UI要素
// ===========================
let turnDisplay, phaseDisplay, logContent, nextPhaseBtn, attackBtn;
let gameOverModal, gameOverTitle, gameOverMessage, restartBtn;
let attackerListElement, defenderInfoElement;

// ===========================
// UI更新関数
// ===========================
function updateUI() {
  turnDisplay.textContent = gameState.turn;
  phaseDisplay.textContent = `${gameState.phase}${gameState.isNight ? ' (Night)' : ''}`;

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

// 戦闘UI更新関数
function updateCombatUI(attackers, defender) {
  if (!attackerListElement || !defenderInfoElement) return;

  // 攻撃ユニット一覧を更新
  if (!attackers || attackers.length === 0) {
    attackerListElement.innerHTML = '<p class="info-text">攻撃ユニットなし</p>';
  } else {
    attackerListElement.innerHTML = '<h4>攻撃側:</h4>';
    attackers.forEach(unit => {
      const div = document.createElement('div');
      div.className = 'combat-unit-entry';
      div.textContent = `${unit.id} (戦闘力: ${unit.combatStrength || 1})`;
      attackerListElement.appendChild(div);
    });
  }

  // 防御ユニット情報を更新
  if (!defender) {
    defenderInfoElement.innerHTML = '<p class="info-text">防御ユニットなし</p>';
  } else {
    defenderInfoElement.innerHTML = '<h4>防御側:</h4>';
    const div = document.createElement('div');
    div.className = 'combat-unit-entry';
    div.textContent = `${defender.id} (戦闘力: ${defender.combatStrength || 1})`;
    defenderInfoElement.appendChild(div);
  }
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

  // 戦闘UI要素取得
  attackerListElement = document.getElementById('attacker-list');
  defenderInfoElement = document.getElementById('defender-info');

  // ゲーム終了モーダル要素取得
  gameOverModal = document.getElementById('game-over-modal');
  gameOverTitle = document.getElementById('game-over-title');
  gameOverMessage = document.getElementById('game-over-message');
  restartBtn = document.getElementById('restart-btn');

  // レンダラー初期化
  initRenderer(canvas);

  // マップ描画
  render(true);

  // ユニット配置
  const ctx = getContext();
  placeUnits(ctx, hexToPixel);

  // UI初期化
  updateUI();

  // 入力ハンドラ初期化（移動・戦闘UI）
  initInputHandler(canvas, attackBtn);

  // イベントリスナー
  nextPhaseBtn.addEventListener('click', () => {
    advancePhase();
    clearSelection(); // フェイズ変更時に選択解除
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
    window.updateCombatUI = updateCombatUI;  // 戦闘UI更新
    window.redrawAll = redrawAll;
    window.handleResize = handleResize;  // デバッグ用
  }

  console.log('Map and units rendered successfully!');
});
