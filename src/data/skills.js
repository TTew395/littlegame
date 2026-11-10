/**
 * Skill / Move Definitions Registry
 *
 * Includes:
 * 1. Universal Stance Actions (`wait`, `rest`)
 * 2. Karnage the Anarch's Base Form & Alternate Form moves
 * 3. Antikhonor, Broken God's moves (including Soul Spear summoning, War Armor DEF ignore, Destroyed HP scaling)
 * 4. Moves for additional party heroes so 5v1 Raid Boss battles and PvP squad battles work out of the box!
 */

import { Registry } from "../engine/Registry.js";

export const SKILL_LIST = [
  // ==========================================================
  // UNIVERSAL MOVES (Available to all characters every turn)
  // ==========================================================
  {
    id: "wait",
    name: "Wait",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 0,
    accuracy: null,
    targetType: "self",
    isUniversal: true,
    description:
      "Regain a small amount of energy (1/5 of your total), but keep your guard up (full defense).",
    execute({ attacker, engine }) {
      const gained = Math.floor(attacker.maxEnergy / 5);
      attacker.currentEnergy = Math.min(attacker.maxEnergy, attacker.currentEnergy + gained);
      attacker.stance = "wait";
      engine.log(
        `🛡️ ${attacker.name} waits cautiously, keeping full guard up and regaining ${gained} Energy.`,
        "info"
      );
    },
  },
  {
    id: "rest",
    name: "Rest",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 0,
    accuracy: null,
    targetType: "self",
    isUniversal: true,
    description:
      "Regain a large amount of energy (1/3 of your total), but let your guard down (halved defense until your next turn).",
    execute({ attacker, engine }) {
      const gained = Math.floor(attacker.maxEnergy / 3);
      attacker.currentEnergy = Math.min(attacker.maxEnergy, attacker.currentEnergy + gained);
      attacker.stance = "rest";
      engine.log(
        `💤 ${attacker.name} rests deeply, regaining ${gained} Energy (Defense halved until next turn)!`,
        "status"
      );
    },
  },

  // ==========================================================
  // KARNAGE THE ANARCH — BASE FORM MOVES
  // ==========================================================
  {
    id: "sufferslash",
    name: "Sufferslash",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 2,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK + 0.1 x SPD (x2 hits)",
    description: "Attacks one enemy 2 times.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk + 0.1 * stats.spd;
    },
  },
  {
    id: "anarchic_realm",
    name: "Anarchic Realm",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 90,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "4 x ATK + 0.1 x SPD (75% HP Swap before hit)",
    description:
      "Attacks 1 enemy. Before attacking, swaps HP with the target (75% chance).",
    onBeforeAttack({ attacker, target, engine }) {
      if (engine.rng() <= 0.75) {
        if (engine.hasAbilityFlag(target, "immuneToHpSwap")) {
          // Almighty Immunity boss cap: cannot exceed 10% of boss's MAX HP
          const capDmg = Math.floor(target.effectiveMaxHp * 0.1);
          engine.log(
            `⚡ Anarchic Realm attempts HP Swap, but ${target.name}'s Almighty Immunity caps max-HP effects to ${capDmg}!`,
            "special"
          );
          engine.dealTrueDamage(target, capDmg, "Anarchic Realm (Capped Distortion)");
        } else {
          const tempHp = attacker.currentHp;
          attacker.currentHp = Math.min(attacker.effectiveMaxHp, target.currentHp);
          target.currentHp = Math.min(target.effectiveMaxHp, tempHp);
          engine.log(
            `🌀 Anarchic Realm warps reality! ${attacker.name} (${attacker.currentHp} HP) swapped HP with ${target.name} (${target.currentHp} HP)!`,
            "special"
          );
        }
      } else {
        engine.log(`🌀 Anarchic Realm's HP Swap missed (75% roll)!`, "info");
      }
    },
    computeRawHit({ stats }) {
      return 4.0 * stats.atk + 0.1 * stats.spd;
    },
  },
  {
    id: "trinity_of_pain",
    name: "Trinity of Pain",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 3,
    energyCost: 80,
    accuracy: 60,
    targetType: "single_enemy",
    formulaText: "1.5 x ATK + 0.1 x SPD (x3 hits)",
    description:
      "Attacks 1 enemy 3 times. Hit 1 places [Block Passive Skills] (2T). Hit 2 places [Seal] (2T). Hit 3 places [Deathbrand] (2T). If target's SPD is lower than Karnage's, these debuffs are protected.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk + 0.1 * stats.spd;
    },
    onEachHit({ attacker, target, hitIndex, engine }) {
      const atkSpd = engine.getEffectiveStats(attacker).spd;
      const tgtSpd = engine.getEffectiveStats(target).spd;
      const isProtected = atkSpd > tgtSpd;

      const debuffByHit = ["block_passive_skills", "seal", "deathbrand"];
      const statusId = debuffByHit[hitIndex];
      if (statusId && target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, statusId, {
          duration: 2,
          isProtected,
        });
      }
    },
  },
  {
    id: "metamorph_to_alt",
    name: "Metamorph",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 0,
    cooldown: 4,
    accuracy: null,
    targetType: "self",
    description:
      "Transforms this character into their Alternate Form. Then grants an Extra Turn.",
    execute({ attacker, engine }) {
      attacker.form = "alternate";
      engine.log(
        `🔥 ${attacker.name} unleashes METAMORPH -> Transformed into Alternate Form and granted an Extra Turn!`,
        "special"
      );
      engine.grantExtraTurn(attacker);
    },
  },

  // ==========================================================
  // KARNAGE THE ANARCH — ALTERNATE FORM MOVES
  // ==========================================================
  {
    id: "hellfire",
    name: "Hellfire",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 2,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK + 0.1 x SPD (x2 hits)",
    description: "Attacks one enemy 2 times.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk + 0.1 * stats.spd;
    },
  },
  {
    id: "stars_of_destruction",
    name: "Stars of Destruction",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 90,
    accuracy: 90,
    targetType: "all_enemies",
    formulaText: "2 x ATK + 0.1 x SPD (AoE)",
    description: "Attacks all enemies.",
    computeRawHit({ stats }) {
      return 2.0 * stats.atk + 0.1 * stats.spd;
    },
  },
  {
    id: "reality_reversal",
    name: "Reality Reversal",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 120,
    accuracy: 60,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK + 0.1 x SPD (AoE + Debuff Scaling)",
    description:
      "Attacks all enemies. If target has >=1 debuff, places an extra hit. If >=2 debuffs, ignores 30% DEF. If >=3 debuffs, places [Block Revive] if killed.",
    getDynamicHitCount({ target, engine }) {
      const debuffCount = engine.statusManager.countCategory(target, "debuff");
      return debuffCount >= 1 ? 2 : 1;
    },
    getIgnoreDefPct({ target, engine }) {
      const debuffCount = engine.statusManager.countCategory(target, "debuff");
      return debuffCount >= 2 ? 0.3 : 0;
    },
    computeRawHit({ stats }) {
      return 1.5 * stats.atk + 0.1 * stats.spd;
    },
    onTargetKilled({ target, engine }) {
      const debuffCount = engine.statusManager.countCategory(target, "debuff");
      if (debuffCount >= 3) {
        target.blockRevive = true;
        engine.log(
          `⚰️ ${target.name} was slain under 3+ debuffs — [Block Revive] inflicted!`,
          "crit"
        );
      }
    },
  },
  {
    id: "metamorph_to_base",
    name: "Metamorph",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 0,
    cooldown: 4,
    accuracy: null,
    targetType: "self",
    description:
      "Transforms this character into their Base Form. Then grants an Extra Turn.",
    execute({ attacker, engine }) {
      attacker.form = "base";
      engine.log(
        `⚡ ${attacker.name} casts METAMORPH -> Returned to Base Form and granted an Extra Turn!`,
        "special"
      );
      engine.grantExtraTurn(attacker);
    },
  },

  // ==========================================================
  // ANTIKHONOR, BROKEN GOD — BOSS MOVES
  // ==========================================================
  {
    id: "lance_of_light",
    name: "Lance of Light",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK",
    description: "Attacks one enemy with a piercing lance of deathly light.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "pyre_of_high_graves",
    name: "Pyre of High Graves",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 3,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (x3 hits, AoE)",
    description:
      "Attacks all enemies three times. Each hit ignores 4% of all targets' DEF for each War Armor stack on Antikhonor.",
    getIgnoreDefPct({ attacker, engine }) {
      const warArmorStacks = engine.statusManager.getStacks(attacker, "war_armor");
      return Math.min(1.0, warArmorStacks * 0.04);
    },
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
  },
  {
    id: "glory_to_all_honorable_dead",
    name: "Glory to All Honorable Dead",
    element: "Death",
    category: "Physical",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "all_enemies",
    formulaText: "Summons Linked Soul Spears + 12 War Armor + Glory",
    description:
      "Requires 3 other skills used first. For each enemy on field, summons a tied Soul Spear (200% of target MAX HP; takes +100% dmg from tied hero; destroys 1% MAX HP per 2% Spear HP; deals 5% MAX HP to Antikhonor when destroyed). Sets War Armor to 12 and applies 1 Glory stack to all characters. Forces 'All Realms Leveled, Legions to Dust' next turn.",
    canUse({ attacker }) {
      if (attacker.skillsUsedCount < 3) {
        return {
          allowed: false,
          reason: `Requires 3 skills used first (${attacker.skillsUsedCount}/3 used).`,
        };
      }
      return { allowed: true };
    },
    execute({ attacker, engine }) {
      // 1. Increase War Armor stacks to 12
      engine.statusManager.setStatusStacks(attacker, "war_armor", 12, {
        isProtected: true,
      });

      // 2. Apply 1 stack of Glory onto all living non-summon characters
      engine.getLivingUnits().forEach((u) => {
        if (!u.isSummon) {
          engine.statusManager.applyStatus(attacker, u, "glory", {
            stacks: 1,
            isProtected: true,
          });
        }
      });

      // 3. For each enemy character on field, summon a tied Soul Spear
      const enemies = engine.getLivingEnemiesOf(attacker).filter((e) => !e.isSummon);
      enemies.forEach((enemy) => {
        engine.summonSoulSpear(attacker, enemy);
      });

      // 4. Recalculate Destroyed HP immediately
      engine.recalculateSoulSpearDestruction();

      // 5. Force "All Realms Leveled, Legions to Dust" on next turn
      attacker.forcedNextSkillId = "all_realms_leveled";

      engine.log(
        `⚔️ ${attacker.name} invokes GLORY TO ALL HONORABLE DEAD! Summoned ${enemies.length} Soul Spear(s), raised War Armor to 12, and bestowed [Glory] upon the battlefield!`,
        "special"
      );
    },
  },
  {
    id: "all_realms_leveled",
    name: "All Realms Leveled, Legions to Dust",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 80,
    accuracy: 100,
    undodgeable: true,
    bypassMitigation: true, // Damage cannot be decreased by enemy buffs or passive effects
    targetType: "all_enemies",
    formulaText: "2 x ATK (+5% per 1% Missing HP, +10% per 1% Destroyed HP, Ignores 100% DEF)",
    description:
      "Attacks all enemies (Undodgeable). Damage increases by 5% for each 1% HP missing, and by 10% for each 1% HP currently destroyed. Ignores 100% DEF and bypasses enemy buffs/passives.",
    getIgnoreDefPct() {
      return 1.0; // Ignores 100% of target DEF
    },
    computeRawHit({ stats, target }) {
      const baseDmg = 2.0 * stats.atk;
      const missingHpPct = Math.max(
        0,
        ((target.effectiveMaxHp - target.currentHp) / target.baseMaxHp) * 100
      );
      const destroyedHpPct = target.destroyedHpPct || 0;
      const multiplier = 1 + 0.05 * missingHpPct + 0.1 * destroyedHpPct;
      return baseDmg * multiplier;
    },
  },

  // ==========================================================
  // ADDITIONAL EXPANDABLE HERO SKILLS (For 5-Hero Squad Support)
  // ==========================================================
  {
    id: "chrono_burst",
    name: "Chrono Burst",
    element: "Tek",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 20,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1.2 x ATK + 0.15 x SPD (x2 hits)",
    description: "Fires 2 rapid tachyon bolts at one enemy and places [Decrease SPD] for 2 turns.",
    computeRawHit({ stats }) {
      return 1.2 * stats.atk + 0.15 * stats.spd;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "spd_down", { duration: 2 });
      }
    },
  },
  {
    id: "time_dilation_field",
    name: "Time Dilation Field",
    element: "Tek",
    category: "Status",
    stab: false,
    energyCost: 60,
    cooldown: 3,
    accuracy: null,
    targetType: "all_allies",
    formulaText: "Team +30% SPD Buff (2T) + +20% Turn Meter",
    description:
      "Places [Increase SPD] and [Increase ATK] on all allies for 2 turns and boosts ally Turn Meters by 20%.",
    execute({ attacker, engine }) {
      const allies = engine.getLivingAlliesOf(attacker);
      allies.forEach((ally) => {
        engine.statusManager.applyStatus(attacker, ally, "spd_up", { duration: 2 });
        engine.statusManager.applyStatus(attacker, ally, "atk_up", { duration: 2 });
        engine.modifyTurnMeter(ally, 0.2);
      });
      engine.log(
        `⏳ ${attacker.name} deploys Time Dilation Field: all allies gain [Increase SPD], [Increase ATK], and +20% Turn Meter!`,
        "special"
      );
    },
  },
  {
    id: "spear_breaker_volley",
    name: "Quantum Piercer",
    element: "Tek",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 45,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "3.2 x ATK (Ignores 50% DEF)",
    description: "Fires a concentrated beam at one enemy, ignoring 50% of their Defense.",
    getIgnoreDefPct() {
      return 0.5;
    },
    computeRawHit({ stats }) {
      return 3.2 * stats.atk;
    },
  },
  {
    id: "celestial_aegis",
    name: "Celestial Aegis",
    element: "Light",
    category: "Status",
    stab: false,
    energyCost: 50,
    cooldown: 3,
    accuracy: null,
    targetType: "all_allies",
    formulaText: "Heal 25% MAX HP + Cleanse + [Increase DEF]",
    description:
      "Cleanses 1 non-protected debuff from all allies, heals them by 25% of their Max HP, and places [Increase DEF] for 2 turns.",
    execute({ attacker, engine }) {
      const allies = engine.getLivingAlliesOf(attacker);
      allies.forEach((ally) => {
        engine.statusManager.cleanseOneDebuff(ally);
        const healAmt = Math.floor(ally.effectiveMaxHp * 0.25);
        ally.currentHp = Math.min(ally.effectiveMaxHp, ally.currentHp + healAmt);
        engine.statusManager.applyStatus(attacker, ally, "def_up", { duration: 2 });
      });
      engine.log(
        `✨ ${attacker.name} invokes Celestial Aegis: healed all allies by 25%, cleansed 1 debuff, and applied [Increase DEF]!`,
        "heal"
      );
    },
  },
  {
    id: "sunfire_smite",
    name: "Sunfire Smite",
    element: "Light",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 20,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1.8 x ATK + [Decrease DEF]",
    description: "Strikes one enemy with solar light and places [Decrease DEF] for 2 turns.",
    computeRawHit({ stats }) {
      return 1.8 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      }
    },
  },
  {
    id: "draconic_cataclysm",
    name: "Draconic Cataclysm",
    element: "Dragon",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 70,
    accuracy: 95,
    targetType: "all_enemies",
    formulaText: "1.8 x ATK (x2 hits AoE) + [HP Burn]",
    description: "Unleashes twin waves of dragonfire on all enemies and places [HP Burn] for 2 turns.",
    computeRawHit({ stats }) {
      return 1.8 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "burn", { duration: 2 });
      }
    },
  },
  {
    id: "crimson_rend",
    name: "Crimson Rend",
    element: "Chaos",
    category: "Melee",
    stab: true,
    hits: 3,
    energyCost: 25,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1.1 x ATK (x3 hits) + [Bleed]",
    description: "Slashes an enemy 3 times, applying a stack of [Bleed] on each hit.",
    computeRawHit({ stats }) {
      return 1.1 * stats.atk;
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "bleed", {
          duration: 2,
          stacks: 1,
        });
      }
    },
  },
];

export function registerAllSkills() {
  SKILL_LIST.forEach((sk) => Registry.registerSkill(sk));
}
