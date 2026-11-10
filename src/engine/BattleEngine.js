/**
 * BattleEngine
 * Core turn-based combat engine with a clean Declarative Skill Sequencing & Requirement System:
 *
 * How Declarative Skill Sequencing Works (for any character or boss):
 * 1. `minOtherSkillsUsed: 3` -> Skill is locked until the character has used at least 3 other non-universal skills.
 * 2. `requiresPreviousSkill: "skill_a"` -> Skill is locked until the character's previous non-universal skill was "skill_a"
 *    (Wait and Rest do NOT break the chain, so a unit can Rest/Wait to gather Energy for the follow-up!).
 * 3. `forcesNextSkill: "skill_b"` -> After casting this skill, the character's `forcedNextSkillId` is set to "skill_b".
 *    All other combat skills are locked until "skill_b" is cast (Wait and Rest remain unlocked if Energy is needed).
 * 4. `upgradesSkill: { from: "skill_x", to: "skill_y" }` -> Permanently upgrades "skill_x" into "skill_y" on the unit.
 * 5. `cannotCastManually: true` -> Only usable when triggered automatically by an ability or `forcesNextSkill`.
 */

import { Registry } from "./Registry.js";
import { StatusManager } from "./StatusManager.js";
import { DamagePipeline } from "./DamagePipeline.js";

function createSeededRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BattleEngine {
  constructor({ mode = "raid_antikhonor", seed = Date.now(), team1Config = [], team2Config = [] } = {}) {
    this.mode = mode;
    this.seed = seed;
    this.rng = createSeededRng(seed);
    this.turnNumber = 0;
    this.units = [];
    this.activeUnitId = null;
    this.extraTurnQueue = [];
    this.winnerTeam = null;
    this.logs = [];
    this.nextInstanceCounter = 1;

    // Communal Shield pool per team (Granted by Theridine's Godspawn when HP bars break)
    this.communalShields = { 1: 0, 2: 0 };

    this.statusManager = new StatusManager(this);
    this.damagePipeline = new DamagePipeline(this);

    if (team1Config.length > 0 || team2Config.length > 0) {
      this.initTeams(team1Config, team2Config);
    }
  }

  log(message, type = "info") {
    const entry = {
      id: `${this.turnNumber}-${this.logs.length + 1}`,
      turn: this.turnNumber,
      message,
      type,
    };
    this.logs.push(entry);
    if (this.logs.length > 160) {
      this.logs.shift();
    }
  }

  initTeams(team1Config, team2Config) {
    team1Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 1, cfg.itemId));
    team2Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 2, cfg.itemId));

    this.log("⚔️ Battle Commences!", "special");

    for (const unit of [...this.units]) {
      if (unit.currentHp <= 0) continue;
      for (const ab of this.getActiveAbilities(unit)) {
        if (typeof ab.onBattleStart === "function") {
          ab.onBattleStart({ unit, engine: this });
        }
      }
      const item = this.getActiveItem(unit);
      if (item && typeof item.onBattleStart === "function") {
        item.onBattleStart({ unit, engine: this });
      }
    }

    this.advanceToNextTurn();
  }

  spawnCharacter(characterId, teamId, customItemId = null) {
    const template = Registry.getCharacter(characterId);
    if (!template) throw new Error(`Unknown characterId: ${characterId}`);

    // Deep-clone forms so per-unit skill upgrades (like Heart of Thorns -> Stars Shall Weep) never mutate shared templates
    const clonedForms = JSON.parse(JSON.stringify(template.forms));
    const initialFormKey = clonedForms.base ? "base" : Object.keys(clonedForms)[0];

    const instanceId = `${characterId}_${this.nextInstanceCounter++}`;
    const unit = {
      id: instanceId,
      templateId: template.id,
      teamId,
      name: template.name,
      title: template.title || "",
      role: template.role || "",
      isBoss: Boolean(template.isBoss),
      isMinion: Boolean(template.isMinion),
      isSummon: false,
      form: initialFormKey,
      forms: clonedForms,
      activeMoveIds: [...(clonedForms[initialFormKey]?.moves || [])],
      avatar: clonedForms[initialFormKey]?.avatar || template.avatar,
      types: [...(template.types || [])],
      speciesId: template.speciesId,
      itemId: customItemId ?? template.defaultItemId ?? "none",
      abilityIds: [...(template.abilityIds || [])],

      baseMaxHp: template.stats.hp,
      destroyedHpPct: 0,
      effectiveMaxHp: template.stats.hp,
      currentHp: template.stats.hp,
      shieldHp: 0,

      maxEnergy: template.stats.energy,
      currentEnergy: template.stats.energy,

      baseStats: {
        atk: template.stats.atk,
        def: template.stats.def,
        spd: template.stats.spd,
        critRate: template.stats.critRate ?? 15,
        critDmg: template.stats.critDmg ?? 50,
      },

      turnMeter: 0,
      stance: "normal",
      skillsUsedCount: 0,
      lastNonUniversalSkillId: null,
      forcedNextSkillId: null,
      skillUpgrades: {}, // { heart_of_thorns: "stars_shall_weep" }
      blockRevive: false,
      cooldowns: {},
      statuses: [],
      customCounters: {},
    };

    this.units.push(unit);
    return unit;
  }

  /**
   * Cleanly switches a unit's form (e.g. Karnage Base <-> Alternate, Zander Base <-> Evolution, Allekheiros Base -> Enhanced)
   * and immediately refreshes `unit.activeMoveIds` and `unit.avatar`.
   */
  transformUnitForm(unit, newFormKey) {
    if (!unit) return;
    const targetForm = unit.forms?.[newFormKey] || Registry.getCharacter(unit.templateId)?.forms?.[newFormKey];
    if (!targetForm) return;

    unit.form = newFormKey;
    unit.forms[newFormKey] = JSON.parse(JSON.stringify(targetForm));
    unit.avatar = targetForm.avatar || unit.avatar;
    this.syncUnitActiveMoves(unit);
  }

  /**
   * Synchronizes `unit.activeMoveIds` from the unit's current form and applies any permanent `skillUpgrades`.
   */
  syncUnitActiveMoves(unit) {
    if (!unit || unit.isActionlessTotem) {
      if (unit) unit.activeMoveIds = [];
      return;
    }
    const templateForms = Registry.getCharacter(unit.templateId)?.forms || {};
    const formObj =
      unit.forms?.[unit.form] ||
      templateForms[unit.form] ||
      unit.forms?.base ||
      templateForms.base;

    const rawMoves = formObj?.moves ? [...formObj.moves] : [];
    const upgrades = unit.skillUpgrades || {};
    unit.activeMoveIds = rawMoves.map((mId) => upgrades[mId] || mId);
    if (formObj?.avatar) {
      unit.avatar = formObj.avatar;
    }
  }

  spawnSwarmMinion(teamId) {
    const aliveSpawns = this.units.filter(
      (u) => u.teamId === teamId && u.templateId === "swarm_spawn" && u.currentHp > 0
    );
    if (aliveSpawns.length >= 4) return null;
    const spawn = this.spawnCharacter("swarm_spawn", teamId);
    spawn.name = `Swarm Spawn #${aliveSpawns.length + 1}`;
    return spawn;
  }

  summonSoulSpear(summoner, targetHero) {
    const summonDef = Registry.getSummon("soul_spear");
    this.units = this.units.filter(
      (u) => !(u.isSummon && u.linkedTargetId === targetHero.id)
    );

    const spearMaxHp = Math.floor(targetHero.baseMaxHp * 2.0);
    const instanceId = `soul_spear_${this.nextInstanceCounter++}`;
    const spearUnit = {
      id: instanceId,
      templateId: "soul_spear",
      teamId: summoner.teamId,
      name: `Soul Spear (${targetHero.name.split(" ")[0]})`,
      title: `Bound to ${targetHero.name}`,
      role: "Soul Construct",
      isBoss: false,
      isSummon: true,
      isActionlessTotem: true,
      summonerId: summoner.id,
      linkedTargetId: targetHero.id,
      linkedTargetName: targetHero.name,
      form: "base",
      forms: { base: { name: "Construct", avatar: summonDef.avatar, moves: [] } },
      activeMoveIds: [],
      avatar: summonDef.avatar,
      types: summonDef.types,
      speciesId: summonDef.speciesId,
      itemId: "none",
      abilityIds: [],

      baseMaxHp: spearMaxHp,
      destroyedHpPct: 0,
      effectiveMaxHp: spearMaxHp,
      currentHp: spearMaxHp,
      shieldHp: 0,
      maxEnergy: 0,
      currentEnergy: 0,
      baseStats: { atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0 },
      turnMeter: 0,
      stance: "normal",
      skillsUsedCount: 0,
      lastNonUniversalSkillId: null,
      forcedNextSkillId: null,
      skillUpgrades: {},
      blockRevive: true,
      cooldowns: {},
      statuses: [],
      customCounters: {},
    };

    this.units.push(spearUnit);
    return spearUnit;
  }

  recalculateSoulSpearDestruction() {
    for (const unit of this.units) {
      if (unit.isSummon) continue;
      const activeSpear = this.units.find(
        (s) => s.isSummon && s.linkedTargetId === unit.id && s.currentHp > 0
      );
      if (activeSpear) {
        const spearHpPct = (activeSpear.currentHp / activeSpear.baseMaxHp) * 100;
        const destroyedPct = Math.min(75, Math.floor(spearHpPct / 2));
        unit.destroyedHpPct = Math.max(unit.destroyedHpPct, destroyedPct);
      }
      unit.effectiveMaxHp = Math.max(
        1,
        Math.floor(unit.baseMaxHp * (1 - unit.destroyedHpPct / 100))
      );
      if (unit.currentHp > unit.effectiveMaxHp) {
        unit.currentHp = unit.effectiveMaxHp;
      }
    }
  }

  getUnitById(id) {
    return this.units.find((u) => u.id === id);
  }

  getLivingUnits() {
    return this.units.filter((u) => u.currentHp > 0);
  }

  getLivingAlliesOf(unit) {
    return this.units.filter((u) => u.teamId === unit.teamId && u.currentHp > 0);
  }

  getLivingEnemiesOf(unit) {
    return this.units.filter((u) => u.teamId !== unit.teamId && u.currentHp > 0);
  }

  getEffectiveStats(unit) {
    return this.damagePipeline.getEffectiveStats(unit);
  }

  getActiveAbilities(unit) {
    const passivesBlocked = this.statusManager.hasFlag(unit, "blockPassives");
    const list = [];
    for (const abId of unit.abilityIds || []) {
      const ab = Registry.getAbility(abId);
      if (!ab) continue;
      if (passivesBlocked && !ab.cannotBeBlocked) continue;
      list.push(ab);
    }
    return list;
  }

  hasAbilityFlag(unit, flagName) {
    return this.getActiveAbilities(unit).some(
      (ab) => ab.flags && ab.flags[flagName]
    );
  }

  getAbilityFlagValue(unit, flagName) {
    for (const ab of this.getActiveAbilities(unit)) {
      if (ab.flags && ab.flags[flagName] !== undefined) {
        return ab.flags[flagName];
      }
    }
    return null;
  }

  getActiveItem(unit) {
    if (!unit.itemId || unit.itemId === "none") return null;
    if (this.statusManager.hasFlag(unit, "sealItems")) return null;
    return Registry.getItem(unit.itemId);
  }

  clearGlobalStatus(statusId) {
    for (const u of this.units) {
      this.statusManager.removeStatus(u, statusId, { forceProtected: true });
    }
  }

  modifyTurnMeter(unit, deltaFraction, { bypassImmunity = false } = {}) {
    if (unit.currentHp <= 0 || unit.isActionlessTotem) return;
    let effectiveFraction = deltaFraction;

    if (deltaFraction < 0 && !bypassImmunity) {
      if (this.hasAbilityFlag(unit, "immuneToTurnMeterReduction")) {
        this.log(`🛡️ ${unit.name} is immune to Turn Meter reduction!`, "info");
        return;
      }
      const mult = this.getAbilityFlagValue(unit, "turnMeterReductionMultiplier");
      if (mult !== null) {
        effectiveFraction *= mult;
        this.log(
          `🌋 ${unit.name}'s Molten Immunity reduces Turn Meter reduction by 50%!`,
          "info"
        );
      }
    }

    if (effectiveFraction > 0 && this.statusManager.hasFlag(unit, "blockBonusTurnMeter")) {
      this.log(`⛓️ ${unit.name}'s [Seal] prevents bonus Turn Meter gain!`, "status");
      return;
    }

    unit.turnMeter = Math.max(
      0,
      unit.turnMeter + Math.round(effectiveFraction * 1000)
    );
  }

  grantExtraTurn(unit) {
    if (unit.currentHp > 0 && !this.extraTurnQueue.includes(unit.id)) {
      this.extraTurnQueue.unshift(unit.id);
    }
  }

  triggerBurnTick(unit) {
    if (unit.currentHp <= 0) return;
    const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * 0.05));
    this.dealTrueDamage(unit, dmg, "Burn");

    for (const u of this.getLivingUnits()) {
      if (this.getActiveAbilities(u).some((a) => a.id === "lethal_lava")) {
        u.currentEnergy = Math.min(u.maxEnergy, u.currentEnergy + 5);
        this.log(`🌋 [${u.name}] Lethal Lava regenerates +5 Energy from Burn damage!`, "info");
      }
    }
  }

  applyCalculatedDamage(target, amount, { attacker = null, bypassShieldsAndBlocks = false, sourceLabel = null } = {}) {
    if (target.currentHp <= 0 || amount <= 0) return 0;

    if (!bypassShieldsAndBlocks && this.statusManager.hasFlag(target, "blockDamage")) {
      this.log(`🛡️ ${target.name}'s [Block Damage] negates all damage!`, "info");
      return 0;
    }

    let remaining = Math.max(1, Math.round(amount));

    if (!bypassShieldsAndBlocks && (this.communalShields[target.teamId] || 0) > 0) {
      const absorbed = Math.min(this.communalShields[target.teamId], remaining);
      this.communalShields[target.teamId] -= absorbed;
      remaining -= absorbed;
      this.log(
        `💠 Communal Shield absorbs ${absorbed} damage for ${target.name} (${this.communalShields[target.teamId]} Shield left).`,
        "info"
      );
      if (remaining <= 0) return 0;
    }

    if (!bypassShieldsAndBlocks && (target.shieldHp || 0) > 0) {
      const absorbed = Math.min(target.shieldHp, remaining);
      target.shieldHp -= absorbed;
      remaining -= absorbed;
      if (target.shieldHp <= 0) {
        this.statusManager.removeStatus(target, "shield", { forceProtected: true });
      }
      this.log(`💠 ${target.name}'s Shield absorbs ${absorbed} damage!`, "info");
      if (remaining <= 0) return 0;
    }

    if (target.templateId === "theridine_great_septimus") {
      return this.applyDamageToTheridine(target, remaining, attacker);
    }

    const oldHpPct = (target.currentHp / target.effectiveMaxHp) * 100;
    let actual = Math.min(target.currentHp, remaining);

    if (
      !bypassShieldsAndBlocks &&
      this.statusManager.hasFlag(target, "unkillable") &&
      target.currentHp - actual < 1
    ) {
      actual = Math.max(0, target.currentHp - 1);
      this.log(`❤️‍🔥 ${target.name}'s [Unkillable] keeps them at 1 HP!`, "info");
    }

    target.currentHp -= actual;
    const newHpPct = (target.currentHp / target.effectiveMaxHp) * 100;

    if (sourceLabel && actual > 0) {
      this.log(`💥 ${target.name} takes ${actual} damage from ${sourceLabel}!`, "damage");
    }

    if (target.templateId === "first_genius_zander" && actual > 0) {
      if (target.form === "evolution") {
        target.customCounters.evolutionDamageTaken =
          (target.customCounters.evolutionDamageTaken || 0) + actual;
      }
      if (target.currentHp > 0) {
        this.checkZanderHpThresholds(target, oldHpPct, newHpPct);
      }
    }

    if (target.currentHp <= 0) {
      this.handleUnitDeath(target, attacker);
    }
    return actual;
  }

  applyDamageToTheridine(theridine, damageAmount, attacker) {
    let dmgLeft = damageAmount;
    let totalDealt = 0;
    const atkVal = this.getEffectiveStats(theridine).atk;
    const enemyTeamId = theridine.teamId === 1 ? 2 : 1;

    while (dmgLeft > 0 && theridine.currentHp > 0) {
      if (dmgLeft >= theridine.currentHp) {
        const consumed = theridine.currentHp;
        dmgLeft -= consumed;
        totalDealt += consumed;

        if ((theridine.customCounters.chargingBarsRemaining || 0) > 0) {
          theridine.customCounters.chargingBarsRemaining -= 1;
          const shieldGrant = Math.round(atkVal * 20);
          this.communalShields[enemyTeamId] =
            (this.communalShields[enemyTeamId] || 0) + shieldGrant;
          this.log(
            `✨ [${theridine.name}] Charging Bar broken (${theridine.customCounters.chargingBarsRemaining}/7 left)! Heroes gain +${shieldGrant} Communal Shield!`,
            "special"
          );

          if (theridine.customCounters.chargingBarsRemaining === 0) {
            theridine.customCounters.chargingReactionsLeft = 0;
            this.modifyTurnMeter(theridine, -0.5, { bypassImmunity: true });
            this.log(
              `💥 All 7 Charging Bars broken! [${theridine.name}] exits charging state and has action delayed by 50%!`,
              "crit"
            );
          }
          theridine.currentHp = theridine.effectiveMaxHp;
        } else {
          theridine.customCounters.hpBarsRemaining =
            (theridine.customCounters.hpBarsRemaining ?? 16) - 1;
          const shieldGrant = Math.round(atkVal * 10);
          this.communalShields[enemyTeamId] =
            (this.communalShields[enemyTeamId] || 0) + shieldGrant;

          if (theridine.customCounters.hpBarsRemaining > 0) {
            theridine.currentHp = theridine.effectiveMaxHp;
            this.log(
              `👁️‍🗨️ [${theridine.name}] Godspawn HP Bar depleted (${theridine.customCounters.hpBarsRemaining}/16 bars remaining)! Heroes gain +${shieldGrant} Communal Shield!`,
              "special"
            );
          } else {
            theridine.currentHp = 0;
            this.handleUnitDeath(theridine, attacker);
            break;
          }
        }
      } else {
        theridine.currentHp -= dmgLeft;
        totalDealt += dmgLeft;
        dmgLeft = 0;
      }
    }
    return totalDealt;
  }

  checkZanderHpThresholds(zander, oldPct, newPct) {
    const thresholds = [75, 50, 25];
    if (!zander.customCounters.hpThresholdsTriggered) {
      zander.customCounters.hpThresholdsTriggered = {};
    }
    for (const th of thresholds) {
      if (
        oldPct >= th &&
        newPct < th &&
        !zander.customCounters.hpThresholdsTriggered[th]
      ) {
        zander.customCounters.hpThresholdsTriggered[th] = true;
        this.modifyTurnMeter(zander, -0.5, { bypassImmunity: true });
        const healAmt = Math.floor(zander.effectiveMaxHp * 0.25);
        this.getLivingEnemiesOf(zander).forEach((hero) => {
          hero.currentHp = Math.min(hero.effectiveMaxHp, hero.currentHp + healAmt);
        });
        this.log(
          `⏳ [${zander.name}] dropped below ${th}% HP! Genius's Foresight delays Zander's action by 50% and heals all heroes by ${healAmt} HP!`,
          "heal"
        );
      }
    }
  }

  enterZanderEvolution(zander) {
    this.transformUnitForm(zander, "evolution");
    zander.baseStats.spd = 150;
    zander.baseStats.def = -50;
    zander.baseStats.atk = 20;
    zander.abilityIds = ["foresights_rage", "almighty_immunity"];
    zander.customCounters.termination = 8;
    zander.customCounters.evolutionDamageTaken = 0;
    this.log(
      `⚛️ [${zander.name}] enters EVOLUTION STATE! (SPD: 150, DEF: -50, ATK: 20, Termination Counter = 8)!`,
      "crit"
    );
  }

  exitZanderEvolution(zander) {
    this.transformUnitForm(zander, "base");
    zander.baseStats.spd = 110;
    zander.baseStats.def = 40;
    zander.baseStats.atk = 10;
    zander.abilityIds = ["genius_foresight", "almighty_immunity"];
    zander.customCounters.transmutation = 0;
    zander.customCounters.evolutionDamageTaken = 0;
    this.log(
      `⏳ [${zander.name}] returns to Base Form! Transmutation Counter reset to 0.`,
      "special"
    );
  }

  dealTrueDamage(target, amount, sourceLabel = "True Damage") {
    return this.applyCalculatedDamage(target, amount, {
      bypassShieldsAndBlocks: false,
      sourceLabel,
    });
  }

  handleUnitDeath(target, killer) {
    target.currentHp = 0;
    target.turnMeter = 0;
    this.log(`☠️ ${target.name} has been defeated!`, "crit");

    for (const ab of this.getActiveAbilities(target)) {
      if (typeof ab.onDeath === "function") {
        ab.onDeath({ unit: target, killer, engine: this });
      }
    }

    const livingAllies = this.getLivingAlliesOf(target).filter(
      (a) => a.id !== target.id
    );
    for (const ally of livingAllies) {
      for (const ab of this.getActiveAbilities(ally)) {
        if (typeof ab.onAllyKilled === "function") {
          ab.onAllyKilled({ unit: ally, deadAlly: target, killer, engine: this });
        }
      }
    }

    if (target.isSummon) {
      const summonDef = Registry.getSummon(target.templateId);
      if (summonDef && typeof summonDef.onDestroy === "function") {
        summonDef.onDestroy({ summonUnit: target, killer, engine: this });
      }
    }

    this.checkWinCondition();
  }

  checkWinCondition() {
    const team1Alive = this.units.some(
      (u) => u.teamId === 1 && !u.isSummon && u.currentHp > 0
    );
    const team2Alive = this.units.some(
      (u) => u.teamId === 2 && !u.isSummon && u.currentHp > 0
    );

    if (!team1Alive && !team2Alive) {
      this.winnerTeam = "draw";
    } else if (!team2Alive) {
      this.winnerTeam = 1;
      this.log("🏆 VICTORY! The Strike Force triumphs!", "special");
    } else if (!team1Alive) {
      this.winnerTeam = 2;
      this.log("💀 DEFEAT! The Raid Boss prevails!", "crit");
    }
    return this.winnerTeam;
  }

  /**
   * Builds the full list of moves for `unit`, refreshing from `syncUnitActiveMoves(unit)`
   * and evaluating all declarative sequencing & prerequisite rules:
   * - `minOtherSkillsUsed`
   * - `requiresPreviousSkill`
   * - `forcesNextSkill` (`unit.forcedNextSkillId`)
   * - `cannotCastManually`
   */
  getAvailableMovesForUnit(unit) {
    if (!unit || unit.currentHp <= 0 || unit.isActionlessTotem) return [];

    // Always re-sync activeMoveIds from current form + upgrades so UI is never stale
    this.syncUnitActiveMoves(unit);

    const moveIds = [...(unit.activeMoveIds || []), "wait", "rest"];
    const hasZeroCostLink = this.statusManager.hasFlag(unit, "zeroEnergyCost");

    return moveIds
      .map((moveId) => {
        const skill = Registry.getSkill(moveId);
        if (!skill) return null;

        const cdRemaining = unit.cooldowns[moveId] || 0;
        const effectiveEnergyCost = hasZeroCostLink ? 0 : skill.energyCost || 0;
        let usable = true;
        let lockReason = "";
        const isForcedMove = unit.forcedNextSkillId === moveId;

        // 1. If the unit has a `forcedNextSkillId` (e.g. All Realms Leveled after Glory to All Honorable Dead),
        // ONLY the forced skill (or Wait/Rest if they need Energy) is allowed!
        if (
          unit.forcedNextSkillId &&
          moveId !== unit.forcedNextSkillId &&
          !skill.isUniversal
        ) {
          const forcedSkill = Registry.getSkill(unit.forcedNextSkillId);
          usable = false;
          lockReason = `Must use [${forcedSkill?.name || unit.forcedNextSkillId}] next!`;
        }

        // 2. Check `cannotCastManually` (e.g. Mode: Evolution, Cyclicity: α Scepter, For One is Holy)
        if (usable && skill.cannotCastManually && !isForcedMove) {
          usable = false;
          lockReason = "Triggered automatically by ability.";
        }

        // 3. Check `requiresPreviousSkill` (e.g. All Realms Leveled requires Glory to All Honorable Dead first;
        // Fallen Star's Eulogy requires Larval Evolution; Flectere requires Ten Thousand Years Silent)
        if (usable && skill.requiresPreviousSkill && !isForcedMove) {
          if (unit.lastNonUniversalSkillId !== skill.requiresPreviousSkill) {
            const reqSkill = Registry.getSkill(skill.requiresPreviousSkill);
            usable = false;
            lockReason = `Requires casting [${reqSkill?.name || skill.requiresPreviousSkill}] first.`;
          }
        }

        // 4. Check `minOtherSkillsUsed` (e.g. Glory to All Honorable Dead requires 3 other skills used first)
        if (usable && typeof skill.minOtherSkillsUsed === "number") {
          const used = unit.skillsUsedCount || 0;
          if (used < skill.minOtherSkillsUsed) {
            usable = false;
            lockReason = `Requires ${skill.minOtherSkillsUsed} skills used first (${used}/${skill.minOtherSkillsUsed}).`;
          }
        }

        // 5. Cooldown check
        if (usable && cdRemaining > 0) {
          usable = false;
          lockReason = `Cooldown: ${cdRemaining}T`;
        }

        // 6. Custom `canUse` hook
        if (usable && typeof skill.canUse === "function") {
          const check = skill.canUse({ attacker: unit, engine: this });
          if (!check.allowed) {
            usable = false;
            lockReason = check.reason;
          }
        }

        // 7. Energy check (checked last so prerequisite/sequence reasons are shown clearly first)
        if (usable && unit.currentEnergy < effectiveEnergyCost) {
          usable = false;
          lockReason = isForcedMove
            ? `Queued Next! Needs ${effectiveEnergyCost} Energy (Use Wait/Rest)`
            : `Needs ${effectiveEnergyCost} Energy`;
        }

        return {
          ...skill,
          energyCost: effectiveEnergyCost,
          usable,
          isForcedMove,
          lockReason,
          cdRemaining,
        };
      })
      .filter(Boolean);
  }

  advanceToNextTurn() {
    if (this.checkWinCondition()) {
      this.activeUnitId = null;
      return;
    }

    while (this.extraTurnQueue.length > 0) {
      const nextId = this.extraTurnQueue.shift();
      const extraUnit = this.getUnitById(nextId);
      if (extraUnit && extraUnit.currentHp > 0) {
        this.beginUnitTurn(extraUnit, { isExtraTurn: true });
        return;
      }
    }

    const combatants = this.units.filter(
      (u) => u.currentHp > 0 && !u.isActionlessTotem
    );
    if (combatants.length === 0) return;

    let safety = 0;
    while (safety++ < 500) {
      combatants.sort((a, b) => b.turnMeter - a.turnMeter);
      if (combatants[0].turnMeter >= 1000) {
        const nextActor = combatants[0];
        nextActor.turnMeter -= 1000;
        this.beginUnitTurn(nextActor, { isExtraTurn: false });
        return;
      }

      for (const u of combatants) {
        const spd = this.getEffectiveStats(u).spd;
        u.turnMeter += spd;
      }
    }
  }

  beginUnitTurn(unit, { isExtraTurn = false } = {}) {
    this.turnNumber += 1;
    this.activeUnitId = unit.id;

    if (unit.stance === "rest") {
      this.log(`${unit.name} recovers from Rest (full Defense restored).`, "info");
    }
    unit.stance = "normal";
    this.syncUnitActiveMoves(unit);

    for (const key of Object.keys(unit.cooldowns)) {
      if (unit.cooldowns[key] > 0) {
        unit.cooldowns[key] -= 1;
      }
    }

    // Zander Evolution State: Foresight's Rage Termination Counter
    if (unit.templateId === "first_genius_zander" && unit.form === "evolution") {
      unit.customCounters.termination = Math.max(
        0,
        (unit.customCounters.termination ?? 8) - 1
      );
      this.log(
        `⚛️ [${unit.name}] Termination Counter ticks down to ${unit.customCounters.termination}/8!`,
        "status"
      );
      if (unit.customCounters.termination === 0) {
        unit.forcedNextSkillId = "cyclicity_alpha_scepter";
      }
    }

    // Theridine Charging State: does not attack on normal turn while charging
    if (
      unit.templateId === "theridine_great_septimus" &&
      (unit.customCounters.chargingBarsRemaining || 0) > 0
    ) {
      this.log(
        `✨ [${unit.name}] is charging Im Anfang War die Tat (${unit.customCounters.chargingBarsRemaining} bars left, ${unit.customCounters.chargingReactionsLeft} reactions remaining)...`,
        "info"
      );
      this.statusManager.tickStatuses(unit, "TURN_END");
      this.advanceToNextTurn();
      return;
    }

    for (const ab of this.getActiveAbilities(unit)) {
      if (typeof ab.onTurnStart === "function") {
        ab.onTurnStart({ unit, isExtraTurn, engine: this });
      }
    }
    const item = this.getActiveItem(unit);
    if (item && typeof item.onTurnStart === "function") {
      item.onTurnStart({ unit, isExtraTurn, engine: this });
    }

    const shouldSkip =
      this.statusManager.hasFlag(unit, "skipTurn") &&
      !this.hasAbilityFlag(unit, "immuneToTurnSkip");

    this.statusManager.tickStatuses(unit, "TURN_START");

    if (unit.currentHp <= 0 || this.checkWinCondition()) {
      this.advanceToNextTurn();
      return;
    }

    if (shouldSkip) {
      this.log(`💫 ${unit.name} is incapacitated and skips their turn!`, "status");
      this.statusManager.tickStatuses(unit, "TURN_END");
      this.advanceToNextTurn();
    }
  }

  executeBonusHit({ attacker, target, element, stab, rawMultiplier, ignoreDefPct = 0, label }) {
    if (target.currentHp <= 0) return;
    const tempSkill = {
      id: "bonus_hit",
      name: label,
      element,
      stab,
      computeRawHit: ({ stats }) => stats.atk * rawMultiplier,
    };
    const { damage, isCrit } = this.damagePipeline.computeHitDamage({
      attacker,
      target,
      skill: tempSkill,
      ignoreDefPct,
    });
    this.applyCalculatedDamage(target, damage, {
      attacker,
      sourceLabel: `${label}${isCrit ? " 💥CRIT" : ""}`,
    });
  }

  executeCounterSkill(attacker, skillId) {
    if (attacker.currentHp <= 0 || this.winnerTeam) return;
    const skill = Registry.getSkill(skillId);
    if (!skill) return;
    this.runSkillResolution(attacker, skill, null, { isFreeCounter: true });
    this.syncUnitActiveMoves(attacker);
  }

  executeAction({ actorId, moveId, targetId = null }) {
    if (this.winnerTeam) return false;
    const attacker = this.getUnitById(actorId);
    if (!attacker || attacker.id !== this.activeUnitId) return false;

    const available = this.getAvailableMovesForUnit(attacker);
    const moveInfo = available.find((m) => m.id === moveId);
    if (!moveInfo || !moveInfo.usable) return false;

    const skill = Registry.getSkill(moveId);
    const energySpent = moveInfo.energyCost || 0;

    // Deduct Energy & Set Cooldown
    attacker.currentEnergy = Math.max(0, attacker.currentEnergy - energySpent);
    if (skill.cooldown) {
      attacker.cooldowns[skill.id] = skill.cooldown;
    }

    // Check Zander's Extrapolation: β Link trap
    if (this.statusManager.hasStatus(attacker, "extrapolation_link")) {
      this.statusManager.removeStatus(attacker, "extrapolation_link", {
        forceProtected: true,
      });
      if (!skill.isUniversal) {
        const massiveDmg = Math.max(1, Math.floor(attacker.effectiveMaxHp * 0.65));
        this.log(
          `⚡ ${attacker.name} triggered Zander's [Extrapolation: β Link] by casting [${skill.name}] instead of Wait/Rest!`,
          "crit"
        );
        this.dealTrueDamage(attacker, massiveDmg, "Extrapolation: β Link Backlash");
        if (attacker.currentHp <= 0) {
          this.advanceToNextTurn();
          return true;
        }
      }
    }

    // Declarative Skill Sequencing & Upgrade Tracking (Wait/Rest do not break skill chains!)
    if (!skill.isUniversal) {
      attacker.skillsUsedCount = (attacker.skillsUsedCount || 0) + 1;
      attacker.lastNonUniversalSkillId = skill.id;

      // Clear forcedNextSkillId if this was the forced skill
      if (attacker.forcedNextSkillId === skill.id) {
        attacker.forcedNextSkillId = null;
      }

      // If this skill declaratively forces a follow-up skill (e.g. Glory -> All Realms Leveled)
      if (skill.forcesNextSkill) {
        attacker.forcedNextSkillId = skill.forcesNextSkill;
        const nextSkillDef = Registry.getSkill(skill.forcesNextSkill);
        this.log(
          `⛓️ [${attacker.name}] next required skill queued: [${nextSkillDef?.name || skill.forcesNextSkill}]!`,
          "special"
        );
      }

      // If this skill declaratively upgrades a skill (e.g. Flectere upgrades Heart of Thorns -> Stars Shall Weep)
      if (skill.upgradesSkill && skill.upgradesSkill.from && skill.upgradesSkill.to) {
        if (!attacker.skillUpgrades) attacker.skillUpgrades = {};
        attacker.skillUpgrades[skill.upgradesSkill.from] = skill.upgradesSkill.to;
      }

      // First Genius, Zander: Genius's Foresight Transmutation Counter
      const enemyZander = this.getLivingEnemiesOf(attacker).find(
        (e) => e.templateId === "first_genius_zander" && e.form === "base"
      );
      if (enemyZander && energySpent > 0) {
        enemyZander.customCounters.transmutation =
          (enemyZander.customCounters.transmutation || 0) + energySpent;
        this.log(
          `⏳ [${enemyZander.name}] Transmutation Counter +${energySpent} -> ${enemyZander.customCounters.transmutation}/600.`,
          "info"
        );
        if (enemyZander.customCounters.transmutation >= 600) {
          enemyZander.customCounters.transmutation = 0;
          this.log(
            `⚛️ [${enemyZander.name}] Transmutation Counter reached 600! Granted an Instant Turn to activate [Mode: Evolution]!`,
            "crit"
          );
          this.enterZanderEvolution(enemyZander);
          this.grantExtraTurn(enemyZander);
        }
      }
    }

    this.runSkillResolution(attacker, skill, targetId, { isFreeCounter: false });

    // Re-sync active moves & avatar after skill execution (handles Metamorph, Evolution, Stars Shall Weep upgrade)
    this.syncUnitActiveMoves(attacker);

    for (const ab of this.getActiveAbilities(attacker)) {
      if (typeof ab.onTurnEnd === "function") {
        ab.onTurnEnd({ unit: attacker, engine: this });
      }
    }
    this.statusManager.tickStatuses(attacker, "TURN_END");

    // Check Theridine's Im Anfang War die Tat immediate post-enemy action
    const enemyTheridine = this.getLivingEnemiesOf(attacker).find(
      (e) =>
        e.templateId === "theridine_great_septimus" &&
        (e.customCounters.chargingBarsRemaining || 0) > 0
    );
    if (enemyTheridine && enemyTheridine.currentHp > 0) {
      enemyTheridine.customCounters.chargingReactionsLeft -= 1;
      const left = enemyTheridine.customCounters.chargingReactionsLeft;
      this.log(
        `👁️‍🗨️ [${enemyTheridine.name}] reacts after ${attacker.name}'s turn (${7 - left}/7 actions elapsed, ${enemyTheridine.customCounters.chargingBarsRemaining} Charging Bars left)!`,
        "special"
      );
      if (left <= 0) {
        enemyTheridine.customCounters.chargingBarsRemaining = 0;
        this.log(
          `🌟 [${enemyTheridine.name}] completes Im Anfang War die Tat charging and unleashes [FOR ONE IS HOLY]!`,
          "crit"
        );
        this.executeCounterSkill(enemyTheridine, "for_one_is_holy");
      }
    }

    this.checkWinCondition();
    if (!this.winnerTeam) {
      this.advanceToNextTurn();
    } else {
      this.activeUnitId = null;
    }

    return true;
  }

  runSkillResolution(attacker, skill, targetId, { isFreeCounter = false } = {}) {
    if (typeof skill.onBeforeSkill === "function") {
      skill.onBeforeSkill({ attacker, engine: this });
    }

    let targets = [];
    if (skill.targetType === "self") {
      targets = [attacker];
    } else if (skill.targetType === "all_allies") {
      targets = this.getLivingAlliesOf(attacker);
    } else if (skill.targetType === "all_enemies") {
      targets = this.getLivingEnemiesOf(attacker);
    } else if (skill.targetType === "single_enemy") {
      const chosen =
        this.getUnitById(targetId) || this.getLivingEnemiesOf(attacker)[0];
      if (chosen && chosen.currentHp > 0) {
        targets = [chosen];
      }
    }

    if (typeof skill.execute === "function" && !skill.computeRawHit) {
      skill.execute({ attacker, targets, engine: this });
    } else if (skill.computeRawHit) {
      if (!isFreeCounter) {
        this.log(`⚔️ ${attacker.name} uses [${skill.name}]!`, "info");
      }

      const attackedDefendersThisSkill = new Set();

      for (const target of targets) {
        if (target.currentHp <= 0) continue;

        if (!skill.undodgeable && skill.accuracy !== null && skill.accuracy < 100) {
          const accBonus = this.getEffectiveStats(attacker).accuracyBonus || 0;
          const effectiveAcc = Math.min(100, skill.accuracy + accBonus);
          if (this.rng() * 100 > effectiveAcc) {
            this.log(`💨 ${attacker.name}'s [${skill.name}] missed ${target.name}!`, "info");
            continue;
          }
        }

        if (typeof skill.onBeforeAttack === "function") {
          skill.onBeforeAttack({ attacker, target, engine: this });
        }

        const hits =
          typeof skill.getDynamicHitCount === "function"
            ? skill.getDynamicHitCount({ attacker, target, engine: this })
            : skill.hits || 1;

        let totalDamageToTarget = 0;

        const bypassShieldsAndBlocks =
          this.getActiveAbilities(attacker).some((a) => a.id === "lethal_lava") &&
          this.statusManager.hasStatus(target, "hex");

        for (let h = 0; h < hits; h++) {
          if (target.currentHp <= 0) break;

          const ignoreDefPct =
            typeof skill.getIgnoreDefPct === "function"
              ? skill.getIgnoreDefPct({ attacker, target, hitIndex: h, engine: this })
              : 0;

          const { damage, isCrit, ignoredDefPct } =
            this.damagePipeline.computeHitDamage({
              attacker,
              target,
              skill,
              ignoreDefPct,
              hitIndex: h,
            });

          const dealt = this.applyCalculatedDamage(target, damage, {
            attacker,
            bypassShieldsAndBlocks,
          });
          totalDamageToTarget += dealt;
          attackedDefendersThisSkill.add(target);

          if (this.statusManager.hasFlag(target, "removeOnDamage")) {
            this.statusManager.removeStatus(target, "sleep");
          }

          const critTag = isCrit ? " 💥CRIT!" : "";
          const ignoreTag = ignoredDefPct > 0 ? ` (Ignored ${ignoredDefPct}% DEF)` : "";
          const hitTag = hits > 1 ? ` [Hit ${h + 1}/${hits}]` : "";
          this.log(
            `🎯 ${attacker.name} -> ${target.name}: ${dealt} DMG${critTag}${ignoreTag}${hitTag}`,
            isCrit ? "crit" : "damage"
          );

          if (typeof skill.onEachHit === "function") {
            skill.onEachHit({ attacker, target, hitIndex: h, engine: this });
          }

          if (target.currentHp <= 0) {
            if (typeof skill.onTargetKilled === "function") {
              skill.onTargetKilled({ attacker, target, engine: this });
            }
          }
        }

        if (totalDamageToTarget > 0) {
          if (typeof skill.onAfterHit === "function") {
            skill.onAfterHit({
              attacker,
              target,
              totalDamageToTarget,
              engine: this,
            });
          }
          const atkItem = this.getActiveItem(attacker);
          if (atkItem && typeof atkItem.onAfterDealDamage === "function") {
            atkItem.onAfterDealDamage({
              attacker,
              target,
              damageDealt: totalDamageToTarget,
              engine: this,
            });
          }
        }
      }

      this.recalculateSoulSpearDestruction();

      if (!isFreeCounter) {
        for (const defender of attackedDefendersThisSkill) {
          for (const ab of this.getActiveAbilities(defender)) {
            if (typeof ab.onAfterSkillAttacked === "function") {
              ab.onAfterSkillAttacked({ attacker, defender, skill, engine: this });
            }
          }
        }
      }

      if (typeof skill.onAfterSkill === "function") {
        skill.onAfterSkill({ attacker, targets, engine: this });
      }
    }
  }

  /**
   * Smart AI for Bosses & Minions (Respects `forcedNextSkillId`, `minOtherSkillsUsed`, and `requiresPreviousSkill`)
   */
  computeAiAction(unit) {
    if (!unit || unit.currentHp <= 0) return null;
    const allMoves = this.getAvailableMovesForUnit(unit);
    const usableMoves = allMoves.filter((m) => m.usable);
    const enemies = this.getLivingEnemiesOf(unit);
    if (enemies.length === 0 || usableMoves.length === 0) return null;

    const hexTarget = enemies.find((e) => this.statusManager.hasStatus(e, "hex"));
    const lowestHpTarget = [...enemies].sort((a, b) => a.currentHp - b.currentHp)[0];
    const defaultTarget = hexTarget || lowestHpTarget || enemies[0];

    // 1. If a skill is forced next (e.g. All Realms Leveled after Glory to All Honorable Dead),
    // cast it immediately if usable, or Rest/Wait to build Energy for it!
    if (unit.forcedNextSkillId) {
      const forcedUsable = usableMoves.find((m) => m.id === unit.forcedNextSkillId);
      if (forcedUsable) {
        return { actorId: unit.id, moveId: forcedUsable.id, targetId: defaultTarget.id };
      }
      const energyMove = unit.currentHp > unit.effectiveMaxHp * 0.5 ? "rest" : "wait";
      return { actorId: unit.id, moveId: energyMove, targetId: unit.id };
    }

    // 2. If a setup skill (that forces a sequel, like Glory to All Honorable Dead, Larval Evolution, Ten Thousand Years Silent)
    // is unlocked and usable, prioritize casting it!
    const setupSkills = usableMoves.filter((m) => Boolean(m.forcesNextSkill));
    if (setupSkills.length > 0) {
      return {
        actorId: unit.id,
        moveId: setupSkills[0].id,
        targetId: defaultTarget.id,
      };
    }

    // 3. Other Boss Signature Moves
    const priorityIds = [
      "im_anfang_war_die_tat",
      "walker_among_graves",
      "hexreaper",
      "extrapolation_beta_link",
    ];
    for (const pid of priorityIds) {
      const found = usableMoves.find((m) => m.id === pid);
      if (found && this.rng() < 0.75) {
        return { actorId: unit.id, moveId: found.id, targetId: defaultTarget.id };
      }
    }

    const combatMoves = usableMoves.filter((m) => !m.isUniversal);
    if (combatMoves.length === 0) {
      const energyMove = unit.currentHp > unit.effectiveMaxHp * 0.6 ? "rest" : "wait";
      return { actorId: unit.id, moveId: energyMove, targetId: unit.id };
    }

    const chosen = combatMoves[Math.floor(this.rng() * combatMoves.length)];
    return {
      actorId: unit.id,
      moveId: chosen.id,
      targetId: defaultTarget.id,
    };
  }

  serializeState() {
    return JSON.parse(
      JSON.stringify({
        mode: this.mode,
        seed: this.seed,
        turnNumber: this.turnNumber,
        activeUnitId: this.activeUnitId,
        extraTurnQueue: this.extraTurnQueue,
        winnerTeam: this.winnerTeam,
        communalShields: this.communalShields,
        units: this.units,
        logs: this.logs,
      })
    );
  }

  hydrateState(snapshot) {
    this.mode = snapshot.mode;
    this.seed = snapshot.seed;
    this.turnNumber = snapshot.turnNumber;
    this.activeUnitId = snapshot.activeUnitId;
    this.extraTurnQueue = snapshot.extraTurnQueue || [];
    this.winnerTeam = snapshot.winnerTeam;
    this.communalShields = snapshot.communalShields || { 1: 0, 2: 0 };
    this.units = snapshot.units || [];
    this.units.forEach((u) => this.syncUnitActiveMoves(u));
    this.logs = snapshot.logs || [];
  }
}
