/**
 * Skill / Move Definitions Registry (Emoji-free)
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
        `[WAIT] ${attacker.name} waits cautiously, keeping full guard up and regaining ${gained} Energy.`,
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
        `[REST] ${attacker.name} rests deeply, regaining ${gained} Energy (Defense halved until next turn).`,
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
            `[SWAP CAP] Anarchic Realm attempts HP Swap, but ${target.name}'s immunity caps max-HP effects to ${capDmg}.`,
            "special"
          );
          engine.dealTrueDamage(target, capDmg, "Anarchic Realm (Capped Distortion)");
        } else {
          const tempHp = attacker.currentHp;
          attacker.currentHp = Math.min(attacker.effectiveMaxHp, target.currentHp);
          target.currentHp = Math.min(target.effectiveMaxHp, tempHp);
          engine.log(
            `[HP SWAP] Anarchic Realm warps reality: ${attacker.name} (${attacker.currentHp} HP) swapped HP with ${target.name} (${target.currentHp} HP).`,
            "special"
          );
        }
      } else {
        engine.log(`Anarchic Realm's HP Swap missed (75% roll).`, "info");
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
        `[FORM] ${attacker.name} casts METAMORPH -> Transformed into Alternate Form and granted an Extra Turn.`,
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
          `[BLOCK REVIVE] ${target.name} was slain under 3+ debuffs — [Block Revive] inflicted.`,
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
        `[FORM] ${attacker.name} casts METAMORPH -> Returned to Base Form and granted an Extra Turn.`,
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
    hits: 2,
    energyCost: 30,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.5 x ATK (x2 hits, AoE)",
    description:
      "Attacks all enemies two times. Each hit ignores 4% of all targets' DEF for each War Armor stack on Antikhonor.",
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
        `[SUMMON] ${attacker.name} invokes GLORY TO ALL HONORABLE DEAD: summoned ${enemies.length} Soul Spear(s), raised War Armor to 12, and bestowed [Glory].`,
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
          `[${attacker.name}] Swarm Ensemble focuses ${lowest.name} (lowest HP, ignoring 50% DEF).`,
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
        `[${attacker.name}] casts LARVAL EVOLUTION: ${spawns.length} Swarm Spawn(s) granted an Instant Turn; Fallen Star's Eulogy queued next.`,
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
          `[${attacker.name}] teams up with ${spawns.length} Swarm Spawn(s) to unleash Swarm Ensemble.`,
          "special"
        );
        spawns.forEach((sp) => {
          engine.executeCounterSkill(sp, "swarm_ensemble_minion");
        });
      }
    },
  },
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
        `[${attacker.name}] casts Fallen's Sheath: granted a ${shieldVal} HP [Shield] to all allies for 2 turns.`,
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
        `[${attacker.name}] Hexreaper slew its quarry -> Instantly triggers [Magma Pound].`,
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
    name: "Computation: Alpha Set",
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
        engine.log(`${target.name}'s Energy increased by 15.`, "info");
      }
    },
  },
  {
    id: "permutation_gamma",
    name: "Permutation: Gamma",
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
    name: "Extrapolation: Beta Link",
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
        `[${attacker.name}] casts EXTRAPOLATION: BETA LINK: all enemies granted an Instant Turn with 0 Energy cost — using any skill besides Wait/Rest triggers temporal backlash.`,
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
  {
    id: "collapse_delta",
    name: "Collapse: Delta",
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
      engine.dealTrueDamage(target, trueDmg, "Collapse: Delta (Missing Energy True DMG)");
    },
  },
  {
    id: "restructuring_phi",
    name: "Restructuring: Phi",
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
          `${attacker.name} steals ${Math.round(stolenTm / 10)}% Turn Meter from ${target.name}.`,
          "status"
        );
      }
    },
  },
  {
    id: "continuation_gamma",
    name: "Continuation: Gamma",
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
          `[${attacker.name}] Continuation: Gamma spreads ${collectedDebuffs.length} debuff instance(s) across all enemies.`,
          "status"
        );
      }
    },
  },
  {
    id: "cyclicity_alpha_scepter",
    name: "Cyclicity: Alpha Scepter",
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
        engine.log(`[${attacker.name}] Stars Shall Weep siphons ${heal} HP.`, "heal");
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
        `[${attacker.name}] enters TEN THOUSAND YEARS SILENT: charging Flectere si Nequeno.`,
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
          `[${attacker.name}] Flectere si Nequeno claimed a life -> Instantly activates [Stars Shall Weep].`,
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
          `[${attacker.name}] Flectere si Nequeno failed to kill a target -> DEF reduced by 100% and action delayed by 50%.`,
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
    formulaText: "2 x ATK x 3 (Delays Action 50%; <50% HP -> Repeat + [Stun] 1T)",
    description:
      "Attacks all enemies 3 times and delays their action by 50%. Repeats the attack once against enemies under 50% HP and places a [Stun] debuff for 1 turn.",
    computeRawHit({ stats }) {
      return 2.0 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      engine.modifyTurnMeter(target, -0.5);
      if (target.currentHp < target.effectiveMaxHp * 0.5) {
        engine.log(
          `[${attacker.name}] For One Shall Suffer repeats on ${target.name} (<50% HP) and inflicts [Stun].`,
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
      "Usable once every 4 turns when Theridine is under 50% total HP (<=8 bars left). Enters charging state: grants 7 charging HP bars (50 HP each) and restores 100% of all enemies' Energy. Acts passively after 7 enemy turns to unleash 'For One is Holy' unless all 7 bars are broken first.",
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
        `[${attacker.name}] invokes IM ANFANG WAR DIE TAT: gained 7 Sacred Charging Bars and restored 100% Energy to all heroes. Break all 7 bars before 7 enemy actions to stop 'For One is Holy'.`,
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
      "Can only be cast once Im Anfang War die Tat charging finishes. Attacks all enemies 7 times, ignoring 100% DEF.",
    getIgnoreDefPct() {
      return 1.0;
    },
    computeRawHit({ stats, target }) {
      return 3.0 * stats.atk + 0.1 * target.effectiveMaxHp;
    },
  },

  // ==========================================================
  // ADDITIONAL EXPANDABLE HERO SKILLS (100% Unique Per Hero)
  // ==========================================================
  

  // ==========================================================
  // ITEM REPLACEMENT SKILLS (Glock 17 Shoot & Black Knife Dark Fountain)
  // ==========================================================
  {
    id: "glock_shoot",
    name: "Shoot (Glock 17)",
    element: "Fire",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 10,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "30 Flat Steel/Fire Damage",
    description: "Fires a Glock 17 round for 30 Steel/Fire damage (10 Energy, 100% Accuracy).",
    computeRawHit() {
      return 30;
    },
  },
  {
    id: "dark_fountain",
    name: "Dark Fountain",
    element: "Chaos",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 35,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "1.8 x ATK (x2 hits AoE) + [Decrease DEF]",
    description: "Opens a Dark Fountain to strike all enemies twice and inflict [Decrease DEF] for 2 turns.",
    computeRawHit({ stats }) {
      return 1.8 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      }
    },
  },

  // ==========================================================
  // 9. BYUN MOVES
  // ==========================================================
  {
    id: "two_barrack_rush",
    name: "2-Barrack Rush",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 100,
    isBasicMove: true,
    targetType: "all_enemies",
    formulaText: "1 x ATK (AoE)",
    description: "Attacks all enemies.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "mech_army",
    name: "Mech Army",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 2,
    energyCost: 50,
    accuracy: 80,
    targetType: "all_enemies",
    formulaText: "1 x ATK x 2 (AoE)",
    description: "Attacks all enemies two times.",
    computeRawHit({ stats }) {
      return 1 * stats.atk;
    },
  },
  {
    id: "high_ground_siege",
    name: "High Ground Siege",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    energyCost: 50,
    accuracy: null,
    targetType: "self",
    formulaText: "+60% DEF (2T) + +50% ATK (1T) + Extra Turn",
    description:
      "Places a 60% [Increase DEF] buff on this character for 2 turns, and a 50% [Increase ATK] buff on them for 1 turn. Then grants an Extra Turn.",
    execute({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "def_up", { duration: 2 });
      engine.statusManager.applyStatus(attacker, attacker, "atk_up", { duration: 1 });
      engine.grantExtraTurn(attacker);
      engine.log(
        `[${attacker.name}] High Ground Siege: applied [+DEF] (2T), [+ATK] (1T), and granted an Extra Turn.`,
        "special"
      );
    },
  },
  {
    id: "fusion_core",
    name: "FUSION CORE!!!",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 80,
    accuracy: 90,
    targetType: "single_enemy",
    formulaText: "4 x ATK (Ignores 50% DEF)",
    description: "Attacks one enemy. Will ignore 50% of the target's DEF.",
    getIgnoreDefPct() {
      return 0.5;
    },
    computeRawHit({ stats }) {
      return 4.0 * stats.atk;
    },
  },

  // ==========================================================
  // 10. ARIX MOVES
  // ==========================================================
  {
    id: "purification",
    name: "Purification",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 100,
    isBasicMove: true,
    targetType: "all_enemies",
    formulaText: "0.2 x MAX HP (AoE)",
    description: "Attacks all enemies for 0.2 x HP.",
    computeRawHit({ attacker }) {
      return 0.2 * attacker.effectiveMaxHp;
    },
  },
  {
    id: "unholy_contract",
    name: "Unholy Contract",
    element: "None",
    category: "Status",
    stab: false,
    energyCost: 40,
    accuracy: null,
    targetType: "self",
    formulaText: "Places [Counterattack] Buff (2T)",
    description: "Places a [Counterattack] buff on this character for 2 turns.",
    execute({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "counterattack", { duration: 2 });
    },
  },
  {
    id: "thornchain_malice",
    name: "Thornchain Malice",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 50,
    accuracy: 60,
    targetType: "all_enemies",
    formulaText: "0.3 x MAX HP (AoE, 20% [Stun] 1T)",
    description: "Attacks all enemies. Has a 20% chance to place a [Stun] debuff for 1 turn.",
    computeRawHit({ attacker }) {
      return 0.3 * attacker.effectiveMaxHp;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && engine.rng() <= 0.2) {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
    },
  },
  {
    id: "single_combat",
    name: "Single Combat",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 30,
    accuracy: 60,
    targetType: "single_enemy",
    formulaText: "0.24 x MAX HP (Ignores 50% DEF if target HP < Arix HP)",
    description:
      "Attacks one enemy. Will ignore 50% of the target's DEF if the target's HP is less than this character's.",
    getIgnoreDefPct({ attacker, target }) {
      return target.currentHp < attacker.currentHp ? 0.5 : 0;
    },
    computeRawHit({ attacker }) {
      return 0.24 * attacker.effectiveMaxHp;
    },
  },

  // ==========================================================
  // 11. MARIUS THE GALLANT MOVES
  // ==========================================================
  {
    id: "auric_lance",
    name: "Auric Lance",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 100,
    isBasicMove: true,
    targetType: "all_enemies",
    formulaText: "1 x DEF (AoE)",
    description: "Attacks all enemies based on Defense.",
    computeRawHit({ stats }) {
      return 1.0 * Math.max(1, stats.def);
    },
  },
  {
    id: "death_or_glory",
    name: "Death or Glory",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 3,
    energyCost: 40,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "(1 x DEF + 0.1 x ENEMY MAX HP) x 3 (Reduces Buff Durations by 1T per hit)",
    description:
      "Attacks all enemies 3 times. Each hit decreases the duration of all buffs on all enemies by 1 turn.",
    computeRawHit({ stats, target, engine }) {
      let enemyHpPart = 0.1 * target.effectiveMaxHp;
      if (engine.hasAbilityFlag(target, "capEnemyMaxHpScalingPct")) {
        enemyHpPart = Math.min(enemyHpPart, target.effectiveMaxHp * 0.033);
      }
      return 1.0 * Math.max(1, stats.def) + enemyHpPart;
    },
    onEachHit({ target }) {
      if (target.currentHp <= 0) return;
      target.statuses.forEach((st) => {
        if (st.category === "buff" && st.duration !== null && st.duration > 0) {
          st.duration = Math.max(0, st.duration - 1);
        }
      });
      target.statuses = target.statuses.filter(
        (st) => st.duration === null || st.duration > 0
      );
    },
  },
  {
    id: "galloping_thunder",
    name: "Galloping Thunder",
    element: "Fighting",
    category: "Status",
    stab: false,
    energyCost: 60,
    accuracy: 80,
    targetType: "single_enemy",
    formulaText: "[Stun] Target (1T) + [+60% DEF] Self (2T) + Extra Turn",
    description:
      "Places a [Stun] debuff for 1 turn on the target and places a 60% [Increase DEF] buff on this character for 2 turns. Then grants an Extra Turn.",
    execute({ attacker, targets, engine }) {
      const target = targets[0];
      if (target && engine.rng() <= 0.8) {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
      engine.statusManager.applyStatus(attacker, attacker, "def_up", { duration: 2 });
      engine.grantExtraTurn(attacker);
    },
  },
  {
    id: "knight_of_honor",
    name: "Knight of Honor",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 50,
    accuracy: 70,
    bypassUnkillable: true,
    targetType: "all_enemies",
    formulaText: "1.5 x DEF + 0.1 x ENEMY MAX HP (AoE, Ignores [Unkillable])",
    description: "Attacks all enemies. Will ignore [Unkillable] buffs.",
    computeRawHit({ stats, target, engine }) {
      let enemyHpPart = 0.1 * target.effectiveMaxHp;
      if (engine.hasAbilityFlag(target, "capEnemyMaxHpScalingPct")) {
        enemyHpPart = Math.min(enemyHpPart, target.effectiveMaxHp * 0.1);
      }
      return 1.5 * Math.max(1, stats.def) + enemyHpPart;
    },
  },

  // ==========================================================
  // 12. PREDATOR MOVES
  // ==========================================================
  {
    id: "wrist_blades",
    name: "Wrist Blades",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 100,
    isBasicMove: true,
    targetType: "single_enemy",
    formulaText: "0.1 x MAX HP (Heals 30% of DMG dealt)",
    description: "Attacks one enemy. Heals this character by 30% of the damage dealt.",
    computeRawHit({ attacker }) {
      return 0.1 * attacker.effectiveMaxHp;
    },
    onAfterHit({ attacker, totalDamageToTarget, engine }) {
      if (totalDamageToTarget > 0 && attacker.currentHp > 0) {
        const heal = Math.max(1, Math.floor(totalDamageToTarget * 0.3));
        attacker.currentHp = Math.min(attacker.effectiveMaxHp, attacker.currentHp + heal);
        engine.log(`[${attacker.name}] Wrist Blades heals ${heal} HP.`, "heal");
      }
    },
  },
  {
    id: "smart_disk",
    name: "Smart Disk",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 2,
    energyCost: 50,
    accuracy: 80,
    targetType: "all_enemies",
    formulaText: "0.2 x MAX HP x 2 (AoE Ricochet Scaling)",
    description:
      "Attacks all enemies 2 times. Hit 1 deals +100% damage to primary target (+75% to 2nd, +50% to 3rd...). Hit 2 deals base damage to primary and +25% per subsequent target.",
    computeRawHit({ attacker, hitIndex }) {
      const base = 0.2 * attacker.effectiveMaxHp;
      return hitIndex === 0 ? base * 1.75 : base * 1.35;
    },
  },
  {
    id: "combstick_throw",
    name: "Combstick Throw",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 60,
    accuracy: 60,
    targetType: "single_enemy",
    formulaText: "0.38 x MAX HP (Kill -> [Block Revive]; Survive -> +100% SPD 1T)",
    description:
      "Attacks 1 enemy. If this attack kills an enemy, places [Block Revive] on them. If it does not kill, boosts Predator's SPD by 100% until next turn.",
    computeRawHit({ attacker }) {
      return 0.38 * attacker.effectiveMaxHp;
    },
    onTargetKilled({ target, engine }) {
      target.blockRevive = true;
      engine.log(`[BLOCK REVIVE] ${target.name} slain by Combstick Throw.`, "crit");
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && attacker.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, attacker, "predator_sprint", {
          duration: 1,
        });
      }
    },
  },
  {
    id: "alpha_predator",
    name: "Alpha Predator",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 60,
    accuracy: 70,
    targetType: "single_enemy",
    formulaText: "Secret Skill: [Deathbrand] + 0.2 x MAX HP (Up to 100% Ignore DEF; Kill -> [Unkillable], Survive -> Free Smart Disk)",
    description:
      "Secret Skill (Unlocked after using Wrist Blades, Smart Disk, and Combstick Throw). Places [Deathbrand] (2T) before attacking. Ignores 50% DEF if target HP < Predator HP, and +50% DEF if target SPD > Predator SPD. Kill grants [Unkillable] (1T); if target survives, casts Smart Disk for 0 Energy.",
    canUse({ attacker }) {
      const rawUsed = attacker?.customCounters?.predatorMovesUsed;
      const hasMove = (id) =>
        Array.isArray(rawUsed)
          ? rawUsed.includes(id)
          : Boolean(rawUsed && rawUsed[id]);
      const requiredMoves = ["wrist_blades", "smart_disk", "combstick_throw"];
      const usedCount = requiredMoves.filter(hasMove).length;
      if (usedCount < 3) {
        return {
          allowed: false,
          reason: `Secret Skill: Use Wrist Blades, Smart Disk & Combstick Throw first (${usedCount}/3)`,
        };
      }
      return { allowed: true };
    },
    onBeforeAttack({ attacker, target, engine }) {
      engine.statusManager.applyStatus(attacker, target, "deathbrand", { duration: 2 });
    },
    getIgnoreDefPct({ attacker, target, engine }) {
      let ign = 0;
      if (target.currentHp < attacker.currentHp) ign += 0.5;
      if (engine.getEffectiveStats(target).spd > engine.getEffectiveStats(attacker).spd) {
        ign += 0.5;
      }
      return Math.min(1.0, ign);
    },
    computeRawHit({ attacker }) {
      return 0.2 * attacker.effectiveMaxHp;
    },
    onTargetKilled({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "unkillable", { duration: 1 });
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0 && attacker.currentHp > 0) {
        engine.log(
          `[${attacker.name}] Target survived Alpha Predator -> Instantly activates [Smart Disk]!`,
          "special"
        );
        engine.executeCounterSkill(attacker, "smart_disk");
      }
    },
  },

  // ==========================================================
  // 13. SOLANAR THE GLEAMING MOVES
  // ==========================================================
  {
    id: "solar_nova",
    name: "Solar Nova",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 1,
    energyCost: 30,
    accuracy: 100,
    isBasicMove: true,
    targetType: "all_enemies",
    formulaText: "1 x ATK (AoE + 20% Counter on Enemy Extra Turn/Buff)",
    description:
      "Attacks all enemies. Whenever an enemy gets an Extra Turn, Instant Turn, or receives a buff, Solanar has a 20% chance of counterattacking with this skill.",
    computeRawHit({ stats }) {
      return 1 * stats.atk;
    },
  },
  {
    id: "blazing_force",
    name: "Blazing Force",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 1,
    energyCost: 75,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "Steals All Target Buffs (Unresistable) + 3 x ATK",
    description:
      "Attacks 1 enemy. Before attacking, steals all buffs from the target (cannot be resisted).",
    onBeforeAttack({ attacker, target, engine }) {
      const stolen = target.statuses.filter(
        (s) => s.category === "buff" && !s.isProtected
      );
      if (stolen.length > 0) {
        target.statuses = target.statuses.filter(
          (s) => !(s.category === "buff" && !s.isProtected)
        );
        stolen.forEach((b) => {
          engine.statusManager.applyStatus(attacker, attacker, b.id, {
            duration: b.duration || 2,
            stacks: b.stacks || 1,
            silent: true,
          });
        });
        engine.log(
          `[${attacker.name}] Blazing Force steals ${stolen.length} buff(s) from ${target.name}!`,
          "special"
        );
      }
    },
    computeRawHit({ stats }) {
      return 3.0 * stats.atk;
    },
  },
  {
    id: "sunfury",
    name: "Sunfury",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 1,
    energyCost: 45,
    accuracy: 80,
    targetType: "single_enemy",
    formulaText: "2 x ATK (Ignores 100% DEF)",
    description: "Attacks 1 enemy. Will ignore target DEF.",
    getIgnoreDefPct() {
      return 1.0;
    },
    computeRawHit({ stats }) {
      return 2 * stats.atk;
    },
  },
  {
    id: "unfettered_radiance",
    name: "Unfettered Radiance",
    element: "Fighting",
    category: "Ranged",
    stab: false,
    hits: 2,
    energyCost: 60,
    accuracy: 60,
    targetType: "single_enemy",
    formulaText: "75% [Block Passive Skills] (1T) + 2.1 x ATK x 2 (Hit 1: 30% Ignore DEF)",
    description:
      "Attacks 1 enemy 2 times. Before attacking, has a 75% chance to place [Block Passive Skills] for 1 turn. Hit 1 ignores 30% DEF; Hit 2 cannot be evaded.",
    onBeforeAttack({ attacker, target, engine }) {
      if (engine.rng() <= 0.75) {
        engine.statusManager.applyStatus(attacker, target, "block_passive_skills", {
          duration: 1,
        });
      }
    },
    getIgnoreDefPct({ hitIndex }) {
      return hitIndex === 0 ? 0.3 : 0;
    },
    computeRawHit({ stats }) {
      return 2.1 * stats.atk;
    },
  },

  // ==========================================================
  // 14. DEBT-BEARER ALNITH MOVES
  // ==========================================================
  {
    id: "crescent_cut",
    name: "Crescent Cut",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 80,
    isBasicMove: true,
    targetType: "single_enemy",
    formulaText: "1.5 x ATK + 1 [Blood-Due]",
    description: "Attacks one enemy. Places a [Blood-Due] stack on the target.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.addBloodDueStack(attacker, target, 1);
      }
    },
  },
  {
    id: "bloody_typhoon",
    name: "Bloody Typhoon",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 25,
    accuracy: 75,
    targetType: "single_enemy",
    formulaText: "1.5 x ATK Single + 1.5 x ATK AoE (Places [Blood-Due] on each hit)",
    description:
      "Attacks 1 enemy, then attacks all enemies. Each hit places a [Blood-Due] stack on each target.",
    computeRawHit({ stats }) {
      return 1.5 * stats.atk;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.addBloodDueStack(attacker, target, 1);
      }
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      enemies.forEach((e) => {
        engine.executeBonusHit({
          attacker,
          target: e,
          element: "Fighting",
          stab: true,
          rawMultiplier: 1.5,
          ignoreDefPct: 0,
          label: "Bloody Typhoon AoE",
        });
        if (e.currentHp > 0) {
          engine.addBloodDueStack(attacker, e, 1);
        }
      });
    },
  },
  {
    id: "quick_draw",
    name: "Quick Draw",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 30,
    accuracy: 80,
    targetType: "single_enemy",
    formulaText: "2.5 x ATK x 2 (Ignores 5% DEF per [Blood-Due] stack)",
    description:
      "Attacks 1 enemy 2 times. Ignores 5% of the target's DEF for each [Blood-Due] stack on them.",
    getIgnoreDefPct({ target, engine }) {
      const stacks = engine.statusManager.getStacks(target, "blood_due");
      return Math.min(1.0, stacks * 0.05);
    },
    computeRawHit({ stats }) {
      return 2.5 * stats.atk;
    },
  },
  {
    id: "debt_repaid",
    name: "Debt Repaid",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 60,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "Secret Skill (Requires 15 Total [Blood-Due]): 3-Phase Execution Combo",
    description:
      "Secret Skill: Unlocked when 15 [Blood-Due] stacks are accumulated on the enemy team. Hit 1 strikes target (+20% ATK & 10% Ignore DEF per Blood-Due, up to 100%/50%), removes 5 Blood-Due, then hits all enemies (+2% MAX HP True DMG per debuff, or +20% DMG per debuff vs Bosses), then hits all enemies again (2x DMG if they have Blood-Due) and consumes all Blood-Due stacks.",
    canUse({ attacker, engine }) {
      const totalBloodDue = engine.getTotalEnemyBloodDue(attacker);
      if (totalBloodDue < 15) {
        return {
          allowed: false,
          reason: `Secret Skill: Requires 15 total [Blood-Due] stacks (${totalBloodDue}/15)`,
        };
      }
      return { allowed: true };
    },
    getIgnoreDefPct({ target, engine }) {
      const stacks = engine.statusManager.getStacks(target, "blood_due");
      return Math.min(0.5, stacks * 0.1);
    },
    computeRawHit({ stats, target, engine }) {
      const stacks = engine.statusManager.getStacks(target, "blood_due");
      const debuffs = engine.statusManager.countCategory(target, "debuff");
      let base = 2.0 * stats.atk * (1 + Math.min(1.0, stacks * 0.2));
      if (target.isBoss) {
        base *= 1 + Math.min(1.0, debuffs * 0.2);
      }
      return base;
    },
    onAfterHit({ attacker, target, engine }) {
      const cur = engine.statusManager.getStacks(target, "blood_due");
      engine.statusManager.setStatusStacks(target, "blood_due", Math.max(0, cur - 5), {
        isProtected: true,
      });
    },
    onAfterSkill({ attacker, engine }) {
      const enemies = engine.getLivingEnemiesOf(attacker);
      // Wave 2 & Wave 3 AoE
      enemies.forEach((e) => {
        if (e.currentHp <= 0) return;
        const debuffs = engine.statusManager.countCategory(e, "debuff");
        if (!e.isBoss && debuffs > 0) {
          const pct = Math.min(0.1, debuffs * 0.02);
          engine.dealTrueDamage(
            e,
            Math.max(1, Math.floor(e.effectiveMaxHp * pct)),
            "Debt Repaid (Debuff True DMG)"
          );
        }
        if (e.currentHp > 0) {
          const hasDue = engine.statusManager.getStacks(e, "blood_due") > 0;
          engine.executeBonusHit({
            attacker,
            target: e,
            element: "Fighting",
            stab: true,
            rawMultiplier: hasDue ? 3.0 : 1.5,
            ignoreDefPct: 0.3,
            label: "Debt Repaid Finale",
          });
          engine.statusManager.removeStatus(e, "blood_due", { forceProtected: true });
        }
      });
    },
  },

  // ==========================================================
  // 15. TETHREN DRAGONSOUL MOVES
  // ==========================================================
  {
    id: "flamebolt",
    name: "Flamebolt",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 1,
    energyCost: 15,
    accuracy: 80,
    isBasicMove: true,
    targetType: "single_enemy",
    formulaText: "0.1 x MAX HP + [Burn] (2T)",
    description: "Attacks one enemy. Places a [Burn] debuff for 2 turns.",
    computeRawHit({ attacker }) {
      return 0.1 * attacker.effectiveMaxHp;
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "burn", { duration: 2 });
      }
    },
  },
  {
    id: "by_fire_be_healed",
    name: "By Fire Be Healed",
    element: "Fighting",
    category: "Status",
    stab: false,
    energyCost: 25,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "Guaranteed [Burn] on All Allies (3T, Heals via Auric Soul) + [Burn] on All Enemies (3T)",
    description:
      "Places a guaranteed [Burn] debuff on all allies for 3 turns (which heals them via Auric Soul). Then places a [Burn] debuff on all enemies for 3 turns.",
    execute({ attacker, engine }) {
      engine.log(
        `${attacker.name} casts [By Fire Be Healed]: places [Burn] (3T) on all allies and all enemies.`,
        "heal",
        { isSkill: true }
      );
      engine.getLivingAlliesOf(attacker).forEach((ally) => {
        engine.statusManager.applyStatus(attacker, ally, "burn", {
          duration: 3,
          bypassImmunity: true,
        });
        engine.triggerBurnTick(ally);
      });
      engine.getLivingEnemiesOf(attacker).forEach((enemy) => {
        engine.statusManager.applyStatus(attacker, enemy, "burn", { duration: 3 });
      });
    },
  },
  {
    id: "by_fire_be_broken",
    name: "By Fire Be Broken",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 30,
    accuracy: 80,
    targetType: "all_enemies",
    formulaText: "0.15 x MAX HP (Ticks [Burn] on burning targets; 2x DMG + [Burn] 2T on non-burning targets)",
    description:
      "Attacks all enemies under [Burn] and activates 1 tick of [Burn]. Attacks all enemies not under [Burn] for double damage and places [Burn] for 2 turns.",
    computeRawHit({ attacker, target, engine }) {
      const hasBurn = engine.statusManager.hasStatus(target, "burn");
      return 0.15 * attacker.effectiveMaxHp * (hasBurn ? 1.0 : 2.0);
    },
    onAfterHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      if (engine.statusManager.hasStatus(target, "burn")) {
        engine.triggerBurnTick(target);
      } else {
        engine.statusManager.applyStatus(attacker, target, "burn", { duration: 2 });
      }
    },
  },
  {
    id: "flame_consume_you",
    name: "Flame Consume You",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 60,
    accuracy: 100,
    targetType: "any_unit",
    formulaText: "Versatile: Ally (Full Heal+Instant Turn or 50% Revive) | Enemy (0.2x HP, 100% Ignore DEF/Shields vs [Burn] or AoE)",
    description:
      "Can target allies or enemies: Living Ally -> Full Heal, Instant Turn & [Burn] (2T); Dead Ally -> Revive at 50% HP/Energy & [Burn] (2T); Living Enemy -> Ignores 100% DEF/Shield/Block Damage/Unkillable if under [Burn], or AoE 50% Ignore DEF if not.",
    execute({ attacker, targets, engine }) {
      const target = targets[0];
      if (!target) return;

      if (target.teamId === attacker.teamId) {
        if (target.currentHp <= 0 && !target.blockRevive) {
          target.currentHp = Math.max(1, Math.floor(target.effectiveMaxHp * 0.5));
          target.currentEnergy = Math.floor(target.maxEnergy * 0.5);
          engine.statusManager.applyStatus(attacker, target, "burn", {
            duration: 2,
            bypassImmunity: true,
          });
          engine.log(
            `[${attacker.name}] Flame Consume You revives ${target.name} at 50% HP/Energy!`,
            "heal"
          );
        } else if (target.currentHp > 0) {
          target.currentHp = target.effectiveMaxHp;
          engine.statusManager.applyStatus(attacker, target, "burn", {
            duration: 2,
            bypassImmunity: true,
          });
          engine.grantExtraTurn(target);
          engine.log(
            `[${attacker.name}] Flame Consume You fully heals ${target.name} and grants an Instant Turn!`,
            "heal"
          );
        }
      } else {
        if (target.currentHp <= 0) {
          target.blockRevive = true;
          engine.getLivingEnemiesOf(attacker).forEach((e) => {
            if (engine.statusManager.hasStatus(e, "burn")) {
              engine.triggerBurnTick(e);
            }
          });
          engine.log(
            `[${attacker.name}] Flame Consume You inflicts [Block Revive] on ${target.name} and detonates all [Burn] debuffs!`,
            "crit"
          );
        } else {
          const isBurning = engine.statusManager.hasStatus(target, "burn");
          const rawDmg = Math.max(1, Math.round(attacker.effectiveMaxHp * 0.25));
          if (isBurning) {
            engine.applyCalculatedDamage(target, rawDmg, {
              attacker,
              bypassShieldsAndBlocks: true,
              sourceLabel: "Flame Consume You (100% Ignore DEF/Shields)",
            });
          } else {
            engine.getLivingEnemiesOf(attacker).forEach((e) => {
              engine.applyCalculatedDamage(e, rawDmg, {
                attacker,
                sourceLabel: "Flame Consume You (AoE)",
              });
            });
          }
        }
      }
    },
  },

  // ==========================================================
  // 16. THE CALAMITUS MOVES
  // ==========================================================
  {
    id: "death_sickles_move",
    name: "Death Sickles",
    element: "Fighting",
    category: "Melee",
    stab: false,
    hits: 2,
    energyCost: 15,
    accuracy: 80,
    isBasicMove: true,
    bypassUnkillable: true,
    targetType: "single_enemy",
    formulaText: "1 x ATK x 2 (Ignores [Unkillable])",
    description: "Attacks one enemy 2 times. Will ignore [Unkillable] buffs.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "horde_of_calamity",
    name: "Horde of Calamity",
    element: "Fighting",
    category: "Melee",
    stab: true,
    hits: 4,
    energyCost: 25,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "0.5 x ATK x 4 (Hit 1: Transfer Debuffs, Hit 2: -60% DEF, Hit 3: Spread Debuffs, Hit 4: 2x DMG if Debuffed)",
    description:
      "Attacks one enemy 4 times. Hit 1 transfers all debuffs from Calamitus to target. Hit 2 places 60% [Decrease DEF] (2T). Hit 3 spreads target's debuffs to the lowest HP enemy. Hit 4 deals double damage if target has any debuffs.",
    computeRawHit({ stats, target, hitIndex, engine }) {
      const base = 0.5 * stats.atk;
      if (hitIndex === 3 && engine.statusManager.countCategory(target, "debuff") > 0) {
        return base * 2.0;
      }
      return base;
    },
    onEachHit({ attacker, target, hitIndex, engine }) {
      if (target.currentHp <= 0) return;
      if (hitIndex === 0) {
        const myDebuffs = attacker.statuses.filter((s) => s.category === "debuff");
        if (myDebuffs.length > 0) {
          attacker.statuses = attacker.statuses.filter((s) => s.category !== "debuff");
          myDebuffs.forEach((d) => {
            engine.statusManager.applyStatus(attacker, target, d.id, {
              duration: d.duration || 2,
              stacks: d.stacks || 1,
              silent: true,
            });
          });
        }
      } else if (hitIndex === 1) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      } else if (hitIndex === 2) {
        const enemies = engine.getLivingEnemiesOf(attacker);
        const lowest = [...enemies].sort((a, b) => a.currentHp - b.currentHp)[0];
        if (lowest && lowest.id !== target.id) {
          target.statuses
            .filter((s) => s.category === "debuff")
            .forEach((d) => {
              engine.statusManager.applyStatus(attacker, lowest, d.id, {
                duration: d.duration || 2,
                stacks: d.stacks || 1,
                silent: true,
              });
            });
        }
      }
    },
  },
  {
    id: "necroclysm",
    name: "Necroclysm",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 40,
    accuracy: 80,
    alwaysCrit: true,
    bypassShields: true,
    targetType: "all_enemies",
    formulaText: "1 x ATK (AoE, Guaranteed Crit, Ignores [Shield] & [Block Damage])",
    description:
      "Attacks all enemies. Guaranteed to be critical. Will ignore [Shield] and [Block Damage] buffs.",
    computeRawHit({ stats }) {
      return 1.0 * stats.atk;
    },
  },
  {
    id: "calamitus_termination",
    name: "Termination",
    element: "Fighting",
    category: "Ranged",
    stab: true,
    hits: 1,
    energyCost: 80,
    accuracy: 100,
    alwaysCrit: true,
    targetType: "all_enemies",
    formulaText: "(1 + (1 - HP/MAX HP)) x ATK (AoE, Guaranteed Crit, Ignores 50% DEF)",
    description:
      "Attacks all enemies. Ignores 50% DEF. Damage increases as Calamitus's HP decreases. Guaranteed to be critical.",
    getIgnoreDefPct() {
      return 0.5;
    },
    computeRawHit({ attacker, stats }) {
      const missingRatio = Math.max(0, 1 - attacker.currentHp / attacker.effectiveMaxHp);
      return (1 + missingRatio) * stats.atk;
    },
  },

  // ==========================================================
  // SPARTAN-II STRIKE FORCE MOVES (JOHN-117, FRED-104, KELLY-087, LINDA-034)
  // ==========================================================
  // 1. JOHN-117 MOVES
  {
    id: "direct_shot",
    name: "Direct Shot",
    element: "Void",
    category: "Ranged",
    stab: true,
    hits: 2,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "1.9 x ATK (x2 hits) • Ignore +5% DEF per hit • Repeat on Crit",
    description:
      "Attacks one enemy twice. Will repeat this attack once if any of the hits were critical. Each subsequent hit from this skill will ignore an additional 5% of target DEF.",
    computeRawHit({ stats }) {
      return 1.9 * stats.atk;
    },
    getIgnoreDefPct({ hitIndex }) {
      return Math.min(1.0, (hitIndex || 0) * 0.05);
    },
    onAfterAttack({ attacker, target, critHitsCount, engine, isRepeat }) {
      if (critHitsCount > 0 && !isRepeat && target && target.currentHp > 0) {
        engine.log(
          `[Direct Shot] Critical hit landed! John-117 immediately repeats Direct Shot!`,
          "special"
        );
        engine.runSkillResolution(
          attacker,
          { ...this, hits: 2, _isRepeat: true },
          target.id,
          { isFreeCounter: true, isTeamUp: true }
        );
      }
    },
  },
  {
    id: "battle_fire",
    name: "Battle Fire",
    element: "Void",
    category: "Ranged",
    stab: true,
    hits: 1,
    cooldown: 3,
    energyCost: 35,
    accuracy: 95,
    targetType: "all_enemies",
    formulaText: "3.8 x ATK (AoE) • [+Shatter] Self (2T) • [-DEF (60%)] & [Weaken (25%)] (2T)",
    description:
      "Attacks all enemies. Places a 60% [Decrease DEF] and 25% [Weaken] debuff for 2 turns. Before attacking, places a 15% [Shatter] buff on this Champion for 2 turns.",
    onBeforeAttack({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "shatter", { duration: 2 });
    },
    computeRawHit({ stats }) {
      return 3.8 * stats.atk;
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 2 });
      engine.statusManager.applyStatus(attacker, target, "weaken", { duration: 2 });
    },
  },
  {
    id: "spartans_as_one",
    name: "Spartans, As One",
    element: "Void",
    category: "Physical",
    stab: true,
    hits: 1,
    cooldown: 4,
    energyCost: 50,
    accuracy: 100,
    targetType: "all_enemies",
    bypassShields: true,
    bypassShieldsAndBlocks: true,
    bypassUnkillable: true,
    formulaText: "4.4 x ATK (AoE) • Pierces Buffs • Ignores 50% DEF • Block Revive",
    description:
      "Attacks all enemies. Will ignore [Shield], [Strengthen], [Ally Protection], [Unkillable] and [Block Damage] buffs, as well as 50% of target DEF. Enemies killed by this skill cannot be revived.\n[Spartan Unity]\n1 Spartan Ally: Before attacking, steals all buffs from target. Deals double damage against bosses.\n2 Spartan Allies: Before attacking, places 50% [Increase ATK], 30% [Increase C. DMG] and 30% [Increase C. RATE] buff for 2 turns.\n3 Spartan Allies: Ignores 75% DEF instead (100% vs bosses).",
    onBeforeSkill({ attacker, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      if (spartanCount >= 2) {
        engine.statusManager.applyStatus(attacker, attacker, "atk_up", { duration: 2 });
        engine.statusManager.applyStatus(attacker, attacker, "crit_dmg_up", { duration: 2 });
        engine.statusManager.applyStatus(attacker, attacker, "crit_rate_up", { duration: 2 });
      }
    },
    onBeforeAttack({ attacker, target, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      if (spartanCount >= 1 && target && target.statuses) {
        const stolenBuffs = target.statuses.filter((s) => s.category === "buff" && !s.isProtected);
        for (const b of stolenBuffs) {
          engine.statusManager.removeStatus(target, b.id, { forceProtected: true });
          engine.statusManager.applyStatus(attacker, attacker, b.id, { duration: b.duration || 2 });
        }
        if (stolenBuffs.length > 0) {
          engine.log(
            `[Spartan Unity] ${attacker.name} steals ${stolenBuffs.length} buffs from ${target.name}!`,
            "special"
          );
        }
      }
    },
    getIgnoreDefPct({ attacker, target, engine }) {
      const spartanCount = engine ? engine.getSpartanAlliesCount(attacker) : 0;
      if (spartanCount >= 3) {
        return target && target.isBoss ? 1.0 : 0.75;
      }
      return 0.5;
    },
    computeRawHit({ attacker, target, stats, engine }) {
      const spartanCount = engine ? engine.getSpartanAlliesCount(attacker) : 0;
      let mult = 4.4;
      if (spartanCount >= 1 && target && target.isBoss) {
        mult *= 2.0;
      }
      return mult * stats.atk;
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) {
        engine.statusManager.applyStatus(attacker, target, "block_revive", { isProtected: true });
      }
    },
  },

  // 2. FRED-104 MOVES
  {
    id: "countermand",
    name: "Countermand",
    element: "Force",
    category: "Melee",
    stab: true,
    hits: 1,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "2.2 x DEF • Stun (25% + 5% per self buff & target debuff)",
    description:
      "Attacks one enemy. Has a 25% chance of placing a [Stun] debuff for 1 turn. This chance increases by 5% for each buff on this Champion and debuff on the target.",
    computeRawHit({ stats }) {
      return 2.2 * stats.def;
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      const myBuffs = attacker.statuses.filter((s) => s.category === "buff").length;
      const tgtDebuffs = target.statuses.filter((s) => s.category === "debuff").length;
      const stunChance = 0.25 + 0.05 * (myBuffs + tgtDebuffs);
      if (engine.rng() <= stunChance) {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
    },
  },
  {
    id: "armor_up",
    name: "Armor Up!",
    element: "Force",
    category: "Status",
    stab: false,
    hits: 0,
    cooldown: 3,
    energyCost: 35,
    accuracy: 100,
    targetType: "all_allies",
    formulaText: "Shield (6.5 x DEF) • [+DEF (60%)] & [Strengthen (25%)] (2T)",
    description:
      "Places a 60% [Increase DEF], 25% [Strengthen] and [Shield] buff on all allies for 2 turns. The [Shield] is proportional to this Champion's DEF.\n[Spartan Unity]\n1 Spartan Ally: Removes all debuffs from all allies before placing buffs.\n2 Spartan Allies: Also increases value of Shield by 10% (max 40,000).\n3 Spartan Allies: Buffs placed by this skill cannot be removed or dispelled.",
    execute({ attacker, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      const allies = engine.getLivingAlliesOf(attacker);
      const isProtected = spartanCount >= 3;

      let baseShield = Math.floor(6.5 * engine.getEffectiveStats(attacker).def);
      if (spartanCount >= 2) {
        baseShield = Math.min(40000, Math.floor(baseShield * 1.1));
      }

      for (const ally of allies) {
        if (spartanCount >= 1) {
          ally.statuses = ally.statuses.filter((s) => s.category !== "debuff" || s.isProtected);
          engine.log(`[Spartan Unity] Purged debuffs from ${ally.name}.`, "heal", {
            isSkill: false,
          });
        }
        engine.statusManager.applyStatus(attacker, ally, "def_up", { duration: 2, isProtected });
        engine.statusManager.applyStatus(attacker, ally, "strengthen", {
          duration: 2,
          isProtected,
        });
        ally.shieldHp = (ally.shieldHp || 0) + baseShield;
        engine.statusManager.applyStatus(attacker, ally, "shield", { duration: 2, isProtected });
      }
      engine.log(
        `[Armor Up!] Fred-104 deploys ${baseShield} Shield, +DEF, and Strengthen to all allies!`,
        "heal"
      );
    },
  },
  {
    id: "cover_fire",
    name: "Cover Fire",
    element: "Force",
    category: "Ranged",
    stab: true,
    hits: 1,
    cooldown: 4,
    energyCost: 45,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "3.3 x DEF (AoE) • [Provoke] Enemies (1T) • [Block Damage] Self (1T) • [Ally Protection] (3T)",
    description:
      "Attacks all enemies. Places a [Provoke] debuff for 1 turn and a [Block Damage] buff on this Champion for 1 turn. Then places a 50% [Ally Protection] buff on all allies for 3 turns.",
    computeRawHit({ stats }) {
      return 3.3 * stats.def;
    },
    onBeforeSkill({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "block_damage", { duration: 1 });
      for (const ally of engine.getLivingAlliesOf(attacker)) {
        if (ally.id !== attacker.id) {
          engine.statusManager.applyStatus(attacker, ally, "ally_protection", { duration: 3 });
        }
      }
    },
    onEachHit({ attacker, target, engine }) {
      if (target.currentHp <= 0) return;
      engine.statusManager.applyStatus(attacker, target, "provoke", { duration: 1 });
    },
  },

  // 3. KELLY-087 MOVES
  {
    id: "ferocious_onslaught",
    name: "Ferocious Onslaught",
    element: "Magic",
    category: "Melee",
    stab: true,
    hits: 2,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "0.18 x MAX HP (x2 hits) • Ignores 20% DEF • [Continuous Heal] Lowest HP Ally",
    description:
      "Attacks one enemy two times. Each hit will ignore 20% of the target's DEF. Places a 15% [Continuous Heal] on the ally with the lowest HP.",
    computeRawHit({ stats }) {
      return 0.18 * stats.hp;
    },
    getIgnoreDefPct() {
      return 0.2;
    },
    onAfterAttack({ attacker, engine }) {
      const allies = engine.getLivingAlliesOf(attacker);
      if (allies.length > 0) {
        const lowestAlly = [...allies].sort(
          (a, b) => a.currentHp / a.effectiveMaxHp - b.currentHp / b.effectiveMaxHp
        )[0];
        engine.statusManager.applyStatus(attacker, lowestAlly, "continuous_heal", { duration: 2 });
      }
    },
  },
  {
    id: "calculated_fortification",
    name: "Calculated Fortification",
    element: "Magic",
    category: "Status",
    stab: false,
    hits: 0,
    cooldown: 3,
    energyCost: 40,
    accuracy: 100,
    targetType: "all_allies",
    formulaText: "Shield (100% Kelly MAX HP) • Heal 25% MAX HP • [+ATK (50%)] (2T)",
    description:
      "Places a [Shield] buff on all allies equal to this Champion's MAX HP. Then, heals all allies by 25% of their MAX HP and places a 50% [Increase ATK] buff on all allies for 2 turns.\n[Spartan Unity]\n1 Spartan Ally: Shield cannot be removed.\n2 Spartan Allies: Also places [Strengthen (25%)] and [Fortify (15%)] for 2 turns.\n3 Spartan Allies: Allies deal +10% more damage for each buff placed by this skill.",
    execute({ attacker, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      const shieldVal = attacker.effectiveMaxHp;
      const isProtectedShield = spartanCount >= 1;
      const allies = engine.getLivingAlliesOf(attacker);

      for (const ally of allies) {
        ally.shieldHp = (ally.shieldHp || 0) + shieldVal;
        ally._kellyShieldActive = true;
        engine.statusManager.applyStatus(attacker, ally, "shield", {
          duration: 2,
          isProtected: isProtectedShield,
        });
        const healAmt = Math.max(1, Math.floor(ally.effectiveMaxHp * 0.25));
        engine.healUnit(ally, healAmt, "Calculated Fortification");
        engine.statusManager.applyStatus(attacker, ally, "atk_up", { duration: 2 });

        if (spartanCount >= 2) {
          engine.statusManager.applyStatus(attacker, ally, "strengthen", { duration: 2 });
          engine.statusManager.applyStatus(attacker, ally, "fortify", { duration: 2 });
        }

        if (spartanCount >= 3) {
          ally.customCounters.calculatedFortBonusDmgPct = spartanCount >= 2 ? 0.4 : 0.2;
        }
      }
      engine.log(
        `[Calculated Fortification] Kelly-087 grants ${shieldVal} Shield, 25% Heal, and offensive buffs to all allies!`,
        "heal"
      );
    },
  },
  {
    id: "rapid_intervention",
    name: "Rapid Intervention",
    element: "Magic",
    category: "Status",
    stab: false,
    hits: 0,
    cooldown: 4,
    energyCost: 45,
    accuracy: 100,
    targetType: "all_allies",
    formulaText: "[Perfect Veil] Lowest HP Ally (2T) • Equalize All Allies HP to Highest HP",
    description:
      "Places a [Perfect Veil] buff on the ally with the lowest HP for 2 turns. Then, equalizes the HP of all allies. The HP of all allies will be brought to the level of the ally with the highest HP.",
    execute({ attacker, engine }) {
      const allies = engine.getLivingAlliesOf(attacker);
      if (allies.length === 0) return;

      const lowestAlly = [...allies].sort(
        (a, b) => a.currentHp / a.effectiveMaxHp - b.currentHp / b.effectiveMaxHp
      )[0];
      engine.statusManager.applyStatus(attacker, lowestAlly, "perfect_veil", { duration: 2 });

      const maxHpPct = Math.max(...allies.map((a) => a.currentHp / a.effectiveMaxHp));
      for (const ally of allies) {
        const targetHp = Math.min(ally.effectiveMaxHp, Math.floor(ally.effectiveMaxHp * maxHpPct));
        if (targetHp > ally.currentHp) {
          const diff = targetHp - ally.currentHp;
          ally.currentHp = targetHp;
          engine.log(
            `[Rapid Intervention] ${ally.name}'s HP equalized +${diff} -> (${ally.currentHp}/${ally.effectiveMaxHp} HP).`,
            "heal",
            { isSkill: false }
          );
        }
      }
    },
  },

  // 4. LINDA-034 MOVES
  {
    id: "headshot",
    name: "Headshot",
    element: "Void",
    category: "Ranged",
    stab: true,
    hits: 1,
    alwaysCrit: true,
    energyCost: 15,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "3.2 x ATK • Always Critical • [-ATK (50%)] (2T or 3T AoE on kill)",
    description:
      "Attacks one enemy. This attack is always critical. Places a 50% [Decrease ATK] debuff on the target for 2 turns. If the target was killed, instead places a 50% [Decrease ATK] debuff on all enemies for 3 turns. This debuff cannot be blocked.",
    computeRawHit({ stats }) {
      return 3.2 * stats.atk;
    },
    onAfterAttack({ attacker, target, engine }) {
      if (target && target.currentHp <= 0) {
        for (const enemy of engine.getLivingEnemiesOf(attacker)) {
          engine.statusManager.applyStatus(attacker, enemy, "atk_down", {
            duration: 3,
            isProtected: true,
          });
        }
        engine.log(
          `[Headshot Lethal] Elimination achieved! All remaining enemies suffer unblockable 50% [-ATK] for 3 turns.`,
          "special"
        );
      } else if (target && target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "atk_down", { duration: 2 });
      }
    },
  },
  {
    id: "death_from_afar",
    name: "Death from Afar",
    element: "Void",
    category: "Ranged",
    stab: true,
    hits: 1,
    alwaysCrit: true,
    cooldown: 3,
    energyCost: 35,
    accuracy: 100,
    targetType: "single_enemy",
    formulaText: "3.9 x ATK • Always Critical • Ignores 50% DEF • [+ATK & Perfect Veil] Self (2T)",
    description:
      "Attacks one enemy. This attack is always critical and will ignore 50% of target DEF. Before attacking, places a 50% [Increase ATK] and [Perfect Veil] buff on this Champion for 2 turns.\n[Spartan Unity]\n1 Spartan Ally: Enemies killed cannot be revived.\n2 Spartan Allies: Ignores [Shield], [Block Damage], and [Unkillable] buffs.\n3 Spartan Allies: If target is killed, instantly activates No More Hiding without cooldown.",
    onBeforeAttack({ attacker, engine }) {
      engine.statusManager.applyStatus(attacker, attacker, "atk_up", { duration: 2 });
      engine.statusManager.applyStatus(attacker, attacker, "perfect_veil", { duration: 2 });
    },
    getIgnoreDefPct() {
      return 0.5;
    },
    computeRawHit({ stats }) {
      return 3.9 * stats.atk;
    },
    onBeforeSkill({ attacker, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      if (spartanCount >= 2) {
        this.bypassShields = true;
        this.bypassShieldsAndBlocks = true;
        this.bypassUnkillable = true;
      } else {
        this.bypassShields = false;
        this.bypassShieldsAndBlocks = false;
        this.bypassUnkillable = false;
      }
    },
    onAfterAttack({ attacker, target, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      if (target && target.currentHp <= 0) {
        if (spartanCount >= 1) {
          engine.statusManager.applyStatus(attacker, target, "block_revive", { isProtected: true });
        }
        if (spartanCount >= 3) {
          engine.log(
            `[Spartan Unity] Death from Afar secures kill: Linda-034 instantly activates [No More Hiding]!`,
            "special"
          );
          engine.executeCounterSkill(attacker, "no_more_hiding");
        }
      }
    },
  },
  {
    id: "no_more_hiding",
    name: "No More Hiding",
    element: "Void",
    category: "Ranged",
    stab: true,
    hits: 2,
    alwaysCrit: true,
    cooldown: 5,
    energyCost: 50,
    accuracy: 100,
    targetType: "all_enemies",
    formulaText: "4.4 x ATK (x2 hits) • Always Crit • Ignores 15%/30% DEF • [-DEF (60%) & -ATK (50%)] (3T)",
    description:
      "Attacks all enemies. This attack is always critical. Ignores 15% of target DEF. Then, attacks all enemies again (ignoring an additional 15% DEF). Places a 60% [Decrease DEF] and 50% [Decrease ATK] debuff on all enemies for 3 turns.\n[Spartan Unity]\n1 Spartan Ally: Before attacking, steals all buffs from all enemies.\n2 Spartan Allies: Ignores an additional 5% DEF for each buff on Linda.\n3 Spartan Allies: Damage increases by Shield value (up to 500%).",
    onBeforeSkill({ attacker, engine }) {
      const spartanCount = engine.getSpartanAlliesCount(attacker);
      if (spartanCount >= 1) {
        for (const enemy of engine.getLivingEnemiesOf(attacker)) {
          const stolenBuffs = (enemy.statuses || []).filter(
            (s) => s.category === "buff" && !s.isProtected
          );
          for (const b of stolenBuffs) {
            engine.statusManager.removeStatus(enemy, b.id, { forceProtected: true });
            engine.statusManager.applyStatus(attacker, attacker, b.id, { duration: b.duration || 2 });
          }
        }
      }
    },
    getIgnoreDefPct({ attacker, hitIndex, engine }) {
      const spartanCount = engine ? engine.getSpartanAlliesCount(attacker) : 0;
      let baseIgnore = hitIndex === 0 ? 0.15 : 0.3;
      if (spartanCount >= 2) {
        const myBuffs = (attacker.statuses || []).filter((s) => s.category === "buff").length;
        baseIgnore += myBuffs * 0.05;
      }
      return Math.min(1.0, baseIgnore);
    },
    computeRawHit({ attacker, stats, engine }) {
      let mult = 4.4;
      const spartanCount = engine ? engine.getSpartanAlliesCount(attacker) : 0;
      if (spartanCount >= 3 && attacker.shieldHp > 0) {
        const shieldRatio = attacker.shieldHp / attacker.effectiveMaxHp;
        const bonusMult = Math.min(4.0, shieldRatio * 2.0);
        mult *= 1 + bonusMult;
      }
      return mult * stats.atk;
    },
    onEachHit({ attacker, target, hitIndex, engine }) {
      if (hitIndex === 1 && target.currentHp > 0) {
        engine.statusManager.applyStatus(attacker, target, "def_down", { duration: 3 });
        engine.statusManager.applyStatus(attacker, target, "atk_down", { duration: 3 });
      }
    },
  },
];

export function registerAllSkills() {
  SKILL_LIST.forEach((sk) => Registry.registerSkill(sk));
}
