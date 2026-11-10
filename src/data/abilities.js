/**
 * Passive Abilities Registry
 * Supports multiple abilities per character (e.g. Antikhonor has Master of Legions + Almighty Immunity).
 * Automatically respects [Block Passive Skills] unless an ability is marked `cannotBeBlocked: true`
 * (like Almighty Immunity).
 */

import { Registry } from "../engine/Registry.js";

export const ABILITY_LIST = [
  // ==========================================
  // KARNAGE THE ANARCH
  // ==========================================
  {
    id: "avatar_of_anarchy",
    name: "Avatar of Anarchy",
    description:
      "Increases this character's C. DMG by 1 for every 3 points of SPD they have.",
    modifyStats({ unit, stats }) {
      const bonusCritDmg = Math.floor(stats.spd / 3);
      stats.critDmg += bonusCritDmg;
    },
  },

  // ==========================================
  // ANTIKHONOR, BROKEN GOD
  // ==========================================
  {
    id: "master_of_legions",
    name: "Master of Legions",
    description:
      "When Antikhonor joins the battle and at the start of each turn, applies 8 stacks of War Armor to them (each stack decreases damage taken by 4%). Whenever an enemy attacks Antikhonor, reduces War Armor stacks by 1 (once per skill). When War Armor is fully depleted, deals damage equal to 10% MAX HP and delays action by 20%. When attacked while not under War Armor, takes 1% MAX HP True Damage (once per skill). Resets War Armor to 8 when Antikhonor takes a turn.",
    onBattleStart({ unit, engine }) {
      engine.statusManager.setStatusStacks(unit, "war_armor", 8, { isProtected: true });
      engine.log(
        `[${unit.name}] Master of Legions activates: 8 stacks of War Armor applied!`,
        "special"
      );
    },
    onTurnStart({ unit, engine }) {
      // Whenever Antikhonor takes a turn, resets the War Armor stacks to 8
      engine.statusManager.setStatusStacks(unit, "war_armor", 8, { isProtected: true });
      // Glory stacks disappear once Antikhonor takes a turn
      engine.clearGlobalStatus("glory");
      engine.log(
        `[${unit.name}] Master of Legions resets War Armor stacks to 8 (all Glory stacks cleared).`,
        "special"
      );
    },
    // Once-per-skill hook after an enemy attacks Antikhonor with a skill
    onAfterSkillAttacked({ attacker, defender, engine }) {
      if (defender.currentHp <= 0) return;

      const currentArmor = engine.statusManager.getStacks(defender, "war_armor");

      // Check Glory interaction:
      // "Whenever a character attacks with a skill, increases their Glory stacks by one,
      // and additionally reduces Antikhonor's War Armor stacks by the number of Glory stacks that the attacker has."
      let gloryReduction = 0;
      if (engine.statusManager.hasStatus(attacker, "glory")) {
        engine.statusManager.addStacks(attacker, "glory", 1);
        gloryReduction = engine.statusManager.getStacks(attacker, "glory");
        engine.log(
          `${attacker.name}'s Glory rises to ${gloryReduction} stack(s)!`,
          "status"
        );
      }

      if (currentArmor > 0) {
        const totalStackReduction = 1 + gloryReduction;
        const newStacks = Math.max(0, currentArmor - totalStackReduction);
        engine.statusManager.setStatusStacks(defender, "war_armor", newStacks, {
          isProtected: true,
        });
        engine.log(
          `${defender.name}'s War Armor loses ${currentArmor - newStacks} stack(s) -> ${newStacks} remaining.`,
          "status"
        );

        // When the War Armor stacks are fully depleted:
        if (newStacks === 0) {
          const shatterDmg = Math.max(1, Math.floor(defender.effectiveMaxHp * 0.1));
          engine.dealTrueDamage(defender, shatterDmg, "War Armor Depletion (10% MAX HP)");
          engine.modifyTurnMeter(defender, -0.2, { bypassImmunity: true }); // Own ability penalty
          engine.clearGlobalStatus("glory");
          engine.log(
            `💥 ${defender.name}'s War Armor SHATTERED! Took ${shatterDmg} damage, action delayed by 20%, and all Glory stacks vanished!`,
            "crit"
          );
        }
      } else {
        // Attacked while NOT under War Armor stacks: deals True Damage equal to 1% of their MAX HP (once per skill)
        const bonusTrueDmg = Math.max(1, Math.floor(defender.effectiveMaxHp * 0.01));
        engine.dealTrueDamage(defender, bonusTrueDmg, "Exposed Core (1% MAX HP True DMG)");
      }
    },
  },
  {
    id: "almighty_immunity",
    name: "Almighty Immunity",
    cannotBeBlocked: true,
    description:
      "Skills that deal damage based on ENEMY MAX HP cannot exceed 10% of the boss's MAX HP. Immune to [Stun], [Sleep], [Freeze], [Frozen], [Block Passive Skills] and [Heart-Melt] debuffs. Also immune to Turn skipping effects, Turn Meter reduction effects and [Block Passive Skills] debuffs.",
    immunities: [
      "stun",
      "sleep",
      "freeze",
      "frozen",
      "block_passive_skills",
      "heart_melt",
    ],
    flags: {
      capEnemyMaxHpScalingPct: 0.1,
      immuneToTurnMeterReduction: true,
      immuneToTurnSkip: true,
      immuneToHpSwap: true,
    },
  },

  // ==========================================
  // ADDITIONAL EXPANDABLE HERO PASSIVES
  // ==========================================
  {
    id: "temporal_overdrive",
    name: "Temporal Overdrive",
    description:
      "At the end of each turn, increases this character's Speed by 5% (stacking Battle Focus) and restores 8 Energy.",
    onTurnEnd({ unit, engine }) {
      engine.statusManager.applyStatus(unit, unit, "poise_focus", { stacks: 1 });
      unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 8);
    },
  },
  {
    id: "astral_ward",
    name: "Astral Ward",
    description:
      "Decreases damage taken by all allies by 10% while this character is alive.",
    modifyIncomingDamage({ defender, damage }) {
      return damage * 0.9;
    },
  },
  {
    id: "dragon_blood_fury",
    name: "Dragonblood Fury",
    description:
      "Deals 15% more damage against targets with more than 50% HP, or ignores 20% DEF against targets below 50% HP.",
  },
];

export function registerAllAbilities() {
  ABILITY_LIST.forEach((ab) => Registry.registerAbility(ab));
}
