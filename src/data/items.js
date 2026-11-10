/**
 * Holdable Items Registry
 * Any character can equip an item unless restricted.
 * Sealed characters (under [Seal] debuff) have their item effects disabled.
 */

import { Registry } from "../engine/Registry.js";

export const ITEM_LIST = [
  {
    id: "none",
    name: "None",
    description: "No item equipped.",
  },
  {
    id: "anarch_sigil",
    name: "Sigil of Anarchy",
    description: "Increases SPD by 10 and grants +15 Energy at the start of battle.",
    statBonuses: { spd: 10 },
    onBattleStart({ unit, engine }) {
      unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 15);
      engine.log(`${unit.name}'s Sigil of Anarchy surges (+15 Energy)!`, "status");
    },
  },
  {
    id: "chronos_hourglass",
    name: "Chronos Hourglass",
    description: "Increases Speed by 15% and restores 5 Energy at the start of each turn.",
    statBonuses: { spdMultiplier: 1.15 },
    onTurnStart({ unit, engine }) {
      const gained = Math.min(unit.maxEnergy - unit.currentEnergy, 5);
      if (gained > 0) {
        unit.currentEnergy += gained;
        engine.log(`${unit.name}'s Chronos Hourglass restores ${gained} Energy.`, "info");
      }
    },
  },
  {
    id: "vampiric_chalice",
    name: "Vampiric Chalice",
    description: "Heals the wearer for 15% of damage dealt after attacking.",
    onAfterDealDamage({ attacker, damageDealt, engine }) {
      if (damageDealt > 0 && attacker.currentHp > 0) {
        const heal = Math.max(1, Math.floor(damageDealt * 0.15));
        const actual = Math.min(attacker.effectiveMaxHp - attacker.currentHp, heal);
        if (actual > 0) {
          attacker.currentHp += actual;
          engine.log(`${attacker.name}'s Vampiric Chalice siphons ${actual} HP!`, "heal");
        }
      }
    },
  },
  {
    id: "aegis_core",
    name: "Aegis Core",
    description: "Increases Defense by 10 and applies [Increase DEF] for 2 turns at battle start.",
    statBonuses: { def: 10 },
    onBattleStart({ unit, engine }) {
      engine.statusManager.applyStatus(unit, unit, "def_up", { duration: 2 });
    },
  },
  {
    id: "executioner_lens",
    name: "Executioner's Lens",
    description: "Increases Critical Damage by 25% and Accuracy by 15%.",
    statBonuses: { critDmg: 25, accuracyBonus: 15 },
  },
];

export function registerAllItems() {
  ITEM_LIST.forEach((item) => Registry.registerItem(item));
}
