# Across Suez

SPI社の歴史的ウォーゲームのブラウザ実装

第四次中東戦争（1973年）のスエズ運河西岸での戦いを再現したターン制戦略ゲーム。イスラエル軍とエジプト軍の7ターンにわたる激戦をシミュレート。

## 技術スタック

- **ビルドツール**: Vite 6.4.1
- **モジュールシステム**: ES Modules
- **UIフレームワーク**: Vanilla JavaScript（フレームワークなし）
- **開発サーバー**: Vite Dev Server (npm run dev)

---

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev
# → http://localhost:5173/

# 本番ビルド（ユーザ指示時のみ）
npm run build
# → dist/フォルダに出力

# ビルドプレビュー（ユーザ指示時のみ）
npm run preview
```

---

## プロジェクト構造

```
AcrossSuez-Web/
├── src/
│   ├── engine/                    # ゲームロジック
│   │   ├── hexes.js              # 340ヘクスのマップデータ
│   │   ├── units.js              # ユニット定義・増援
│   │   ├── gamestate.js          # ゲーム状態管理（Single Source of Truth）
│   │   ├── movement.js           # 移動・ZOC・移動可能ヘクス計算
│   │   ├── combat.js             # 戦闘解決・CRT
│   │   └── victory.js            # 勝利条件・LOC判定
│   │
│   ├── ui/                        # UI・描画
│   │   ├── renderer.js           # Canvas描画・ヘクス座標変換
│   │   └── input.js              # クリック処理・ユニット選択・戦闘UI
│   │
│   ├── debug.js                   # デバッグユーティリティ
│   ├── main.js                    # エントリーポイント
│   └── style.css                  # スタイル定義
│
├── index.html                     # HTMLテンプレート
├── package.json                   # npm設定
├── README.md                      # このファイル
└── CLAUDE.md                      # Claude Code用ガイドライン
```

---

## アーキテクチャ設計

### Single Source of Truth

`src/engine/gamestate.js` の `gameState` オブジェクトがゲーム状態の唯一の正典。

```javascript
gameState = {
  turn: number,           // 現在のターン (1-7)
  phase: string,          // 現在のフェイズ
  isNight: boolean,       // 夜間ターンか
  units: {},              // 全ユニット
  crossSuezBox: [],       // 渡河済みユニットID
  log: [],                // ゲームログ
  gameOver: string|null   // "ISR_WIN" | "EGY_WIN" | null
}
```

### モジュール間の依存関係

```
main.js
  ├─> renderer.js (描画)
  ├─> input.js (UI) ─┬─> movement.js (移動)
  │                  ├─> combat.js (戦闘)
  │                  └─> gamestate.js (状態)
  │
  └─> gamestate.js ─┬─> units.js (ユニット)
                    └─> victory.js (勝利条件)
```

---

## ゲームルール概要

### フェイズシーケンス

1. **ISR_MOVE** - イスラエル軍移動
2. **ISR_COMBAT** - イスラエル軍戦闘
3. **EGY_MOVE** - エジプト軍移動
4. **EGY_BOMBARD** - エジプト軍砲撃（昼間のみ）
5. **EGY_COMBAT** - エジプト軍戦闘

### 移動ルール

- **移動力**: ユニットごとに異なる（例: armor=12, mech=8, inf=10）
- **夜間ペナルティ**: Turn 1,4,7は夜間（移動力-2）
- **地形コスト**:
  - clear / barLev: 1MP
  - sand / chineseFarm / elevatedSand: 3MP
  - road: 0.5MP
  - swamp / lake: 通行不可
- **ZOC（Zone of Control）**: 敵ZOCに入ると停止

### 戦闘ルール

- **CRT（Combat Results Table）**: 戦力差に基づくダイスロール
- **地形修正**:
  - Chinese Farm: -2シフト
  - Elevated Sand / Bar Lev: -1シフト
- **戦闘結果**: Ae（攻撃側除去）, Ar（攻撃側退却）, De（防御側除去）, Dr（防御側退却）, Ee（交換）

### 勝利条件（Turn 7終了時）

**イスラエル軍勝利の条件**:
1. 橋ユニットがMatzmed（0112）に存在
2. MatzmedからLOC目標地点（1708）への補給線確保
3. crossSuezBox（渡河済みユニット）が6個以上

上記のいずれかが満たされない場合、エジプト軍勝利。

**即敗条件**: 橋ユニットがMatzmedから移動した場合、即座にエジプト軍勝利。

---

## デバッグ方法

開発サーバー起動後、ブラウザのコンソールで `window.debug` を使用可能。

### デバッグコマンド

```javascript
// Turn 7に直接ジャンプ
debug.jumpToTurn7()

// 橋をMatzmedに配置
debug.placeBridgeAtMatzmed()

// crossSuezBoxにユニット追加
debug.fillCrossSuezBox(6)

// 勝利条件チェック
debug.checkVictory()

// 現在の状態表示
debug.showGameState()

// イスラエル勝利条件セットアップ
debug.setupIsraeliVictory()

// エジプト勝利条件セットアップ
debug.setupEgyptianVictory()

// UI更新
updateUI()
redrawAll()
```

---

## 重要な実装ノート

### 座標系

- **ヘクスグリッド**: Pointy-top（尖った頂点が上）
- **オフセット座標**: Odd-r（奇数行オフセット）
- **Axial座標**: (q, r) で内部処理

### 隣接ヘクス方向

```javascript
const DIRS = [
  { dq: 1, dr: 0 },   // E
  { dq: 0, dr: 1 },   // SE
  { dq: -1, dr: 1 },  // SW
  { dq: -1, dr: 0 },  // W
  { dq: 0, dr: -1 },  // NW
  { dq: 1, dr: -1 }   // NE
];
```

### Canvas描画

- **HEX_SIZE**: 20ピクセル
- **座標変換**: `hexToPixel(hex)` / `pixelToHex(x, y)`
- **再描画**: `render(true)` + `placeUnits(ctx, hexToPixel)`

---

## 今後の拡張ポイント

- [ ] EGY_BOMBARD フェイズの実装
- [ ] スエズ運河渡河ロジック（crossSuezBox への追加）
- [ ] ユニット情報パネルの詳細表示
- [ ] 操作説明UI
- [ ] セーブ/ロード機能
- [ ] AI対戦モード
