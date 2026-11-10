/**
 * BattleEngine
 * Core turn-based combat engine supporting:
 * - Multi-character squads (e.g. 5 Heroes vs Antikhonor Raid Boss + Summoned Soul Spears, or PvP Squads)
 * - Speed-based Turn Meter system (1000 TM threshold, Action Delay, Extra Turns)
 * - Seeded PRNG for deterministic WebRTC lockstep or Host-Authoritative state sync
 * - Full implementation of Karnage the Anarch & Antikhonor, Broken God mechanics
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
  constructor({ mode = "raid_boss", seed = Date.now(), team1Config = [], team2Config = [] } = {}) {
    this.mode = mode; // "raid_boss" | "pvp_custom"
    this.seed = seed;
    this.rng = createSeededRng(seed);
    this.turnNumber = 0;
    this.units = [];
    this.activeUnitId = null;
    this.extraTurnQueue = [];
    this.winnerTeam = null;
    this.logs = [];
    this.nextInstanceCounter = 1;

    this.statusManager = new StatusManager(this);
    this.damagePipeline = new DamagePipeline(this);

    this.initTeams(team1Config, team2Config);
  }

  log(message, type = "info") {
    const entry = {
      id: `${this.turnNumber}-${this.logs.length + 1}`,
      turn: this.turnNumber,
      message,
      type,
    };
    this.logs.push(entry);
    if (this.logs.length > 150) {
      this.logs.shift();
    }
  }

  initTeams(team1Config, team2Config) {
    team1Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 1, cfg.itemId));
    team2Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 2, cfg.itemId));

    this.log("⚔️ Battle Commences!", "special");

    // Trigger onBattleStart hooks for abilities and items
    for (const unit of this.units) {
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

    const instanceId = `${characterId}_${this.nextInstanceCounter++}`;
    const unit = {
      id: instanceId,
      templateId: template.id,
      teamId,
      name: template.name,
      title: template.title || "",
      role: template.role || "",
      isBoss: Boolean(template.isBoss),
      isSummon: false,
      form: "base",
      forms: template.forms,
      avatar: template.forms.base.avatar || template.avatar,
      types: [...(template.types || [])],
      speciesId: template.speciesId,
      itemId: customItemId ?? template.defaultItemId ?? "none",
      abilityIds: [...(template.abilityIds || [])],

      baseMaxHp: template.stats.hp,
      destroyedHpPct: 0,
      effectiveMaxHp: template.stats.hp,
      currentHp: template.stats.hp,

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
      stance: "normal", // "normal" | "wait" | "rest"
      skillsUsedCount: 0,
      forcedNextSkillId: null,
      blockRevive: false,
      cooldowns: {},
      statuses: [],
    };

    this.units.push(unit);
    return unit;
  }

  summonSoulSpear(summoner, targetHero) {
    const summonDef = Registry.getSummon("soul_spear");
    // Remove existing Soul Spear linked to the same hero if any
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
      avatar: summonDef.avatar,
      types: summonDef.types,
      speciesId: summonDef.speciesId,
      itemId: "none",
      abilityIds: [],

      baseMaxHp: spearMaxHp,
      destroyedHpPct: 0,
      effectiveMaxHp: spearMaxHp,
      currentHp: spearMaxHp,
      maxEnergy: 0,
      currentEnergy: 0,
      baseStats: {
        atk: 0,
        def: 0,
        spd: 0,
        critRate: 0,
        critDmg: 0,
      },
      turnMeter: 0,
      stance: "normal",
      skillsUsedCount: 0,
      forcedNextSkillId: null,
      blockRevive: true,
      cooldowns: {},
      statuses: [],
    };

    this.units.push(spearUnit);
    return spearUnit;
  }

  /**
   * "When a Soul Spear is active, destroys the MAX HP of the character it is tied to
   * by 1% for every 2% HP that the Soul Spear has."
   */
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
    if (deltaFraction < 0 && !bypassImmunity) {
      if (this.hasAbilityFlag(unit, "immuneToTurnMeterReduction")) {
        this.log(
          `🛡️ ${unit.name} is immune to Turn Meter reduction!`,
          "info"
        );
        return;
      }
    }
    if (deltaFraction > 0 && this.statusManager.hasFlag(unit, "blockBonusTurnMeter")) {
      this.log(`⛓️ ${unit.name}'s [Seal] prevents bonus Turn Meter gain!`, "status");
      return;
    }
    unit.turnMeter = Math.max(0, unit.turnMeter + Math.round(deltaFraction * 1000));
  }

  grantExtraTurn(unit) {
    if (unit.currentHp > 0) {
      this.extraTurnQueue.unshift(unit.id);
    }
  }

  dealTrueDamage(target, amount, sourceLabel = "True Damage") {
    if (target.currentHp <= 0 || amount <= 0) return 0;
    const actual = Math.min(target.currentHp, Math.max(1, Math.round(amount)));
    target.currentHp -= actual;
    this.log(`💥 ${target.name} takes ${actual} damage from ${sourceLabel}!`, "damage");
    if (target.currentHp <= 0) {
      this.handleUnitDeath(target, null);
    }
    return actual;
  }

  handleUnitDeath(target, killer) {
    target.currentHp = 0;
    target.turnMeter = 0;
    this.log(`☠️ ${target.name} has been defeated!`, "crit");

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
      this.log("🏆 VICTORY! Team 1 triumphs!", "special");
    } else if (!team1Alive) {
      this.winnerTeam = 2;
      this.log("💀 DEFEAT! Team 2 triumphs!", "crit");
    }
    return this.winnerTeam;
  }

  getAvailableMovesForUnit(unit) {
    if (!unit || unit.currentHp <= 0) return [];
    const formObj = unit.forms[unit.form] || unit.forms.base;
    const moveIds = [...formObj.moves, "wait", "rest"];

    return moveIds.map((moveId) => {
      const skill = Registry.getSkill(moveId);
      const cdRemaining = unit.cooldowns[moveId] || 0;
      let usable = true;
      let lockReason = "";

      // Check forced skill (Antikhonor's All Realms Leveled after Glory to All Honorable Dead)
      if (
        unit.forcedNextSkillId &&
        moveId !== unit.forcedNextSkillId &&
        moveId !== "wait" &&
        moveId !== "rest"
      ) {
        const forcedSkill = Registry.getSkill(unit.forcedNextSkillId);
        // Only force if the unit has enough energy for the forced skill
        if (unit.currentEnergy >= (forcedSkill?.energyCost || 0)) {
          usable = false;
          lockReason = `Must use ${forcedSkill.name} next!`;
        }
      }

      if (usable && cdRemaining > 0) {
        usable = false;
        lockReason = `Cooldown: ${cdRemaining}T`;
      }

      if (usable && unit.currentEnergy < (skill.energyCost || 0)) {
        usable = false;
        lockReason = `Needs ${skill.energyCost} Energy`;
      }

      if (usable && typeof skill.canUse === "function") {
        const check = skill.canUse({ attacker: unit, engine: this });
        if (!check.allowed) {
          usable = false;
          lockReason = check.reason;
        }
      }

      return {
        ...skill,
        usable,
        lockReason,
        cdRemaining,
      };
    });
  }

  advanceToNextTurn() {
    if (this.checkWinCondition()) {
      this.activeUnitId = null;
      return;
    }

    // 1. Check Extra Turn Queue first
    while (this.extraTurnQueue.length > 0) {
      const nextId = this.extraTurnQueue.shift();
      const extraUnit = this.getUnitById(nextId);
      if (extraUnit && extraUnit.currentHp > 0) {
        this.beginUnitTurn(extraUnit, { isExtraTurn: true });
        return;
      }
    }

    // 2. Tick Turn Meters until at least one active combatant reaches >= 1000
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

    // "Defense reduction lasts until the turn comes back to you."
    if (unit.stance === "rest") {
      this.log(`${unit.name} recovers from Rest (full Defense restored).`, "info");
    }
    unit.stance = "normal";
    unit.avatar = (unit.forms[unit.form] || unit.forms.base).avatar;

    // Tick cooldowns down by 1 at turn start
    for (const key of Object.keys(unit.cooldowns)) {
      if (unit.cooldowns[key] > 0) {
        unit.cooldowns[key] -= 1;
      }
    }

    // Ability & Item onTurnStart hooks (e.g., Antikhonor's Master of Legions War Armor reset to 8)
    for (const ab of this.getActiveAbilities(unit)) {
      if (typeof ab.onTurnStart === "function") {
        ab.onTurnStart({ unit, isExtraTurn, engine: this });
      }
    }
    const item = this.getActiveItem(unit);
    if (item && typeof item.onTurnStart === "function") {
      item.onTurnStart({ unit, isExtraTurn, engine: this });
    }

    // Tick TURN_START statuses (Bleed, Burn, Stun, Sleep, Freeze)
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

  executeAction({ actorId, moveId, targetId = null }) {
    if (this.winnerTeam) return false;
    const attacker = this.getUnitById(actorId);
    if (!attacker || attacker.id !== this.activeUnitId) return false;

    const available = this.getAvailableMovesForUnit(attacker);
    const moveInfo = available.find((m) => m.id === moveId);
    if (!moveInfo || !moveInfo.usable) return false;

    const skill = Registry.getSkill(moveId);

    // Deduct Energy & Set Cooldown
    attacker.currentEnergy = Math.max(0, attacker.currentEnergy - (skill.energyCost || 0));
    if (skill.cooldown) {
      attacker.cooldowns[skill.id] = skill.cooldown;
    }

    // Track skill usage count for prerequisites (e.g. Glory to All Honorable Dead)
    if (!skill.isUniversal) {
      attacker.skillsUsedCount += 1;
      if (attacker.forcedNextSkillId === skill.id) {
        attacker.forcedNextSkillId = null;
      }
    }

    // Resolve Targets
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

    // Status/Utility execution vs Attack execution
    if (typeof skill.execute === "function" && !skill.computeRawHit) {
      skill.execute({ attacker, targets, engine: this });
    } else if (skill.computeRawHit) {
      this.log(`⚔️ ${attacker.name} uses [${skill.name}]!`, "info");

      const attackedDefendersThisSkill = new Set();

      for (const target of targets) {
        if (target.currentHp <= 0) continue;

        // Accuracy Check (unless undodgeable)
        if (!skill.undodgeable && skill.accuracy !== null && skill.accuracy < 100) {
          const accBonus = this.getEffectiveStats(attacker).accuracyBonus || 0;
          const effectiveAcc = Math.min(100, skill.accuracy + accBonus);
          if (this.rng() * 100 > effectiveAcc) {
            this.log(`💨 ${attacker.name}'s [${skill.name}] missed ${target.name}!`, "info");
            continue;
          }
        }

        // Before-Attack Hook (e.g., Anarchic Realm HP Swap)
        if (typeof skill.onBeforeAttack === "function") {
          skill.onBeforeAttack({ attacker, target, engine: this });
        }

        const hits =
          typeof skill.getDynamicHitCount === "function"
            ? skill.getDynamicHitCount({ attacker, target, engine: this })
            : skill.hits || 1;

        const ignoreDefPct =
          typeof skill.getIgnoreDefPct === "function"
            ? skill.getIgnoreDefPct({ attacker, target, engine: this })
            : 0;

        let totalDamageToTarget = 0;

        for (let h = 0; h < hits; h++) {
          if (target.currentHp <= 0) break;

          const { damage, isCrit, ignoredDefPct } =
            this.damagePipeline.computeHitDamage({
              attacker,
              target,
              skill,
              ignoreDefPct,
            });

          target.currentHp = Math.max(0, target.currentHp - damage);
          totalDamageToTarget += damage;
          attackedDefendersThisSkill.add(target);

          // Wake up from Sleep on direct damage
          if (this.statusManager.hasFlag(target, "removeOnDamage")) {
            this.statusManager.removeStatus(target, "sleep");
          }

          const critTag = isCrit ? " 💥CRIT!" : "";
          const ignoreTag = ignoredDefPct > 0 ? ` (Ignored ${ignoredDefPct}% DEF)` : "";
          const hitTag = hits > 1 ? ` [Hit ${h + 1}/${hits}]` : "";
          this.log(
            `🎯 ${attacker.name} -> ${target.name}: ${damage} DMG${critTag}${ignoreTag}${hitTag}`,
            isCrit ? "crit" : "damage"
          );

          // Per-hit hook (e.g. Trinity of Pain debuffs, Crimson Rend bleed)
          if (typeof skill.onEachHit === "function") {
            skill.onEachHit({ attacker, target, hitIndex: h, engine: this });
          }

          if (target.currentHp <= 0) {
            if (typeof skill.onTargetKilled === "function") {
              skill.onTargetKilled({ attacker, target, engine: this });
            }
            this.handleUnitDeath(target, attacker);
          }
        }

        // Post-target hit hook
        if (totalDamageToTarget > 0) {
          if (typeof skill.onAfterHit === "function") {
            skill.onAfterHit({ attacker, target, engine: this });
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

      // Update Soul Spear HP Destruction if any Soul Spear was damaged
      this.recalculateSoulSpearDestruction();

      // Trigger Defender "Once-Per-Skill" Passive Hooks (e.g. Antikhonor's Master of Legions War Armor & Glory)
      for (const defender of attackedDefendersThisSkill) {
        for (const ab of this.getActiveAbilities(defender)) {
          if (typeof ab.onAfterSkillAttacked === "function") {
            ab.onAfterSkillAttacked({ attacker, defender, skill, engine: this });
          }
        }
      }
    }

    // End of Turn Hooks & Status Ticking
    attacker.avatar = (attacker.forms[attacker.form] || attacker.forms.base).avatar;
    for (const ab of this.getActiveAbilities(attacker)) {
      if (typeof ab.onTurnEnd === "function") {
        ab.onTurnEnd({ unit: attacker, engine: this });
      }
    }
    this.statusManager.tickStatuses(attacker, "TURN_END");

    this.checkWinCondition();
    if (!this.winnerTeam) {
      this.advanceToNextTurn();
    } else {
      this.activeUnitId = null;
    }

    return true;
  }

  /**
   * Smart AI for Bosses (Antikhonor) or Single-Player / Co-op Raid Mode
   */
  computeAiAction(unit) {
    if (!unit || unit.currentHp <= 0) return null;
    const moves = this.getAvailableMovesForUnit(unit).filter((m) => m.usable);
    const enemies = this.getLivingEnemiesOf(unit);
    if (enemies.length === 0 || moves.length === 0) return null;

    // 1. If forced next skill (e.g. All Realms Leveled) is usable, prioritize it immediately
    if (unit.forcedNextSkillId) {
      const forced = moves.find((m) => m.id === unit.forcedNextSkillId);
      if (forced) {
        return { actorId: unit.id, moveId: forced.id, targetId: enemies[0].id };
      }
      // If not enough energy for forced skill, Rest or Wait
      const restMove = moves.find((m) => m.id === "rest");
      if (restMove) return { actorId: unit.id, moveId: "rest", targetId: unit.id };
    }

    // 2. If Glory to All Honorable Dead is ready and no Soul Spears are active, cast it!
    const glorySkill = moves.find((m) => m.id === "glory_to_all_honorable_dead");
    const activeSpears = this.units.filter((u) => u.isSummon && u.currentHp > 0);
    if (glorySkill && activeSpears.length === 0) {
      return { actorId: unit.id, moveId: glorySkill.id, targetId: enemies[0].id };
    }

    // 3. Filter non-universal combat moves
    const combatMoves = moves.filter((m) => !m.isUniversal);
    if (combatMoves.length === 0) {
      const energyMove = unit.currentHp > unit.effectiveMaxHp * 0.6 ? "rest" : "wait";
      return { actorId: unit.id, moveId: energyMove, targetId: unit.id };
    }

    // Pick highest impact move or cycle
    const preferred =
      combatMoves.find((m) => m.id === "all_realms_leveled") ||
      combatMoves.find((m) => m.id === "pyre_of_high_graves") ||
      combatMoves[Math.floor(this.rng() * combatMoves.length)];

    // Pick lowest HP enemy target
    const sortedTargets = [...enemies].sort((a, b) => a.currentHp - b.currentHp);
    return {
      actorId: unit.id,
      moveId: preferred.id,
      targetId: sortedTargets[0].id,
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
    this.units = snapshot.units;
    this.logs = snapshot.logs || [];
  }
}
