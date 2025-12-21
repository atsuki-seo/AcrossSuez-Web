// STEP3: Unit placement & reinforcement integration
// 前提: hexes.js (STEP1), map renderer (STEP2)

import hexes from "./hexes.js";

// ----------------------------
// 1. Unit Data Definition
// ----------------------------

export const units = {
  // Israeli initial units
  "ISR_RES1": { id:"ISR_RES1", side:"ISR", type:"mech", strength:3, move:8, hex:"0210" },
  "ISR_RES2": { id:"ISR_RES2", side:"ISR", type:"mech", strength:3, move:8, hex:"0308" },
  "ISR_RES3": { id:"ISR_RES3", side:"ISR", type:"mech", strength:4, move:12, hex:"0608" },

  "ISR_EREZ1": { id:"ISR_EREZ1", side:"ISR", type:"armor", strength:4, move:12, hex:"0615" },
  "ISR_EREZ2": { id:"ISR_EREZ2", side:"ISR", type:"armor", strength:3, move:12, hex:"0614" },
  "ISR_EREZ3": { id:"ISR_EREZ3", side:"ISR", type:"armor", strength:2, move:12, hex:"0814" },

  "ISR_MATT1": { id:"ISR_MATT1", side:"ISR", type:"mech", strength:3, move:8, hex:"0613" },
  "ISR_MATT2": { id:"ISR_MATT2", side:"ISR", type:"mech", strength:4, move:12, hex:"0612" },
  "ISR_MATT3": { id:"ISR_MATT3", side:"ISR", type:"mech", strength:4, move:12, hex:"0810" },

  "ISR_RAVIV1": { id:"ISR_RAVIV1", side:"ISR", type:"mech", strength:4, move:12, hex:"1405" },
  "ISR_RAVIV2": { id:"ISR_RAVIV2", side:"ISR", type:"mech", strength:4, move:12, hex:"1503" },

  "ISR_SHARON": { id:"ISR_SHARON", side:"ISR", type:"cav", strength:2, move:18, hex:"0211" },

  // Egyptian initial units
  "EGY_14211": { id:"EGY_14211", side:"EGY", type:"inf", strength:3, move:10, hex:"0206" },
  "EGY_14212": { id:"EGY_14212", side:"EGY", type:"inf", strength:3, move:10, hex:"0407" },
  "EGY_14213": { id:"EGY_14213", side:"EGY", type:"inf", strength:4, move:10, hex:"0708" },

  "EGY_161": { id:"EGY_161", side:"EGY", type:"armor", strength:3, move:8, hex:"0512" },
  "EGY_162": { id:"EGY_162", side:"EGY", type:"inf", strength:2, move:8, hex:"0610" },
  "EGY_163": { id:"EGY_163", side:"EGY", type:"inf", strength:2, move:8, hex:"0812" },
  "EGY_164": { id:"EGY_164", side:"EGY", type:"inf", strength:2, move:10, hex:"0910" },
};

// ----------------------------
// 2. Reinforcement Schedule
// ----------------------------

export const reinforcements = [
  // Israeli
  { turn:2, id:"ISR_AMIR1", side:"ISR", type:"mech", strength:4, move:12, entry:"1708" },
  { turn:2, id:"ISR_AMIR2", side:"ISR", type:"mech", strength:4, move:12, entry:"1708" },

  { turn:3, id:"ISR_BARAM4", side:"ISR", type:"bridge", strength:1, move:8, entry:"1708" },

  // Egyptian
  { turn:2, id:"EGY_231", side:"EGY", type:"inf", strength:3, move:10, entry:"0407" },
  { turn:5, id:"EGY_251", side:"EGY", type:"inf", strength:4, move:10, entry:"0921" }
];

// ----------------------------
// 3. Rendering Units
// ----------------------------

function unitColor(unit) {
  return unit.side === "ISR" ? "#0033cc" : "#cc0000";
}

function drawUnit(ctx, hex, unit) {
  const { x, y } = hex;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = unitColor(unit);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unit.strength, x, y);
}

// ----------------------------
// 4. Placement Logic
// ----------------------------

export function placeUnits(ctx, hexToPixel) {
  Object.values(units).forEach(unit => {
    if (!unit.hex) return;
    const hex = hexes[unit.hex];
    if (!hex) return;
    const pos = hexToPixel(hex);
    drawUnit(ctx, pos, unit);
  });
}

// ----------------------------
// 5. Reinforcement Entry
// ----------------------------

export function applyReinforcements(turn) {
  reinforcements
    .filter(r => r.turn === turn)
    .forEach(r => {
      units[r.id] = {
        id: r.id,
        side: r.side,
        type: r.type,
        strength: r.strength,
        move: r.move,
        hex: r.entry
      };
    });
}

// STEP3 completes visual + logical connection of units to map
