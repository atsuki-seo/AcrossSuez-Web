// Across Suez Map Renderer (STEP2移植)
// hexes.jsを前提としたマップ描画エンジン

import hexes from "../engine/hexes.js";

export const HEX_SIZE = 30;           // 半径
export const WIDTH = 1200;
export const HEIGHT = 900;

let canvas = null;
let ctx = null;

// 初期化
export function initRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext("2d");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
}

// axial -> pixel (pointy-top, odd-r offset想定)
export function hexToPixel(hex) {
  const x = HEX_SIZE * Math.sqrt(3) * (hex.q + 0.5 * (hex.r & 1));
  const y = HEX_SIZE * 1.5 * hex.r;
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

  return minDist < HEX_SIZE ? closest : null;
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
  ctx.lineTo(x + HEX_SIZE * Math.cos(angle), y + HEX_SIZE * Math.sin(angle));
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// マップ全体を描画
export function render(showIds = true) {
  if (!ctx) {
    console.error("Renderer not initialized. Call initRenderer(canvas) first.");
    return;
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  Object.values(hexes).forEach(hex => {
    const { x, y } = hexToPixel(hex);

    // Hex body
    drawHex(x, y, HEX_SIZE);
    ctx.fillStyle = terrainColor(hex);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Roads
    if (hex.edges?.road) {
      hex.edges.road.forEach(dir => drawRoad(x, y, dir));
    }

    // Hex ID
    if (showIds) {
      ctx.fillStyle = "#000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(hex.id, x, y + 3);
    }

    // Matzmed highlight
    if (hex.special?.matzmed) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      drawHex(x, y, HEX_SIZE - 2);
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
    drawHex(x, y, HEX_SIZE - 2);
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
  ctx.lineWidth = 4;
  drawHex(x, y, HEX_SIZE - 2);
  ctx.stroke();
}

export function getContext() {
  return ctx;
}

export { hexes };
