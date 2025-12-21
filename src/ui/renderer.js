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

// Canvas解像度を動的に調整
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
}

// 初期化
export function initRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext("2d");
  updateCanvasSize();  // 初回サイズ設定
}

// axial -> pixel (pointy-top, odd-r offset想定)
export function hexToPixel(hex) {
  const x = currentHexSize * Math.sqrt(3) * (hex.q + 0.5 * (hex.r & 1));
  const y = currentHexSize * 1.5 * hex.r;
  return { x, y };
}

// pixel -> hex（クリック処理用）
export function pixelToHex(px, py) {
  // 簡易実装：全ヘクスとの距離を計算して最近傍を返す
  let minDist = Infinity;
  let closest = null;

  Object.values(hexes).forEach(hex => {
    const { x, y } = hexToPixel(hex);
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
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

function drawRoad(x, y, dir) {
  const angles = [-30, 30, 90, 150, 210, 270];
  const angle = Math.PI / 180 * angles[dir];
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + currentHexSize * Math.cos(angle), y + currentHexSize * Math.sin(angle));
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
}

// マップ全体を描画
export function render(showIds = true) {
  if (!ctx) {
    console.error("Renderer not initialized. Call initRenderer(canvas) first.");
    return;
  }

  ctx.clearRect(0, 0, currentWidth, currentHeight);

  Object.values(hexes).forEach(hex => {
    const { x, y } = hexToPixel(hex);

    // Hex body
    drawHex(x, y, currentHexSize);
    ctx.fillStyle = terrainColor(hex);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    // Roads
    if (hex.edges?.road) {
      hex.edges.road.forEach(dir => drawRoad(x, y, dir));
    }

    // Hex ID
    if (showIds) {
      ctx.fillStyle = "#000";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(hex.id, x, y + 3 * scale);
    }

    // Matzmed highlight
    if (hex.special?.matzmed) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3 * scale;
      drawHex(x, y, currentHexSize - 2 * scale);
      ctx.stroke();
    }
  });
}

// ハイライト描画（移動可能ヘクスなど）
export function highlightHexes(hexIds, color = "rgba(255, 255, 0, 0.3)") {
  if (!ctx) return;

  hexIds.forEach(hexId => {
    const hex = hexes[hexId];
    if (!hex) return;

    const { x, y } = hexToPixel(hex);
    drawHex(x, y, currentHexSize - 2 * scale);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

// 選択中ユニットのハイライト
export function highlightSelectedHex(hexId, color = "rgba(0, 255, 0, 0.5)") {
  if (!ctx || !hexId) return;

  const hex = hexes[hexId];
  if (!hex) return;

  const { x, y } = hexToPixel(hex);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * scale;
  drawHex(x, y, currentHexSize - 2 * scale);
  ctx.stroke();
}

export function getContext() {
  return ctx;
}

// スケール値を取得
export function getScale() {
  return scale;
}

export { hexes };
