// Across Suez Map Renderer (STEP2移植)
// hexes.jsを前提としたマップ描画エンジン

import hexes from "../engine/hexes.js";

// 基準サイズ（デフォルト値）
const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;
const BASE_HEX_SIZE = 30;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;  // 16:9

// 現在の動的サイズ（リサイズ時に更新）
let currentWidth = BASE_WIDTH;
let currentHeight = BASE_HEIGHT;
let currentHexSize = BASE_HEX_SIZE;
let scale = 1.0;

let canvas = null;
let ctx = null;

// ===========================
// ビューポート変換（ズーム・パン管理）
// ===========================
let viewportTransform = {
  x: 0,        // パンオフセットX
  y: 0,        // パンオフセットY
  zoom: 1.0    // ズーム倍率（ユーザー操作）
};

// ビューポート変換をリセット（初期化・リサイズ時）
export function resetViewportTransform() {
  // マップを画面中央に配置（初期オフセット）
  // 中央ヘクス（col=9, row=10）のワールド座標を計算
  const centerHex = hexes["0910"];
  if (!centerHex) {
    console.error("Center hex not found");
    return;
  }

  const mapCenterX = currentHexSize * Math.sqrt(3) * (centerHex.q + 0.5 * (centerHex.r & 1));
  const mapCenterY = currentHexSize * 1.5 * centerHex.r;

  // 画面中央に配置
  viewportTransform.x = currentWidth / 2 - mapCenterX;
  viewportTransform.y = currentHeight / 2 - mapCenterY;
  viewportTransform.zoom = 1.0;

  console.log(`Viewport reset: centerHex=${centerHex.id} (q=${centerHex.q},r=${centerHex.r}), mapCenter=(${mapCenterX.toFixed(0)},${mapCenterY.toFixed(0)}), offset=(${viewportTransform.x.toFixed(0)}, ${viewportTransform.y.toFixed(0)}), zoom=${viewportTransform.zoom}`);
}

// Getter/Setter
export function getViewportTransform() {
  return { ...viewportTransform };
}

export function setViewportTransform(x, y, zoom) {
  viewportTransform.x = x;
  viewportTransform.y = y;
  viewportTransform.zoom = zoom;
}

// スクリーン座標 → ワールド座標
export function screenToWorld(screenX, screenY) {
  const worldX = (screenX - viewportTransform.x) / viewportTransform.zoom;
  const worldY = (screenY - viewportTransform.y) / viewportTransform.zoom;
  return { worldX, worldY };
}

// ワールド座標 → スクリーン座標
export function worldToScreen(worldX, worldY) {
  const x = worldX * viewportTransform.zoom + viewportTransform.x;
  const y = worldY * viewportTransform.zoom + viewportTransform.y;
  return { x, y };
}

// ===========================
// Canvas解像度を動的に調整
// ===========================
export function updateCanvasSize() {
  if (!canvas) return;

  // コンテナサイズを取得
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth - 40;   // padding 20px * 2
  const containerHeight = container.clientHeight - 40;

  // アスペクト比を維持して最適サイズを計算
  let newWidth, newHeight;
  const containerRatio = containerWidth / containerHeight;

  if (containerRatio > ASPECT_RATIO) {
    // 高さ基準
    newHeight = containerHeight;
    newWidth = newHeight * ASPECT_RATIO;
  } else {
    // 幅基準
    newWidth = containerWidth;
    newHeight = newWidth / ASPECT_RATIO;
  }

  // 最小サイズ制限（800x450, 16:9）
  newWidth = Math.max(800, newWidth);
  newHeight = Math.max(450, newHeight);

  // Canvas内部解像度を設定
  canvas.width = newWidth;
  canvas.height = newHeight;

  // Canvas表示サイズも同期（CSS）
  canvas.style.width = `${newWidth}px`;
  canvas.style.height = `${newHeight}px`;

  // スケール比率を計算
  scale = newWidth / BASE_WIDTH;

  // ヘクスサイズとキャンバスサイズを更新
  currentWidth = newWidth;
  currentHeight = newHeight;
  currentHexSize = BASE_HEX_SIZE * scale;

  console.log(`Canvas resized: ${newWidth.toFixed(0)}x${newHeight.toFixed(0)}, scale: ${scale.toFixed(2)}`);

  // ビューポートを初期化してマップを中央に配置
  resetViewportTransform();
}

// 初期化
export function initRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext("2d");
  updateCanvasSize();  // 初回サイズ設定
}

// axial -> pixel (pointy-top, odd-r offset想定) + ビューポート変換
export function hexToPixel(hex) {
  // ワールド座標計算（ヘクス→ピクセル）
  const worldX = currentHexSize * Math.sqrt(3) * (hex.q + 0.5 * (hex.r & 1));
  const worldY = currentHexSize * 1.5 * hex.r;

  // スクリーン座標に変換（ズーム・パン適用）
  return worldToScreen(worldX, worldY);
}

// pixel -> hex（クリック処理用） + ビューポート逆変換
export function pixelToHex(px, py) {
  // スクリーン座標をワールド座標に変換
  const { worldX, worldY } = screenToWorld(px, py);

  // ワールド座標で最近傍ヘクスを検索
  let minDist = Infinity;
  let closest = null;

  Object.values(hexes).forEach(hex => {
    const wx = currentHexSize * Math.sqrt(3) * (hex.q + 0.5 * (hex.r & 1));
    const wy = currentHexSize * 1.5 * hex.r;
    const dist = Math.sqrt((worldX - wx) ** 2 + (worldY - wy) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closest = hex;
    }
  });

  return minDist < currentHexSize ? closest : null;
}

function drawHex(x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function terrainColor(hex) {
  if (hex.base === "lake") return "#6fa8dc";
  if (hex.base === "swamp") return "#38761d";
  if (hex.overlay?.chineseFarm) return "#a4c2f4";
  if (hex.overlay?.elevatedSand) return "#f6b26b";
  if (hex.base === "sand") return "#ffe599";
  return "#dddddd"; // clear
}

function drawRoad(x, y, dir, hexSize, lineScale) {
  const angles = [-30, 30, 90, 150, 210, 270];
  const angle = Math.PI / 180 * angles[dir];
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + hexSize * Math.cos(angle), y + hexSize * Math.sin(angle));
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2 * lineScale;
  ctx.stroke();
}

// マップ全体を描画
export function render(showIds = true) {
  if (!ctx) {
    console.error("Renderer not initialized. Call initRenderer(canvas) first.");
    return;
  }

  ctx.clearRect(0, 0, currentWidth, currentHeight);

  const effectiveHexSize = getEffectiveHexSize();
  const effectiveScale = scale * viewportTransform.zoom;

  Object.values(hexes).forEach(hex => {
    const { x, y } = hexToPixel(hex);

    // Hex body
    drawHex(x, y, effectiveHexSize);
    ctx.fillStyle = terrainColor(hex);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1 * effectiveScale;
    ctx.stroke();

    // Roads
    if (hex.edges?.road) {
      hex.edges.road.forEach(dir => drawRoad(x, y, dir, effectiveHexSize, effectiveScale));
    }

    // Hex ID
    if (showIds) {
      ctx.fillStyle = "#000";
      ctx.font = `${10 * effectiveScale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(hex.id, x, y + 3 * effectiveScale);
    }

    // Matzmed highlight
    if (hex.special?.matzmed) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3 * effectiveScale;
      drawHex(x, y, effectiveHexSize - 2 * effectiveScale);
      ctx.stroke();
    }
  });
}

// ハイライト描画（移動可能ヘクスなど）
export function highlightHexes(hexIds, color = "rgba(255, 255, 0, 0.3)") {
  if (!ctx) return;

  const effectiveHexSize = getEffectiveHexSize();
  const effectiveScale = scale * viewportTransform.zoom;

  hexIds.forEach(hexId => {
    const hex = hexes[hexId];
    if (!hex) return;

    const { x, y } = hexToPixel(hex);
    drawHex(x, y, effectiveHexSize - 2 * effectiveScale);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

// 選択中ユニットのハイライト
export function highlightSelectedHex(hexId, color = "rgba(0, 255, 0, 0.5)") {
  if (!ctx || !hexId) return;

  const hex = hexes[hexId];
  if (!hex) return;

  const effectiveHexSize = getEffectiveHexSize();
  const effectiveScale = scale * viewportTransform.zoom;

  const { x, y } = hexToPixel(hex);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * effectiveScale;
  drawHex(x, y, effectiveHexSize - 2 * effectiveScale);
  ctx.stroke();
}

export function getContext() {
  return ctx;
}

// スケール値を取得
export function getScale() {
  return scale;
}

// ズーム適用後の実効ヘクスサイズを取得
function getEffectiveHexSize() {
  return currentHexSize * viewportTransform.zoom;
}

export { hexes };
