// Across Suez - Hexes Data
// 全340ヘクス（17列×20行）定義
// 座標系：odd-r → axial (q, r)

// ===========================
// 1. 全ヘクス自動生成
// ===========================
const hexes = {};
for (let row = 1; row <= 20; row++) {
  for (let col = 1; col <= 17; col++) {
    const id = String(col).padStart(2,'0') + String(row).padStart(2,'0');
    const q = col - Math.floor((row - (row & 1)) / 2);
    const r = row;
    hexes[id] = {
      id,
      col,
      row,
      q,
      r,
      base: "clear"
    };
  }
}

// ===========================
// 2. 地形差分定義
// ===========================

// 2.1 Lake Timsah
["0501","0601","0701","0502","0602","0702"].forEach(id => {
  hexes[id].base = "lake";
});

// 2.2 Swamp（南部湿地）
["1402","1502","1602"].forEach(id => {
  hexes[id].base = "swamp";
});

// 2.3 Chinese Farm
[
  "0609","0709","0809",
  "0610","0710","0810",
  "0611","0711","0811"
].forEach(id => {
  hexes[id].base = "sand";
  hexes[id].overlay = { chineseFarm: true };
});

// 2.4 Bar Lev Line
["0112","0113","0114","0212","0213","0312"].forEach(id => {
  hexes[id].overlay = { ...(hexes[id].overlay||{}), barLev: true };
});

// 2.5 Elevated Sand（主要部）
["0911","1011","1111","0912","1012","1112"].forEach(id => {
  hexes[id].base = "sand";
  hexes[id].overlay = { ...(hexes[id].overlay||{}), elevatedSand: true };
});

// 2.6 Matzmed 特殊ヘクス
hexes["0112"].special = { matzmed: true };

// ===========================
// 3. 主要道路
// ===========================

// 3.1 Akavish Road（南北）
["1708","1608","1508","1408","1308","1208","1108","1008"].forEach(id => {
  hexes[id].edges = { ...(hexes[id].edges||{}), road: [1,4] };
});

// 3.2 Tirtur Road（東西）
["0609","0709","0809","0909","1009","1109"].forEach(id => {
  hexes[id].edges = { ...(hexes[id].edges||{}), road: [0,3] };
});

// 3.3 Televezia Road（斜行）
["0613","0712","0811","0910","1009"].forEach(id => {
  hexes[id].edges = { ...(hexes[id].edges||{}), road: [5,2] };
});

// 3.4 Missouri Road
["0904","1004","1104","1204"].forEach(id => {
  hexes[id].edges = { ...(hexes[id].edges||{}), road: [0,3] };
});

// ===========================
// 4. Entry Hexes定数（増援進入ヘクス）
// ===========================
export const ENTRY_HEXES = {
  A: "1708",  // イスラエル側増援（北部）
  B: "0407",  // エジプト側増援（中央）
  C: "0921",  // エジプト側増援（南部）
  D: null     // 未使用（将来拡張用）
};

// ===========================
// 5. axial座標インデックス構築（性能改善）
// ===========================
const qrIndex = new Map();
Object.values(hexes).forEach(h => qrIndex.set(`${h.q},${h.r}`, h));

// ===========================
// エクスポート
// ===========================
export default hexes;
export { qrIndex };
