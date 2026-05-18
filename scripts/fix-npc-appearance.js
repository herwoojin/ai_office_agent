#!/usr/bin/env node
/**
 * fix-npc-appearance.js
 *
 * bootstrap 으로 만들어진 NPC 들의 appearance 가 비어있어서 화면에 보이지 않는 문제 해결.
 * office-presets.ts 에 패치된 3인 NPC 의 layers 를 DB 의 npcs.appearance 에 직접 채워넣는다.
 */

const path = require("path");
const Database = require(path.join("/Users/heoujin/ai-office-agents/desk_rpg_model/node_modules/better-sqlite3"));

const APPEARANCES = {
  "김대리": {
    bodyType: "male",
    layers: {
      body:  { itemKey: "body", variant: "light" },
      eyes:  { itemKey: "eye_color", variant: "brown" },
      hair:  { itemKey: "hair_short1", variant: "black" },
      torso: { itemKey: "torso_clothes_shirt", variant: "blue" },
      legs:  { itemKey: "legs_pants", variant: "navy" },
      feet:  { itemKey: "feet_shoes_basic", variant: "black" },
    },
  },
  "박과장": {
    bodyType: "female",
    layers: {
      body:  { itemKey: "body", variant: "light" },
      eyes:  { itemKey: "eye_color", variant: "green" },
      hair:  { itemKey: "hair_long1", variant: "auburn" },
      torso: { itemKey: "torso_clothes_blouse", variant: "white" },
      legs:  { itemKey: "legs_skirt", variant: "charcoal" },
      feet:  { itemKey: "feet_shoes_basic", variant: "brown" },
    },
  },
  "이주임": {
    bodyType: "male",
    layers: {
      body:  { itemKey: "body", variant: "light" },
      eyes:  { itemKey: "eye_color", variant: "blue" },
      hair:  { itemKey: "hair_messy1", variant: "chestnut" },
      torso: { itemKey: "torso_clothes_tshirt", variant: "green" },
      legs:  { itemKey: "legs_pants", variant: "grey" },
      feet:  { itemKey: "feet_shoes_basic", variant: "brown" },
    },
  },
};

const db = new Database("/Users/heoujin/ai-office-agents/desk_rpg_model/data/deskrpg.db");
const rows = db.prepare("SELECT id, name FROM npcs").all();
let fixed = 0;
for (const r of rows) {
  const ap = APPEARANCES[r.name];
  if (!ap) {
    console.warn("⚠ no appearance preset for", r.name);
    continue;
  }
  db.prepare("UPDATE npcs SET appearance=? WHERE id=?").run(JSON.stringify(ap), r.id);
  console.log(`✓ ${r.name}: appearance updated`);
  fixed++;
}
console.log(`\n${fixed}/${rows.length} NPCs updated.`);
db.close();
