/**
 * Skill / Move Definitions Registry
 *
 * Declarative Sequencing & Requirement Fields Supported by the Engine:
 * - `minOtherSkillsUsed`: number (e.g. 3 — requires 3 other non-universal skills used first)
 * - `requiresPreviousSkill`: string skillId (e.g. "glory_to_all_honorable_dead" — can only be cast after casting that prerequisite skill)
 * - `forcesNextSkill`: string skillId (e.g. "all_realms_leveled" — forces the unit to use that skill next; if lacking Energy, AI/Player must Wait/Rest until able)
 * - `upgradesSkill`: { from: "heart_of_thorns", to: "stars_shall_weep" } (declaratively swaps a skill in the unit's active move list)
 * - `cannotCastManually`: boolean (only castable when queued by an ability/counter or `forcesNextSkill`)
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
    formulaText: "Regain 1/5 Max Energy • Full Defense",
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
    formulaText: "Regain 1/3 Max Energy • Halved Defense",
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
  // 1. KARNAGE THE ANARCH — BASE & ALTERNATE FORM MOVES
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
          const capDmg = Math.max(1, Math.floor(target.effectiveMaxHp * 0.1));
          engine.log(
            `⚡ Anarchic Realm attempts HP Swap, but ${target.name}'s immunity caps max-HP effects to ${capDmg}!`,
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
    formulaText: "Transform to Alternate Form • Grants Extra Turn",
    description:
      "Transforms this character into their Alternate Form. Then grants an Extra Turn.",
    execute({ attacker, engine }) {
      engine.transformUnitForm(attacker, "alternate");
      engine.log(
        `🔥 ${attacker.name} unleashes METAMORPH -> Transformed into Alternate Form and granted an Extra Turn!`,
        "special"
      );
      engine.grantExtraTurn(attacker);
    },
  },
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
    formulaText: "Transform to Base Form • Grants Extra Turn",
    description:
      "Transforms this character into their Base Form. Then grants an Extra Turn.",
    execute({ attacker, engine }) {
      engine.transformUnitForm(attacker, "base");
      engine.log(
        `⚡ ${attacker.name} casts METAMORPH -> Returned to Base Form and granted an Extra Turn!`,
        "special"
      );
      engine.grantExtraTurn(attacker);
    },
  },

  // ==========================================================
  // 2. ANTIKHONOR, BROKEN GOD — BOSS MOVES
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
    description: "Attacks one enemy.",
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
    // Declarative sequence rules:
    minOtherSkillsUsed: 3,
    forcesNextSkill: "all_realms_leveled",
    formulaText: "Summons Linked Soul Spears + 12 War Armor + Glory",
    description:
      "Cannot be used unless 3 other skills have been used first. Summons a tied Soul Spear for each enemy (200% MAX HP; takes +100% dmg from tied hero; destroys 1% MAX HP per 2% Spear HP; deals 5% MAX HP to Antikhonor when destroyed). Sets War Armor to 12 and applies 1 Glory stack to all characters. Forces 'All Realms Leveled, Legions to Dust' next.",
    execute({ attacker, engine }) {
      engine.statusManager.setStatusStacks(attacker, "war_armor", 12, {
        isProtected: true,
      });

      engine.getLivingUnits().forEach((u) => {
        if (!u.isSummon) {
          engine.statusManager.applyStatus(attacker, u, "glory", {
            stacks: 1,
            isProtected: true,
          });
        }
      });

      const enemies = engine.getLivingEnemiesOf(attacker).filter((e) => !e.isSummon);
      enemies.forEach((enemy) => {
        engine.summonSoulSpear(attacker, enemy);
      });

      engine.recalculateSoulSpearDestruction();

      engine.log(
        `⚔️ ${attacker.name} invokes GLORY TO ALL HONORABLE DEAD! Summoned ${enemies.length} Soul Spear(s), raised War Armor to 12, and bestowed [Glory]!`,
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
    bypassMitigation: true,
    targetType: "all_enemies",
    // Declarative sequence rule: must be preceded by Glory to All Honorable Dead
    requiresPreviousSkill: "glory_to_all_honorable_dead",
    formulaText: "2 x ATK (+5% per 1% Missing HP, +10% per 1% Destroyed HP, Ignores 100% DEF)",
    description:
      "Must be used after Glory to All Honorable Dead. Attacks all enemies (Undodgeable). Damage increases by 5% for each 1% HP missing, and by 10% for each 1% HP currently destroyed. Ignores 100% DEF and bypasses enemy buffs/passives.",
    getIgnoreDefPct() {
      return 1.0;
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
  // 3. OUROBOROS, THE SWARM & SWARM SPAWN MOVES
  // ==========================================================
  {
    id: "swarm_strike_boss",
    name: "Swarm Strike",
    element: "Bug",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK (20% Stun 1T)",
    description: "Attacks one enemy. Has a 20% chance of placing a [Stun] debuff for 1 turn.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && engine.rng() <= 0.2) {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
    },
  },
  {
    id: "swarm_ensemble_boss",
    name: "Swarm Ensemble",
    element: "Bug",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "Summon 2 Spawns + AoE 1.2x ATK + Lowest HP 1.5x ATK (50% Ignore DEF)",
    description:
      "Summons two Swarm Spawns and attacks all enemies. Then, attacks the enemy with the lowest HP, ignoring 50% of their DEF.",
    onBeforeSkill({ attacker, engine }) {
      for (let i = 0; i < 2; i++) {
        engine.spawnSwarmMinion(attacker.teamId);
      }
    },
    computeRawHit({ stats }) {
      return 1.2 * stats.atk;
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      if (enemies.length > 0) {
        const lowest = [...enemies].sort((a, b) => a.currentHp - b.currentHp)[0];
        engine.log(
          `🪲 [${attacker.name}] Swarm Ensemble focuses ${lowest.name} (lowest HP, ignoring 50% DEF)!`,
          "special"
        );
        engine.executeBonusHit({
          attacker,
          target: lowest,
          element: "Bug",
          stab: true,
          rawMultiplier: 1.5,
          ignoreDefPct: 0.5,
          label: "Swarm Ensemble Finisher",
        });
      }
    },
  },
  {
    id: "larval_evolution",
    name: "Larval Evolution",
    element: "Bug",
    category: "Status",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "self",
    // Declarative sequence rule:
    forcesNextSkill: "fallen_stars_eulogy",
    formulaText: "All Swarm Spawns Instant Turn -> Forces Fallen Star's Eulogy",
    description:
      "Grants all Swarm Spawns an Instant Turn. Ouroboros's next turn will unleash Fallen Star's Eulogy.",
    execute({ attacker, engine }) {
      const spawns = engine
        .getLivingAlliesOf(attacker)
        .filter((a) => a.templateId === "swarm_spawn");
      spawns.forEach((sp) => engine.grantExtraTurn(sp));
      engine.log(
        `🪲 [${attacker.name}] casts LARVAL EVOLUTION! ${spawns.length} Swarm Spawn(s) granted an Instant Turn; Fallen Star's Eulogy queued next!`,
        "special"
      );
    },
  },
  {
    id: "fallen_stars_eulogy",
    name: "Fallen Star's Eulogy",
    element: "Bug",
    category: "Physical",
    stab: true,
    hits: 3,
    energyCost: 0,
    accuracy: 100,
    undodgeable: true,
    targetType: "all_enemies",
    // Declarative sequence rule: must be preceded by Larval Evolution
    requiresPreviousSkill: "larval_evolution",
    formulaText: "1.4 x ATK x 3 (+25% DMG per alive Spawn) + Stun + All Spawns Swarm Ensemble",
    description:
      "Must be preceded by Larval Evolution. Attacks all enemies 3 times (+25% damage per alive Swarm Spawn). Places [Stun] on all enemies for 1 turn. Then teams up with all Swarm Spawns to use Swarm Ensemble (0 Energy).",
    computeRawHit({ attacker, stats, engine }) {
      const aliveSpawns = engine
        .getLivingAlliesOf(attacker)
        .filter((a) => a.templateId === "swarm_spawn").length;
      return 1.4 * stats.atk * (1 + 0.25 * aliveSpawns);
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
    },
    onAfterSkill({ attacker, engine }) {
      const spawns = engine
        .getLivingAlliesOf(attacker)
        .filter((a) => a.templateId === "swarm_spawn");
      if (spawns.length > 0) {
        engine.log(
          `🪲 [${attacker.name}] teams up with ${spawns.length} Swarm Spawn(s) to unleash Swarm Ensemble!`,
          "special"
        );
        spawns.forEach((sp) => {
          engine.executeCounterSkill(sp, "swarm_ensemble_minion");
        });
      }
    },
  },
  // Swarm Spawn Minion Moves
  {
    id: "swarm_strike_minion",
    name: "Swarm Strike",
    element: "Bug",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK",
    description: "Attacks one enemy.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "swarm_ensemble_minion",
    name: "Swarm Ensemble",
    element: "Bug",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 40,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (AoE)",
    description: "Attacks all enemies.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
  },

  // ==========================================================
  // 4. CRYPT-KEEPER NOVOK — BOSS MOVES
  // ==========================================================
  {
    id: "tombfire",
    name: "Tombfire",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK (2x DMG if any ally is dead)",
    description: "Attacks one enemy. If any allies are dead, this attack deals double damage.",
    computeRawHit({ attacker, stats, engine }) {
      const anyDeadAlly = engine.units.some(
        (u) => u.teamId === attacker.teamId && u.currentHp <= 0
      );
      return stats.atk * (anyDeadAlly ? 2.0 : 1.0);
    },
  },
  {
    id: "osteomancy",
    name: "Osteomancy",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 2,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (x2 hits, Hit 1: -60% DEF, Hit 2: -50% ATK)",
    description:
      "Attacks all enemies two times. Hit 1 places a 60% [Decrease DEF] debuff for 2 turns. Hit 2 places a 50% [Decrease ATK] debuff for 2 turns.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
    onEachHit({ attacker, target, hitIndex, engine }) {
      if (target.currentHp <= 0) return;
      if (hitIndex === 0) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      } else if (hitIndex === 1) {
        engine.statusManager.applyStatus(attacker, target, "atk_down", { duration: 2 });
      }
    },
  },
  {
    id: "fallens_sheath",
    name: "Fallen's Sheath",
    element: "Death",
    category: "Status",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "all_allies",
    formulaText: "All Allies Shield (300% of Novok's ATK) for 2T",
    description:
      "Places a [Shield] buff on all allies for 2 turns. The value of the [Shield] is equal to 300% of Novok's ATK.",
    execute({ attacker, engine }) {
      const atkVal = engine.getEffectiveStats(attacker).atk;
      const shieldVal = Math.round(atkVal * 3.0);
      const allies = engine.getLivingAlliesOf(attacker);
      allies.forEach((ally) => {
        ally.shieldHp = (ally.shieldHp || 0) + shieldVal;
        engine.statusManager.applyStatus(attacker, ally, "shield", { duration: 2 });
      });
      engine.log(
        `💠 [${attacker.name}] casts Fallen's Sheath: granted a ${shieldVal} HP [Shield] to all allies for 2 turns!`,
        "heal"
      );
    },
  },
  {
    id: "walker_among_graves",
    name: "Walker Among Graves",
    element: "Death",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 80,
    accuracy: 100,
    undodgeable: true,
    targetType: "single_enemy",
    formulaText: "Team-Up Attack: 1.5 x ATK + 0.1 x Shield Value",
    description:
      "Teams up with all allies to attack one enemy (Undodgeable). Novok uses Tombfire and all allies use their default skill. Allies under a [Shield] buff deal bonus damage equal to 10% of their Shield value.",
    computeRawHit({ attacker, stats }) {
      const bonusShield = (attacker.shieldHp || 0) * 0.1;
      return 1.5 * stats.atk + bonusShield;
    },
    onAfterSkill({ attacker, targets, engine }) {
      const target = targets[0];
      if (!target || target.currentHp <= 0) return;
      const allies = engine
        .getLivingAlliesOf(attacker)
        .filter((a) => a.id !== attacker.id && !a.isActionlessTotem);
      allies.forEach((ally) => {
        if (target.currentHp <= 0) return;
        const allyAtk = engine.getEffectiveStats(ally).atk;
        const shieldBonus = (ally.shieldHp || 0) * 0.1;
        const dmg = Math.max(1, Math.round(allyAtk + shieldBonus));
        engine.dealTrueDamage(
          target,
          dmg,
          `${ally.name} Team-Up (+10% Shield Bonus)`
        );
      });
    },
  },

  // ==========================================================
  // 5. TERNAX HELLFIRE — BOSS MOVES
  // ==========================================================
  {
    id: "molten_slag",
    name: "Molten Slag",
    element: "Fire",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK (Prioritizes [Hex], 2x DMG vs [Hex])",
    description:
      "Attacks one enemy. Prioritizes targets under [Hex] debuffs and deals double damage against them.",
    getIgnoreDefPct({ target, engine }) {
      return engine.statusManager.hasStatus(target, "hex") ? 0.5 : 0;
    },
    computeRawHit({ target, stats, engine }) {
      const hasHex = engine.statusManager.hasStatus(target, "hex");
      return stats.atk * (hasHex ? 2.0 : 1.0);
    },
  },
  {
    id: "magma_pound",
    name: "Magma Pound",
    element: "Fire",
    category: "Physical",
    stab: true,
    hits: 2,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (x2 hits, Hit 1: [Burn] 2T, Hit 2: Unresistable [Hex] on lowest HP)",
    description:
      "Attacks all enemies two times. Hit 1 places a [Burn] debuff for 2 turns. Hit 2 places an unresistable, unblockable [Hex] debuff on the enemy with the lowest HP.",
    getIgnoreDefPct({ target, engine }) {
      return engine.statusManager.hasStatus(target, "hex") ? 0.5 : 0;
    },
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
    onEachHit({ attacker, target, hitIndex, engine }) {
      if (target.currentHp <= 0) return;
      if (hitIndex === 0) {
        engine.statusManager.applyStatus(attacker, target, "burn", { duration: 2 });
      }
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      if (enemies.length > 0) {
        const lowest = [...enemies].sort((a, b) => a.currentHp - b.currentHp)[0];
        engine.statusManager.applyStatus(attacker, lowest, "hex", {
          duration: 3,
          isProtected: true,
          bypassImmunity: true,
        });
      }
    },
  },
  {
    id: "overburn",
    name: "Overburn",
    element: "Fire",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 40,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.6 x ATK (+10% DMG per [Burn] on field) + Instant [Burn] Tick",
    description:
      "Attacks all enemies. Deals 10% more damage for each [Burn] debuff on all enemies, then instantly activates one tick of all [Burn] debuffs on all enemies.",
    getIgnoreDefPct({ target, engine }) {
      return engine.statusManager.hasStatus(target, "hex") ? 0.5 : 0;
    },
    computeRawHit({ attacker, stats, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      const totalBurns = enemies.filter((e) =>
        engine.statusManager.hasStatus(e, "burn")
      ).length;
      return 1.6 * stats.atk * (1 + 0.1 * totalBurns);
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      enemies.forEach((enemy) => {
        if (enemy.currentHp > 0 && engine.statusManager.hasStatus(enemy, "burn")) {
          engine.triggerBurnTick(enemy);
        }
      });
    },
  },
  {
    id: "hexreaper",
    name: "Hexreaper",
    element: "Fire",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 80,
    accuracy: 100,
    undodgeable: true,
    targetType: "single_enemy",
    formulaText: "4 x ATK (Ignores 100% DEF, Undodgeable; Kill -> Free Magma Pound)",
    description:
      "Attacks one enemy (prioritizes [Hex]). Ignores 100% of target DEF and cannot be evaded. If the target is killed, instantly activates Magma Pound for 0 Energy.",
    getIgnoreDefPct() {
      return 1.0;
    },
    computeRawHit({ stats }) {
      return 4.0 * stats.atk;
    },
    onTargetKilled({ attacker, engine }) {
      engine.log(
        `🔥 [${attacker.name}] Hexreaper slew its quarry -> Instantly triggers [Magma Pound]!`,
        "crit"
      );
      engine.executeCounterSkill(attacker, "magma_pound");
    },
  },

  // ==========================================================
  // 6. FIRST GENIUS, ZANDER — BASE FORM & EVOLUTION MOVES
  // ==========================================================
  {
    id: "computation_alpha_set",
    name: "Computation: α Set",
    element: "Time",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 0,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK (+15 Target Energy)",
    description: "Attacks one enemy and increases the target's Energy by 15.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onAfterHit({ target, engine }) {
      if (target.currentHp > 0) {
        target.currentEnergy = Math.min(target.maxEnergy, target.currentEnergy + 15);
        engine.log(`⚡ ${target.name}'s Energy increased by 15!`, "info");
      }
    },
  },
  {
    id: "permutation_gamma",
    name: "Permutation: γ",
    element: "Time",
    category: "Ranged",
    stab: true,
    hits: 3,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (x3 hits AoE)",
    description: "Attacks all enemies three times.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
  },
  {
    id: "extrapolation_beta_link",
    name: "Extrapolation: β Link",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "all_enemies",
    formulaText: "All Enemies Instant Turn + 0 Energy Cost (Non-Wait/Rest -> Massive Backlash)",
    description:
      "Grants all enemies an Instant Turn and reduces their energy costs to 0 for that turn. If any enemy uses any move besides Rest or Wait, deals massive damage to them.",
    execute({ attacker, engine }) {
      const enemies = engine
        .getLivingEnemiesOf(attacker)
        .filter((e) => !e.isActionlessTotem);
      enemies.forEach((enemy) => {
        engine.statusManager.applyStatus(attacker, enemy, "extrapolation_link", {
          duration: 1,
          isProtected: true,
          bypassImmunity: true,
        });
        engine.grantExtraTurn(enemy);
      });
      engine.log(
        `🧬 [${attacker.name}] casts EXTRAPOLATION: β LINK! All enemies granted an Instant Turn with 0 Energy cost — using any skill besides Wait/Rest triggers temporal annihilation!`,
        "special"
      );
    },
  },
  {
    id: "mode_evolution",
    name: "Mode: Evolution",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 0,
    accuracy: null,
    targetType: "self",
    cannotCastManually: true,
    formulaText: "Auto-Triggered at 600 Transmutation",
    description:
      "First Genius, Zander enters the Evolution state (SPD 150, DEF -50, ATK 20, Termination Counter = 8). This move cannot be cast manually.",
    execute({ attacker, engine }) {
      engine.enterZanderEvolution(attacker);
    },
  },
  // Zander Evolution State Moves
  {
    id: "collapse_delta",
    name: "Collapse: δ",
    element: "Time",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 0,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1 x ATK + (1 - TargetEnergy/MaxEnergy) x ATK True DMG",
    description:
      "Attacks all enemies. Deals bonus True Damage proportional to the amount of Energy missing from each target.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      const atkVal = engine.getEffectiveStats(attacker).atk;
      const missingEnergyRatio =
        target.maxEnergy > 0
          ? Math.max(0, 1 - target.currentEnergy / target.maxEnergy)
          : 0;
      const trueDmg = Math.max(1, Math.round(missingEnergyRatio * atkVal));
      engine.dealTrueDamage(target, trueDmg, "Collapse: δ (Missing Energy True DMG)");
    },
  },
  {
    id: "restructuring_phi",
    name: "Restructuring: φ",
    element: "Time",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "2 x ATK (x2 hits AoE) + Steals 50% Turn Meter",
    description:
      "Attacks all enemies two times and steals 50% of each target's Turn Meter.",
    computeRawHit({ stats }) {
      return 2.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      const stolenTm = Math.floor(target.turnMeter * 0.5);
      if (!engine.hasAbilityFlag(target, "immuneToTurnMeterReduction")) {
        target.turnMeter = Math.max(0, target.turnMeter - stolenTm);
        attacker.turnMeter += stolenTm;
        engine.log(
          `⏳ ${attacker.name} steals ${Math.round(stolenTm / 10)}% Turn Meter from ${target.name}!`,
          "status"
        );
      }
    },
  },
  {
    id: "continuation_gamma",
    name: "Continuation: Γ",
    element: "None",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 40,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.8 x ATK (AoE) + Unresistable [Debuff Spread]",
    description:
      "Attacks all enemies and applies an unresistable [Debuff Spread], copying all active debuffs across all enemies.",
    computeRawHit({ stats }) {
      return 1.8 * stats.atk;
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      const collectedDebuffs = [];
      enemies.forEach((e) => {
        e.statuses
          .filter((s) => s.category === "debuff")
          .forEach((s) => collectedDebuffs.push({ ...s }));
      });
      enemies.forEach((enemy) => {
        collectedDebuffs.forEach((deb) => {
          engine.statusManager.applyStatus(attacker, enemy, deb.id, {
            duration: deb.duration || 2,
            stacks: deb.stacks || 1,
            isProtected: deb.isProtected,
            bypassImmunity: true,
            silent: true,
          });
        });
      });
      if (collectedDebuffs.length > 0) {
        engine.log(
          `🌀 [${attacker.name}] Continuation: Γ spreads ${collectedDebuffs.length} debuff instance(s) across all enemies!`,
          "status"
        );
      }
    },
  },
  {
    id: "cyclicity_alpha_scepter",
    name: "Cyclicity: α Scepter",
    element: "None",
    category: "Ranged",
    stab: false,
    hits: 4,
    energyCost: 0,
    accuracy: 100,
    undodgeable: true,
    cannotCastManually: true,
    targetType: "all_enemies",
    formulaText: "1 x ATK x 4 (Reduced by 0.1% per 1 DMG taken in Evolution) -> Returns to Base Form",
    description:
      "Auto-triggered when Termination Counter reaches 0. Attacks all enemies 4 times (Hit 1: scales with missing Energy; Hit 2: scales with target MAX HP; Hit 3: scales with target DEF; Hit 4: True Damage). Reduced by 0.1% per 1 damage taken in Evolution state. Returns Zander to Base Form.",
    computeRawHit({ attacker, target, stats, targetStats }) {
      const dmgTaken = attacker.customCounters.evolutionDamageTaken || 0;
      const reductionMult = Math.max(0.05, 1 - dmgTaken * 0.001);
      const missingEnergyBonus =
        target.maxEnergy > 0 ? 1 + (1 - target.currentEnergy / target.maxEnergy) : 1;
      const hpBonus = Math.min(2.5, 1 + target.effectiveMaxHp / 400);
      const defBonus = 1 + (targetStats.def || 0) / 50;
      const avgFactor = (missingEnergyBonus + hpBonus + defBonus + 1.2) / 4;
      return stats.atk * avgFactor * reductionMult;
    },
    onAfterSkill({ attacker, engine }) {
      engine.exitZanderEvolution(attacker);
    },
  },

  // ==========================================================
  // 7. ALLEKHEIROS, ETERNAL GUARDIAN — BOSS MOVES
  // ==========================================================
  {
    id: "sweep_the_field",
    name: "Sweep the Field",
    element: "Space",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1 x ATK (AoE)",
    description: "Attacks all enemies.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "heart_of_thorns",
    name: "Heart of Thorns",
    element: "Space",
    category: "Ranged",
    stab: true,
    hits: 3,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1 x ATK (x3 hits, 80% chance 60% [Decrease DEF] 2T)",
    description:
      "Attacks all enemies three times. Each hit has an 80% chance of placing a 60% [Decrease DEF] debuff for 2 turns. (Enhances into Stars Shall Weep after Flectere si Nequeno).",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && engine.rng() <= 0.8) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      }
    },
  },
  {
    id: "stars_shall_weep",
    name: "Stars Shall Weep [Enhanced]",
    element: "Space",
    category: "Ranged",
    stab: true,
    hits: 3,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "2 x ATK (x3 hits, Lifesteal 18%, 50% Unblockable [Stun] 1T)",
    description:
      "Enhanced Heart of Thorns: Attacks all enemies 3 times for double damage, heals Allekheiros by 18% of damage dealt, and has a 50% chance of placing an unblockable [Stun] debuff for 1 turn.",
    computeRawHit({ stats }) {
      return 2.0 * stats.atk;
    },
    onAfterHit({ attacker, target, totalDamageToTarget, engine }) {
      if (totalDamageToTarget > 0 && attacker.currentHp > 0) {
        const heal = Math.max(1, Math.floor(totalDamageToTarget * 0.18));
        attacker.currentHp = Math.min(attacker.effectiveMaxHp, attacker.currentHp + heal);
        engine.log(`🌌 [${attacker.name}] Stars Shall Weep siphons ${heal} HP!`, "heal");
      }
      if (target.currentHp > 0 && engine.rng() <= 0.5) {
        engine.statusManager.applyStatus(attacker, target, "stun", {
          duration: 1,
          bypassImmunity: true,
        });
      }
    },
  },
  {
    id: "ten_thousand_years_silent",
    name: "Ten Thousand Years Silent",
    element: "Space",
    category: "Status",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "self",
    // Declarative sequence rule:
    forcesNextSkill: "flectere_si_nequeno",
    formulaText: "Enter Charging State (ATK -50%, SPD -75%, Counter w/ Sweep the Field)",
    description:
      "Begins charging Flectere si Nequeno, Superos Acheronta Movebo. While charging, ATK -50% and SPD -75%. Counters attacks with Sweep the Field (each counter reduces next Flectere damage by 5%, up to 50%). Forces Flectere on next turn.",
    execute({ attacker, engine }) {
      attacker.customCounters.chargingCounters = 0;
      engine.statusManager.applyStatus(attacker, attacker, "silent_charging", {
        isProtected: true,
      });
      engine.log(
        `🌌 [${attacker.name}] enters TEN THOUSAND YEARS SILENT! Charging Flectere si Nequeno...`,
        "special"
      );
    },
  },
  {
    id: "flectere_si_nequeno",
    name: "Flectere si Nequeno, Superos Acheronta Movebo",
    element: "Space",
    category: "Physical",
    stab: true,
    hits: 2,
    energyCost: 0,
    accuracy: 100,
    undodgeable: true,
    targetType: "all_enemies",
    // Declarative sequence & upgrade rules:
    requiresPreviousSkill: "ten_thousand_years_silent",
    upgradesSkill: { from: "heart_of_thorns", to: "stars_shall_weep" },
    formulaText: "(3 x ATK + 0.7 x DEF) x 2 (Hit 1 Ignores DEF, Hit 2 2x vs Lower DEF)",
    description:
      "Cannot be cast without casting Ten Thousand Years Silent first. Attacks all enemies 2 times (Hit 1 ignores DEF; Hit 2 deals double damage to targets with less DEF than Allekheiros). Enhances Heart of Thorns to Stars Shall Weep. Killing a target triggers Stars Shall Weep; failing to kill reduces DEF by 100% and delays action by 50%.",
    onBeforeSkill({ attacker, engine }) {
      attacker.customCounters.flectereKilledAny = false;
      engine.statusManager.removeStatus(attacker, "silent_charging", {
        forceProtected: true,
      });
    },
    getIgnoreDefPct({ hitIndex }) {
      return hitIndex === 0 ? 1.0 : 0;
    },
    computeRawHit({ attacker, stats, targetStats, hitIndex }) {
      let base = 3.0 * stats.atk + 0.7 * stats.def;
      if (hitIndex === 1 && targetStats.def < stats.def) {
        base *= 2.0;
      }
      const counterPenalty = Math.min(
        0.5,
        (attacker.customCounters.chargingCounters || 0) * 0.05
      );
      return base * (1 - counterPenalty);
    },
    onTargetKilled({ attacker }) {
      attacker.customCounters.flectereKilledAny = true;
    },
    onAfterSkill({ attacker, engine }) {
      engine.transformUnitForm(attacker, "enhanced");
      if (attacker.customCounters.flectereKilledAny) {
        engine.log(
          `💥 [${attacker.name}] Flectere si Nequeno claimed a life -> Instantly activates [Stars Shall Weep]!`,
          "crit"
        );
        engine.executeCounterSkill(attacker, "stars_shall_weep");
      } else {
        engine.statusManager.applyStatus(attacker, attacker, "flectere_exhaustion", {
          duration: 2,
          isProtected: true,
        });
        engine.modifyTurnMeter(attacker, -0.5, { bypassImmunity: true });
        engine.log(
          `⚠️ [${attacker.name}] Flectere si Nequeno failed to kill a target -> DEF reduced by 100% and action delayed by 50%!`,
          "status"
        );
      }
    },
  },

  // ==========================================================
  // 8. THERIDINE, GREAT SEPTIMUS — BOSS MOVES
  // ==========================================================
  {
    id: "as_one_shall_rest",
    name: "As One Shall Rest",
    element: "Light",
    category: "Physical",
    stab: true,
    hits: 1,
    energyCost: 25,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1 x ATK (50% [Sleep] 1T)",
    description: "Attacks one enemy. Has a 50% chance to place a [Sleep] debuff for 1 turn.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && engine.rng() <= 0.5) {
        engine.statusManager.applyStatus(attacker, target, "sleep", { duration: 1 });
      }
    },
  },
  {
    id: "for_one_shall_suffer",
    name: "For One Shall Suffer",
    element: "Time",
    category: "Ranged",
    stab: true,
    hits: 3,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1 x ATK x 3 (Delays Action 50%; <50% HP -> Repeat + [Stun] 1T)",
    description:
      "Attacks all enemies 3 times and delays their action by 50%. Repeats the attack once against enemies under 50% HP and places a [Stun] debuff for 1 turn.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      engine.modifyTurnMeter(target, -0.5);
      if (target.currentHp < target.effectiveMaxHp * 0.5) {
        engine.log(
          `⚡ [${attacker.name}] For One Shall Suffer repeats on ${target.name} (<50% HP) and inflicts [Stun]!`,
          "special"
        );
        engine.executeBonusHit({
          attacker,
          target,
          element: "Time",
          stab: true,
          rawMultiplier: 1.5,
          ignoreDefPct: 0,
          label: "For One Shall Suffer (Repeat)",
        });
        if (target.currentHp > 0) {
          engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
        }
      }
    },
  },
  {
    id: "im_anfang_war_die_tat",
    name: "Im Anfang War die Tat",
    element: "Light",
    category: "Status",
    stab: false,
    energyCost: 40,
    cooldown: 4,
    accuracy: null,
    targetType: "self",
    formulaText: "Requires <50% Total Bars (<=8 bars). Grants 7 Charging Bars + Restores 100% Enemy Energy",
    description:
      "Usable once every 4 turns when Theridine is under 50% total HP (<=8 bars left). Enters charging state: grants 7 charging HP bars (5 HP each) and restores 100% of all enemies' Energy. Acts passively after 7 enemy turns to unleash 'For One is Holy' unless all 7 bars are broken first!",
    canUse({ attacker }) {
      const barsLeft = attacker.customCounters.hpBarsRemaining ?? 16;
      const maxBars = attacker.customCounters.maxHpBars ?? 16;
      if (barsLeft > maxBars * 0.5) {
        return {
          allowed: false,
          reason: `Requires under 50% total HP (${barsLeft}/${maxBars} bars left).`,
        };
      }
      return { allowed: true };
    },
    execute({ attacker, engine }) {
      attacker.customCounters.chargingBarsRemaining = 7;
      attacker.customCounters.chargingReactionsLeft = 7;
      engine.getLivingEnemiesOf(attacker).forEach((enemy) => {
        enemy.currentEnergy = enemy.maxEnergy;
      });
      engine.log(
        `✨ [${attacker.name}] invokes IM ANFANG WAR DIE TAT! Gained 7 Sacred Charging Bars and restored 100% Energy to all heroes! Break all 7 bars before 7 enemy actions to stop 'For One is Holy'!`,
        "special"
      );
    },
  },
  {
    id: "for_one_is_holy",
    name: "For One is Holy",
    element: "Light",
    category: "Ranged",
    stab: true,
    hits: 7,
    energyCost: 0,
    accuracy: 100,
    undodgeable: true,
    cannotCastManually: true,
    targetType: "all_enemies",
    formulaText: "(3 x ATK + 0.1 x ENEMY MAX HP) x 7 (Ignores 100% DEF)",
    description:
      "Can only be cast once Im Anfang War die Tat charging finishes! Attacks all enemies 7 times, ignoring 100% DEF.",
    getIgnoreDefPct() {
      return 1.0;
    },
    computeRawHit({ stats, target }) {
      return 3.0 * stats.atk + 0.1 * target.effectiveMaxHp;
    },
  },

  // ==========================================================
  // ADDITIONAL EXPANDABLE HERO SKILLS (For 5-6 Hero Raid Squads)
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
    formulaText: "Team +30% SPD & +50% ATK Buff (2T) + +20% Turn Meter",
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
    formulaText: "1.8 x ATK (x2 hits AoE) + [Burn]",
    description: "Unleashes twin waves of dragonfire on all enemies and places [Burn] for 2 turns.",
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
