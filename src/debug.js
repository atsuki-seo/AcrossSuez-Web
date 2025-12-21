// Debug utilities for testing victory conditions
// ブラウザコンソールから window.debug で利用可能

import { gameState } from './engine/gamestate.js';
import { checkGameEnd } from './engine/victory.js';
import { applyReinforcements } from './engine/units.js';

export const debug = {
  // Turn 7に直接ジャンプ
  jumpToTurn7() {
    gameState.turn = 7;
    gameState.phaseIndex = 0;
    gameState.phase = "ISR_MOVE";
    gameState.isNight = true;
    gameState.log.push("DEBUG: Jumped to Turn 7");
    console.log("Jumped to Turn 7");
  },

  // Turn 7終了時の勝利判定を手動実行
  checkVictory() {
    const result = checkGameEnd();
    if (result) {
      gameState.gameOver = result;
    }
    console.log("Victory check result:", result);
    return result;
  },

  // 橋ユニットをMatzmedに配置
  placeBridgeAtMatzmed() {
    // 橋ユニットはTurn 3の増援なので、まず増援を適用
    if (!gameState.units["ISR_BARAM4"]) {
      applyReinforcements(3);
    }

    const bridge = gameState.units["ISR_BARAM4"];
    if (bridge) {
      bridge.hex = "0112"; // Matzmed
      gameState.log.push("DEBUG: Bridge placed at Matzmed");
      console.log("Bridge placed at Matzmed");
    } else {
      console.warn("Bridge unit not found even after applying reinforcements");
    }
  },

  // crossSuezBoxにテスト用ユニットを追加
  fillCrossSuezBox(count = 6) {
    gameState.crossSuezBox = [];
    const israeliUnits = Object.values(gameState.units)
      .filter(u => u.side === "ISR")
      .slice(0, count);

    israeliUnits.forEach(u => {
      gameState.crossSuezBox.push(u.id);
    });
    gameState.log.push(`DEBUG: Added ${count} units to Cross Suez Box`);
    console.log(`Added ${count} units to Cross Suez Box:`, gameState.crossSuezBox);
  },

  // イスラエル勝利条件をセットアップ
  setupIsraeliVictory() {
    this.jumpToTurn7();
    this.placeBridgeAtMatzmed();
    this.fillCrossSuezBox(6);
    console.log("Israeli victory conditions set up");
  },

  // エジプト勝利条件をセットアップ（橋なし）
  setupEgyptianVictory() {
    this.jumpToTurn7();
    // Don't place bridge at Matzmed
    this.fillCrossSuezBox(6);
    console.log("Egyptian victory conditions set up (no bridge at Matzmed)");
  },

  // 現在のゲーム状態を表示
  showGameState() {
    console.log("Current game state:", {
      turn: gameState.turn,
      phase: gameState.phase,
      isNight: gameState.isNight,
      gameOver: gameState.gameOver,
      crossSuezBoxCount: gameState.crossSuezBox.length,
      bridgeAtMatzmed: Object.values(gameState.units).some(
        u => u.type === "bridge" && u.hex === "0112"
      )
    });
  },

  // ゲームステートへの直接アクセス
  get gameState() {
    return gameState;
  }
};

// ブラウザのwindowオブジェクトに公開
if (typeof window !== 'undefined') {
  window.debug = debug;
  console.log("Debug utilities loaded. Use window.debug to access:");
  console.log("  debug.jumpToTurn7() - Jump to Turn 7");
  console.log("  debug.setupIsraeliVictory() - Setup Israeli victory");
  console.log("  debug.setupEgyptianVictory() - Setup Egyptian victory");
  console.log("  debug.checkVictory() - Check victory conditions");
  console.log("  debug.showGameState() - Show current game state");
}
