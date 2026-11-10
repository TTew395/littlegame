/**
 * Passive Abilities Registry (Emoji-free)
 * Includes all Champions & Raid Bosses:
 * - Karnage: Avatar of Anarchy
 * - ByuN: Micro Jackson
 * - Arix: Cursed Holder
 * - Marius the Gallant: Steadfast Knight
 * - Predator: Yautja Cloak
 * - Solanar the Gleaming: Scholar of Sun
 * - Debt-Bearer Alnith: Marker of Debt
 * - Tethren Dragonsoul: Auric Soul
 * - The Calamitus: Wrongly Created
 * - All 7 Raid Bosses (Antikhonor, Ouroboros, Novok, Ternax, Zander, Allekheiros, Theridine)
 */

import { Registry } from "../engine/Registry.js";

export const ABILITY_LIST = [
  // ==========================================
  // 1. KARNAGE THE ANARCH
  // ==========================================
  {
    id: "avatar_of_anarchy",
    name: "Avatar of Anarchy",
    description:
      "Increases this character's C. DMG by 1 for every 3 points of SPD they have.",
    modifyStats({ stats }) {
      stats.critDmg += Math.floor(stats.spd / 3);
    },
  },

  // ==========================================
  // 2. NEW CHAMPIONS ABILITIES
  // ==========================================
  {
    id: "micro_jackson",
    name: "Micro Jackson",
    description:
      "Receives 15% less damage from AOE attacks. Whenever an ally is attacked, has a 20% chance of reducing incoming damage by 50% (once per attack). Whenever an enemy is attacked, has a 20% chance of joining in with the 2-Barrack Rush skill (does not consume Energy).",
    flags: {
      allyAttackJoinChance: true,
    },
    modifyIncomingDamage({ unit, defender, skill, damage, engine }) {
      let result = damage;
      if (unit && defender && unit.id === defender.id && skill?.targetType === "all_enemies") {
        result *= 0.85;
      }
      if (unit && defender && unit.teamId === defender.teamId) {
        const guardKey = `${engine.turnNumber}-${defender.id}`;
        if (unit.customCounters._microGuardKey !== guardKey) {
          unit.customCounters._microGuardKey = guardKey;
          if (engine.rng() < 0.2) {
            result *= 0.5;
            engine.log(
              `[${unit.name}] Micro Jackson reduces incoming damage to ${defender.name} by 50%!`,
              "special"
            );
          }
        }
      }
      return result;
    },
  },
  {
    id: "cursed_holder",
    name: "Cursed Holder",
    description:
      "Deals 25% more damage when counterattacking. Counterattacks do not cost energy.",
    flags: {
      counterattackDmgMultiplier: 1.25,
    },
    modifyOutgoingDamage({ isCounter, damage }) {
      return isCounter ? damage * 1.25 : damage;
    },
  },
  {
    id: "steadfast_knight",
    name: "Steadfast Knight",
    description:
      "Immune to [Decrease SPD] and speed/Turn Meter reduction effects. Whenever an enemy attempts to place one of these debuffs or switches Form, instantly counterattacks with the Auric Lance skill.",
    immunities: ["spd_down", "windstruck"],
    flags: {
      immuneToTurnMeterReduction: true,
      counterOnSpdDownAttempt: true,
      counterOnEnemyFormSwitch: true,
    },
  },
  {
    id: "yautja_cloak",
    name: "Yautja Cloak",
    description:
      "At the start of each round, has a 50% chance to evade incoming skills (decreases to 0% upon taking a turn). Each time this character kills an enemy, increases their chance of evasion by 20%, stacking up to 60%. Whenever this character successfully evades an enemy's skill, counterattacks with Wrist Blades.",
    flags: {
      yautjaCloakEvasion: true,
      counterOnEvade: true,
    },
    onBattleStart({ unit, engine }) {
      unit.customCounters.cloakStartEvasionActive = true;
      unit.customCounters.killEvasionBonus = 0;
      unit.customCounters.predatorMovesUsed = {};
      engine.log(
        `[${unit.name}] Yautja Cloak active: 50% Evasion chance until taking a turn.`,
        "special"
      );
    },
    onRoundStart({ unit, engine }) {
      if (unit.currentHp > 0 && !unit.customCounters.cloakStartEvasionActive && unit.customCounters.killEvasionBonus != 0;) {
        unit.customCounter.cloakStartEvasionActive = true;
        engine.log(
          `[${unit.name}] Yautja Cloak re-engages (${Math.round(unit.customCounters.killEvasionBonus * 100)}% chance to Evade).`,
          "info"
        );
      }
    },
    onTurnStart({ unit }) {
      unit.customCounters.cloakStartEvasionActive = false;
    },
    onKillEnemy({ unit, victim, engine }) {
      const prev = unit.customCounters.killEvasionBonus || 0;
      if (prev < 0.6) {
        unit.customCounters.killEvasionBonus = Math.min(
          0.6,
          Math.round((prev + 0.2) * 100) / 100
        );
        engine.log(
          `[${unit.name}] Yautja Cloak: slaying ${victim.name} permanently increases Evasion by +20% (Kill Bonus: ${Math.round(unit.customCounters.killEvasionBonus * 100)}%).`,
          "special"
        );
      }
    },
  },
  {
    id: "scholar_of_sun",
    name: "Scholar of Sun",
    cannotBeBlocked: true,
    description:
      "Once per battle, if this character is dead, when their last living ally dies, instantly revives this character with 75% HP, 75% energy, and grants an Instant Turn. Whenever a character gets an Extra Turn, Instant Turn, or receives a buff, has a 20% chance of counterattacking with Solar Nova.",
    flags: {
      counterOnEnemyExtraTurnOrBuff: true,
      scholarOfSunRevive: true,
    },
    onBattleStart({ unit, engine }) {
      unit.customCounters.scholarOfSunRevived = false;
      engine.log(
        `[${unit.name}] Scholar of Sun active: will revive at 75% HP & 75% Energy with an Instant Turn when all allies fall, and has a 20% chance to counterattack with [Solar Nova] on buffs/Extra Turns.`,
        "special"
      );
    },
    tryReviveSolanar({ solanar, engine }) {
      if (
        !solanar ||
        solanar.currentHp > 0 ||
        solanar.blockRevive ||
        solanar.customCounters?.scholarOfSunRevived
      ) {
        return false;
      }
      const remainingLivingOnTeam = engine.units.filter(
        (u) => u.teamId === solanar.teamId && !u.isSummon && u.currentHp > 0
      );
      if (remainingLivingOnTeam.length > 0) {
        return false;
      }
      solanar.customCounters.scholarOfSunRevived = true;
      solanar._justRevivedProtectThisSkill = true;
      solanar.statuses = (solanar.statuses || []).filter(
        (s) =>
          ![
            "stun",
            "sleep",
            "freeze",
            "frozen",
            "block_passive_skills",
            "seal",
          ].includes(s.id)
      );
      solanar.currentHp = Math.max(
        1,
        Math.round(solanar.effectiveMaxHp * 0.75)
      );
      solanar.currentEnergy = Math.max(
        solanar.currentEnergy,
        Math.round(solanar.maxEnergy * 0.75)
      );
      solanar.turnMeter = 1000;
      engine.log(
        `[${solanar.name}] Scholar of Sun activates! With all allies fallen, ${solanar.name} revives with ${solanar.currentHp} HP (75% MAX HP), ${solanar.currentEnergy} Energy (75% MAX EN), and an Instant Turn!`,
        "special"
      );
      engine.grantExtraTurn(solanar, { suppressReactions: true });
      return true;
    },
    onDeath({ unit, engine }) {
      if (unit.blockRevive || unit.customCounters?.scholarOfSunRevived) return;
      const remainingLivingAllies = engine.units.filter(
        (u) =>
          u.teamId === unit.teamId &&
          u.id !== unit.id &&
          !u.isSummon &&
          u.currentHp > 0
      );
      if (remainingLivingAllies.length === 0) {
        this.tryReviveSolanar({ solanar: unit, engine });
      } else {
        engine.log(
          `[${unit.name}] Scholar of Sun is dormant — ${unit.name} will revive at 75% HP & 75% Energy with an Instant Turn when the last living ally falls.`,
          "special"
        );
      }
    },
    onAllyKilled({ unit, engine }) {
      if (unit.currentHp <= 0) {
        this.tryReviveSolanar({ solanar: unit, engine });
      }
    },
  },
  {
    id: "marker_of_debt",
    name: "Marker of Debt",
    description:
      "Whenever this character attacks, has a 50% chance (+5% per Blood-Due stack on enemy team, up to +25%) to place a random 1-turn debuff ([Poison], [Burn], [Hemorrhage], [Acidic], [Windstruck], [Bleed], [Decay]). Whenever a debuff is placed on any enemy, also places 1 stack of [Blood-Due] (unresistable, max 15 on enemy team). Takes 3% less damage per [Blood-Due] on attacker (up to 15%). Heals by 4% of ATK per [Blood-Due] on target when attacking. When killed, deals True Damage equal to 5% MAX HP per [Blood-Due] (up to 25%), cleanses all statuses/Blood-Due from all units, and heals everyone by 25% MAX HP (once per round).",
    flags: {
      markerOfDebtOnHit: true,
      applyBloodDueOnDebuff: true,
    },
    modifyIncomingDamage({ unit, attacker, defender, damage, engine }) {
      if (unit && defender && unit.id !== defender.id) return damage;
      if (!attacker) return damage;
      const stacks = engine.statusManager.getStacks(attacker, "blood_due");
      if (stacks <= 0) return damage;
      const red = Math.min(0.15, stacks * 0.03);
      return damage * (1 - red);
    },
    onDeath({ unit, engine }) {
      if (unit.customCounters.markerDeathTriggered) return;
      unit.customCounters.markerDeathTriggered = true;
      engine.log(
        `[${unit.name}] Marker of Debt triggers final reckoning upon death!`,
        "crit"
      );

      for (const e of engine.getLivingEnemiesOf(unit)) {
        const stacks = engine.statusManager.getStacks(e, "blood_due");
        if (stacks > 0) {
          const pct = Math.min(0.25, stacks * 0.05);
          const dmg = Math.max(1, Math.floor(e.effectiveMaxHp * pct));
          engine.dealTrueDamage(
            e,
            dmg,
            `Marker of Debt Death Reckoning (${stacks} Blood-Due)`
          );
        }
      }

      for (const u of engine.getLivingUnits()) {
        u.statuses = [];
        u.shieldHp = 0;
        const heal = Math.max(1, Math.floor(u.effectiveMaxHp * 0.25));
        u.currentHp = Math.min(u.effectiveMaxHp, u.currentHp + heal);
      }
      engine.log(
        "Marker of Debt removes all buffs, debuffs, and [Blood-Due] stacks from all units and heals everyone by 25% MAX HP.",
        "heal"
      );
    },
  },
  {
    id: "auric_soul",
    name: "Auric Soul",
    cannotBeBlocked: true,
    description:
      "Allies take 10% less damage against enemies under [Burn] debuffs and deal 10% more damage against enemies under [Burn] debuffs. [Burn] debuffs placed on allies heal them by 5% MAX HP instead of damaging them.",
    flags: {
      auricSoulTeamBurnAura: true,
    },
    modifyIncomingDamage({ attacker, damage, engine }) {
      if (attacker && engine.statusManager.hasStatus(attacker, "burn")) {
        return damage * 0.9;
      }
      return damage;
    },
  },
  {
    id: "wrongly_created",
    name: "Wrongly Created",
    description:
      "Immune to [Decrease ATK] debuffs. Critical hits from this character deal double damage (2.0x) instead.",
    immunities: ["atk_down"],
    flags: {
      fixedCritMultiplier: 2.0,
      doubleCritDamage: true,
    },
  },

  // ==========================================
  // 3. UNIVERSAL / BOSS IMMUNITY TRAITS
  // ==========================================
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
  {
    id: "molten_immunity",
    name: "Molten Immunity",
    cannotBeBlocked: true,
    description:
      "Skills that deal damage based on ENEMY MAX HP cannot exceed 10% of the boss's MAX HP. Immune to [Stun], [Sleep], [Freeze], [Frozen], [Block Passive Skills], [Heart-Melt], [Decrease ATK], [Decrease DEF], [Decrease SPD], and ATK reduction debuffs. Turn Meter reduction effects are decreased by 50% when used on Ternax.",
    immunities: [
      "stun",
      "sleep",
      "freeze",
      "frozen",
      "block_passive_skills",
      "heart_melt",
      "atk_down",
      "def_down",
      "spd_down",
    ],
    flags: {
      capEnemyMaxHpScalingPct: 0.1,
      turnMeterReductionMultiplier: 0.5,
      immuneToTurnSkip: true,
      immuneToHpSwap: true,
    },
  },

  // ==========================================
  // 4. RAID BOSS ABILITIES
  // ==========================================
  {
    id: "master_of_legions",
    name: "Master of Legions",
    description:
      "When Antikhonor joins the battle and at the start of each turn, applies 8 stacks of War Armor (each stack decreases damage taken by 4%). Whenever an enemy attacks Antikhonor, reduces War Armor by 1 (once per skill). When War Armor is fully depleted, deals 10% MAX HP damage to Antikhonor and delays action by 20%. When attacked while not under War Armor, takes 1% MAX HP True Damage (once per skill). Resets War Armor to 8 when Antikhonor takes a turn.",
    onBattleStart({ unit, engine }) {
      engine.statusManager.setStatusStacks(unit, "war_armor", 8, { isProtected: true });
      engine.log(
        `[${unit.name}] Master of Legions: 8 stacks of War Armor applied.`,
        "special"
      );
    },
    onTurnStart({ unit, engine }) {
      engine.statusManager.setStatusStacks(unit, "war_armor", 8, { isProtected: true });
      engine.clearGlobalStatus("glory");
      engine.log(
        `[${unit.name}] Master of Legions resets War Armor to 8 (all Glory stacks cleared).`,
        "special"
      );
    },
    onAfterSkillAttacked({ attacker, defender, engine }) {
      if (defender.currentHp <= 0) return;

      const currentArmor = engine.statusManager.getStacks(defender, "war_armor");
      let gloryReduction = 0;

      if (engine.statusManager.hasStatus(attacker, "glory")) {
        engine.statusManager.addStacks(attacker, "glory", 1);
        gloryReduction = engine.statusManager.getStacks(attacker, "glory");
        engine.log(
          `${attacker.name}'s Glory rises to ${gloryReduction} stack(s).`,
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

        if (newStacks === 0) {
          const shatterDmg = Math.max(1, Math.floor(defender.effectiveMaxHp * 0.1));
          engine.dealTrueDamage(defender, shatterDmg, "War Armor Depletion (10% MAX HP)");
          engine.modifyTurnMeter(defender, -0.2, { bypassImmunity: true });
          engine.clearGlobalStatus("glory");
          engine.log(
            `[SHATTER] ${defender.name}'s War Armor depleted! Took ${shatterDmg} damage, action delayed by 20%, and all Glory stacks vanished.`,
            "crit"
          );
        }
      } else {
        const bonusTrueDmg = Math.max(1, Math.floor(defender.effectiveMaxHp * 0.01));
        engine.dealTrueDamage(defender, bonusTrueDmg, "Exposed Core (1% MAX HP True DMG)");
      }
    },
  },
  {
    id: "brood_queen",
    name: "Brood Queen",
    description:
      "Whenever Ouroboros is attacked, spawns 1 Swarm Spawn (once per turn, max 4 alive). At start of Ouroboros's turn, consumes 1 Swarm Spawn to permanently increase ATK by 10% (stacking). Starts with Evolution Counter = 8; each Swarm Spawn defeated decreases it by 1. At 0, reduces Ouroboros's DEF to 5 for 2 turns, decreases SPD to 60, and resets Evolution Counter to 8.",
    onBattleStart({ unit, engine }) {
      unit.customCounters.evolutionCounter = 8;
      unit.customCounters.spawnedThisTurn = false;
      engine.log(`[${unit.name}] Brood Queen Evolution Counter initialized to 8.`, "special");
    },
    modifyStats({ unit, stats, engine }) {
      const broodStacks = engine.statusManager.getStacks(unit, "brood_atk_boost");
      if (broodStacks > 0) {
        stats.atk = Math.round(stats.atk * (1 + 0.1 * broodStacks) * 10) / 10;
      }
      if (engine.statusManager.hasStatus(unit, "evolution_vulnerability")) {
        stats.def = 5;
        stats.spd = 60;
      }
    },
    onTurnStart({ unit, engine }) {
      unit.customCounters.spawnedThisTurn = false;
      const aliveSpawns = engine
        .getLivingAlliesOf(unit)
        .filter((a) => a.templateId === "swarm_spawn");

      if (aliveSpawns.length > 0) {
        const sacrificed = aliveSpawns[0];
        sacrificed.currentHp = 0;
        sacrificed.turnMeter = 0;
        engine.statusManager.applyStatus(unit, unit, "brood_atk_boost", {
          stacks: 1,
          isProtected: true,
          silent: true,
        });
        const stacks = engine.statusManager.getStacks(unit, "brood_atk_boost");
        engine.log(
          `[${unit.name}] Brood Queen consumes ${sacrificed.name} -> Permanent ATK increased by +${stacks * 10}%.`,
          "special"
        );
      }
    },
    onAfterSkillAttacked({ defender, engine }) {
      if (defender.currentHp <= 0) return;
      if (defender.customCounters.spawnedThisTurn) return;

      const aliveSpawns = engine
        .getLivingAlliesOf(defender)
        .filter((a) => a.templateId === "swarm_spawn");

      if (aliveSpawns.length < 4) {
        defender.customCounters.spawnedThisTurn = true;
        engine.spawnSwarmMinion(defender.teamId);
        engine.log(
          `[${defender.name}] Brood Queen spawns a Swarm Spawn in response to the attack.`,
          "special"
        );
      }
    },
  },
  {
    id: "queens_spawn",
    name: "Queen's Spawn",
    description:
      "When this unit is killed, deals damage to all allies equal to 20% of this unit's MAX HP and applies 1 stack of [Vulnerability] on them for 4 turns (cannot be blocked, resisted, or removed). Also decreases Ouroboros's Evolution Counter by 1.",
    onDeath({ unit, engine }) {
      const allies = engine.getLivingAlliesOf(unit);
      const splashDmg = Math.max(1, Math.floor(unit.effectiveMaxHp * 0.2));

      allies.forEach((ally) => {
        engine.dealTrueDamage(ally, splashDmg, "Queen's Spawn Deathburst");
        engine.statusManager.applyStatus(unit, ally, "vulnerability", {
          duration: 4,
          stacks: 1,
          isProtected: true,
          bypassImmunity: true,
        });

        if (ally.templateId === "ouroboros_the_swarm" && ally.currentHp > 0) {
          ally.customCounters.evolutionCounter = Math.max(
            0,
            (ally.customCounters.evolutionCounter ?? 8) - 1
          );
          engine.log(
            `[${ally.name}] Evolution Counter drops to ${ally.customCounters.evolutionCounter}/8.`,
            "status"
          );
          if (ally.customCounters.evolutionCounter === 0) {
            ally.customCounters.evolutionCounter = 8;
            ally.baseStats.spd = 60;
            engine.statusManager.applyStatus(ally, ally, "evolution_vulnerability", {
              duration: 2,
              isProtected: true,
              bypassImmunity: true,
            });
            engine.log(
              `[MOLT] [${ally.name}] Evolution Counter reached 0! DEF reduced to 5 for 2 turns, SPD reduced to 60, and counter reset to 8.`,
              "crit"
            );
          }
        }
      });
    },
  },
  {
    id: "gravewalker",
    name: "Gravewalker",
    description:
      "When Novok takes a turn, revives one random dead ally with 30% HP and 50% energy. For each living ally, Novok takes 5% less damage (up to 20%) and deals 10% more damage (up to 40%). Whenever an ally is killed, Novok takes True Damage equal to 20% of their MAX HP.",
    onBattleStart({ unit, engine }) {
      const allies = engine.getLivingAlliesOf(unit).filter((a) => a.id !== unit.id);
      if (allies.length === 0) {
        engine.spawnCharacter("grave_acolyte", unit.teamId);
        engine.spawnCharacter("grave_acolyte", unit.teamId);
        engine.log(
          `[${unit.name}] Gravewalker raises 2 Crypt Acolytes from the catacombs.`,
          "special"
        );
      }
    },
    onTurnStart({ unit, engine }) {
      const deadAllies = engine.units.filter(
        (u) =>
          u.teamId === unit.teamId &&
          u.id !== unit.id &&
          !u.isSummon &&
          u.currentHp <= 0 &&
          !u.blockRevive
      );
      if (deadAllies.length > 0) {
        const revived = deadAllies[Math.floor(engine.rng() * deadAllies.length)];
        revived.currentHp = Math.max(1, Math.floor(revived.effectiveMaxHp * 0.3));
        revived.currentEnergy = Math.floor(revived.maxEnergy * 0.5);
        revived.turnMeter = 300;
        engine.log(
          `[${unit.name}] Gravewalker revives ${revived.name} at 30% HP (${revived.currentHp} HP) and 50% Energy.`,
          "heal"
        );
      }
    },
    modifyOutgoingDamage({ attacker, damage, engine }) {
      const livingAllies = engine
        .getLivingAlliesOf(attacker)
        .filter((a) => a.id !== attacker.id).length;
      const bonusPct = Math.min(0.4, livingAllies * 0.1);
      return damage * (1 + bonusPct);
    },
    modifyIncomingDamage({ unit, defender, damage, engine }) {
      if (unit && defender && unit.id !== defender.id) return damage;
      const livingAllies = engine
        .getLivingAlliesOf(defender)
        .filter((a) => a.id !== defender.id).length;
      const redPct = Math.min(0.2, livingAllies * 0.05);
      return damage * (1 - redPct);
    },
    onAllyKilled({ unit, deadAlly, engine }) {
      if (unit.currentHp <= 0) return;
      const backlash = Math.max(1, Math.floor(deadAlly.effectiveMaxHp * 0.2));
      engine.dealTrueDamage(
        unit,
        backlash,
        `Gravewalker Bond (${deadAlly.name} slain)`
      );
    },
  },
  {
    id: "lethal_lava",
    name: "Lethal Lava",
    description:
      "Whenever Ternax receives a [Burn] debuff, instantly removes it and heals Ternax by 10% of MAX HP. When attacking enemies under [Hex], ignores 50% DEF, [Block Damage], [Shield], and [Unkillable] buffs. Regenerates 5 Energy whenever any character takes damage from [Burn] debuffs.",
  },
  {
    id: "genius_foresight",
    name: "Genius's Foresight",
    description:
      "Tracks Transmutation Counter (starts at 0, increases by enemy Energy spent). At 600, grants Zander an Instant Turn and casts Mode: Evolution. Whenever Zander's HP drops below 75% / 50% / 25% thresholds, delays his action by 50% and heals all enemies by 25% of Zander's MAX HP.",
    onBattleStart({ unit, engine }) {
      unit.customCounters.transmutation = 0;
      unit.customCounters.termination = 8;
      unit.customCounters.evolutionDamageTaken = 0;
      unit.customCounters.hpThresholdsTriggered = {};
      engine.log(
        `[${unit.name}] Genius's Foresight records Transmutation Counter (0/600).`,
        "special"
      );
    },
  },
  {
    id: "foresights_rage",
    name: "Foresight's Rage",
    description:
      "Replaces Transmutation Counter with Termination Counter (set to 8). Decreases by 1 each time Zander takes a turn in Evolution state. At 0, activates Cyclicity: Alpha Scepter and returns Zander to Base Form.",
  },
  {
    id: "forever_waiting",
    name: "Forever Waiting",
    description:
      "Each time Allekheiros is attacked, reduces damage taken by 10% (stacks up to 90%) and resets on Allekheiros's turn. Does not occur while in the Ten Thousand Years Silent charging state (instead counters with Sweep the Field and reduces next Flectere damage by 5% per counter, up to 50%).",
    onTurnStart({ unit, engine }) {
      engine.statusManager.removeStatus(unit, "forever_waiting_guard", {
        forceProtected: true,
      });
    },
    onAfterSkillAttacked({ defender, engine }) {
      if (defender.currentHp <= 0) return;

      if (engine.statusManager.hasStatus(defender, "silent_charging")) {
        defender.customCounters.chargingCounters = Math.min(
          10,
          (defender.customCounters.chargingCounters || 0) + 1
        );
        const penaltyPct = defender.customCounters.chargingCounters * 5;
        engine.log(
          `[${defender.name}] counters from Ten Thousand Years Silent with [Sweep the Field]! (Next Flectere damage reduced by ${penaltyPct}%)`,
          "special"
        );
        engine.executeCounterSkill(defender, "sweep_the_field");
      } else {
        engine.statusManager.applyStatus(
          defender,
          defender,
          "forever_waiting_guard",
          { stacks: 1, isProtected: true }
        );
      }
    },
  },
  {
    id: "godspawn",
    name: "Godspawn",
    description:
      "Theridine has 16 HP bars of 50 HP each (MAX HP per bar is considered 50). Whenever one of Theridine's HP bars is depleted, grants all enemies a communal Shield equal to 10x Theridine's ATK (or 20x ATK per charging bar broken during Im Anfang War die Tat). Stacks.",
    onBattleStart({ unit, engine }) {
      unit.customCounters.hpBarsRemaining = 16;
      unit.customCounters.maxHpBars = 16;
      unit.customCounters.chargingBarsRemaining = 0;
      unit.customCounters.chargingReactionsLeft = 0;
      engine.log(
        `[${unit.name}] Godspawn manifests with 16 Sacred Health Bars (50 HP per bar).`,
        "special"
      );
    },
  },
];

export function registerAllAbilities() {
  ABILITY_LIST.forEach((ab) => Registry.registerAbility(ab));
}
