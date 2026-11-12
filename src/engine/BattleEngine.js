/**
 * BattleEngine (Emoji-free + Condensed Multi-Hit Combat Readouts)
 *
 * Multi-hit skills (e.g. Sufferslash x2, Trinity of Pain x3, Pyre of High Graves x3, For One is Holy x7)
 * now combine their per-hit calculations into a single concise log line per target:
 *   e.g. "Karnage the Anarch [Trinity of Pain] -> Antikhonor: 63 DMG (3 hits: 21 + 21 + 21)"
 */

import { Registry } from "./Registry.js";
import { StatusManager } from "./StatusManager.js?v=13";
import { DamagePipeline } from "./DamagePipeline.js?v=13";

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
    this.roundNumber = 1;
    this.actedInCurrentRound = [];
    this.units = [];
    this.activeUnitId = null;
    this.extraTurnQueue = [];
    this.winnerTeam = null;
    this.logs = [];
    this.nextInstanceCounter = 1;

    this.communalShields = { 1: 0, 2: 0 };
    this._resolutionStack = [];
    this._winOutcomeLogged = false;
    this._inNextTurnPhase = false;

    this.statusManager = new StatusManager(this);
    this.damagePipeline = new DamagePipeline(this);

    if (team1Config.length > 0 || team2Config.length > 0) {
      this.initTeams(team1Config, team2Config);
    }
  }

  currentResolutionFrame() {
    return this._resolutionStack.length > 0
      ? this._resolutionStack[this._resolutionStack.length - 1]
      : null;
  }

  log(
    message,
    type = "info",
    {
      isSkill = false,
      isPrimaryAttack = false,
      isMatchOutcome = false,
      priority = undefined,
    } = {}
  ) {
    const lastEntry = this.logs[this.logs.length - 1];
    if (
      lastEntry &&
      lastEntry.turn === this.turnNumber &&
      lastEntry.message === message
    ) {
      return;
    }

    const entry = {
      id: `${this.turnNumber}-${this.logs.length + 1}`,
      turn: this.turnNumber,
      message,
      type,
      isSkill: Boolean(isSkill),
      isPrimaryAttack: Boolean(isPrimaryAttack),
      isMatchOutcome: Boolean(isMatchOutcome),
      isNextTurnPhase: Boolean(this._inNextTurnPhase),
      priority,
    };
    this.logs.push(entry);
    if (this.logs.length > 220) {
      this.logs.shift();
    }
  }

  getLogPriority(entry) {
    if (typeof entry.priority === "number") return entry.priority;
    if (entry.type === "next_turn" || entry.isNextTurnPhase) return 6;
    if (entry.type === "final_result" || entry.isMatchOutcome) return 5;
    if (entry.isSkill && entry.isPrimaryAttack) return 1;
    if (entry.type === "passive") return 2;
    if (entry.isSkill) return 3;
    return 4;
  }

  finalizeTurnLogs(startIndex) {
    if (startIndex < 0 || startIndex >= this.logs.length) return;
    const rawEntries = this.logs.splice(startIndex);
    const deduped = [];
    const seen = new Set();

    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i];
      const dedupKey = `${entry.turn}::${entry.message}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      entry._seq = i;
      deduped.push(entry);
    }

    deduped.sort((a, b) => {
      const pa = this.getLogPriority(a);
      const pb = this.getLogPriority(b);
      if (pa !== pb) return pa - pb;
      return a._seq - b._seq;
    });

    for (const entry of deduped) {
      delete entry._seq;
      this.logs.push(entry);
    }
  }

  logPassive(message) {
    const formatted = message.startsWith("[Passive]")
      ? message
      : `[Passive] ${message}`;
    const frame = this.currentResolutionFrame();
    if (frame && frame.phase === "attack") {
      frame.passiveLogs.push(formatted);
    } else {
      this.log(formatted, "passive", { isSkill: false });
    }
  }

  queueFollowUpAttack(fn, { category = "counterattack", dedupKey = null } = {}) {
    const frame = this.currentResolutionFrame();
    if (frame && (frame.phase === "attack" || frame.phase === "passive")) {
      if (dedupKey) {
        if (frame.dedupKeys.has(dedupKey)) return;
        frame.dedupKeys.add(dedupKey);
      }
      frame.followUpQueue.push({ fn, category });
    } else {
      fn();
    }
  }

  initTeams(team1Config, team2Config) {
    team1Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 1, cfg.itemId));
    team2Config.forEach((cfg) => this.spawnCharacter(cfg.characterId, 2, cfg.itemId));

    this.log("Battle Commences.", "special");

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
      isBossSummon: Boolean(template.id === "swarm_spawn" || template.isSummon),
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
      magmaShieldHp: 0,

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
      skillUpgrades: {},
      blockRevive: false,
      cooldowns: {},
      statuses: [],
      customCounters: {},
    };

    this.units.push(unit);
    return unit;
  }

  transformUnitForm(unit, newFormKey) {
    if (!unit) return;
    const targetForm =
      unit.forms?.[newFormKey] ||
      Registry.getCharacter(unit.templateId)?.forms?.[newFormKey];
    if (!targetForm) return;

    const oldForm = unit.form;
    unit.form = newFormKey;
    unit.forms[newFormKey] = JSON.parse(JSON.stringify(targetForm));
    unit.avatar = targetForm.avatar || unit.avatar;
    this.syncUnitActiveMoves(unit);

    // Marius the Gallant's Steadfast Knight: counterattack with [Auric Lance] when an enemy switches Forms
    if (oldForm !== newFormKey) {
      const opposingMariusList = this.getLivingEnemiesOf(unit).filter((e) =>
        this.hasAbilityFlag(e, "counterOnEnemyFormSwitch")
      );
      for (const marius of opposingMariusList) {
        this.logPassive(
          `[${marius.name}] Steadfast Knight reacts to ${unit.name} switching Forms and counterattacks with [Auric Lance]!`
        );
        this.executeCounterSkill(marius, "auric_lance", unit.id);
      }
    }
  }

  getTotalEnemyBloodDue(unit) {
    return this.getLivingEnemiesOf(unit).reduce(
      (sum, e) => sum + this.statusManager.getStacks(e, "blood_due"),
      0
    );
  }

  addBloodDueStack(source, target, count = 1) {
    if (!target || target.currentHp <= 0 || count <= 0) return 0;
    const enemies = this.units.filter(
      (u) => u.teamId === target.teamId && u.currentHp > 0
    );
    const currentTotal = enemies.reduce(
      (sum, u) => sum + this.statusManager.getStacks(u, "blood_due"),
      0
    );
    const roomLeft = Math.max(0, 15 - currentTotal);
    const toAdd = Math.min(roomLeft, count);
    if (toAdd <= 0) return 0;

    this.statusManager.applyStatus(source, target, "blood_due", {
      stacks: toAdd,
      isProtected: true,
    });
    return toAdd;
  }

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
      isBossSummon: true,
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
      magmaShieldHp: 0,
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
        this.logPassive(`${unit.name} is immune to Turn Meter reduction.`);
        if (this.hasAbilityFlag(unit, "counterOnSpdDownAttempt")) {
          const activeActor = this.getUnitById(this.activeUnitId);
          if (activeActor && activeActor.teamId !== unit.teamId && activeActor.currentHp > 0) {
            this.logPassive(
              `[${unit.name}] Steadfast Knight triggers against Turn Meter reduction attempt and counterattacks with [Auric Lance]!`
            );
            this.executeCounterSkill(unit, "auric_lance", activeActor.id);
          }
        }
        return;
      }
      const mult = this.getAbilityFlagValue(unit, "turnMeterReductionMultiplier");
      if (mult !== null) {
        effectiveFraction *= mult;
        this.logPassive(
          `${unit.name}'s Molten Immunity reduces Turn Meter reduction by 50%.`
        );
      }
    }

    if (effectiveFraction > 0 && this.statusManager.hasFlag(unit, "blockBonusTurnMeter")) {
      this.log(`${unit.name}'s [Seal] prevents bonus Turn Meter gain.`, "status");
      return;
    }

    unit.turnMeter = Math.max(
      0,
      unit.turnMeter + Math.round(effectiveFraction * 1000)
    );
  }

  fillTurnMeter(unit, amount) {
    if (!unit || !Number.isFinite(amount)) return;
    const fraction = Math.abs(amount) > 1 ? amount / 1000 : amount;
    this.modifyTurnMeter(unit, fraction);
  }

  grantExtraTurn(unit, { suppressReactions = false } = {}) {
    if (unit.currentHp > 0 && !this.extraTurnQueue.includes(unit.id)) {
      this.extraTurnQueue.unshift(unit.id);
    }
    if (!suppressReactions && unit.currentHp > 0 && this.turnNumber > 0) {
      this.triggerSolarNovaReaction(unit, `${unit.name}'s Extra/Instant Turn`);
    }
  }

  triggerSolarNovaReaction(triggerUnit, reasonText) {
    if (this._inSolarNovaCounter || this.turnNumber <= 0) return;
    const candidateSolanars = this.getLivingUnits().filter(
      (u) =>
        u.id !== triggerUnit?.id &&
        this.hasAbilityFlag(u, "counterOnEnemyExtraTurnOrBuff")
    );
    for (const solanar of candidateSolanars) {
      if (solanar.currentHp > 0 && this.rng() < 0.2) {
        this._inSolarNovaCounter = true;
        try {
          this.logPassive(
            `[${solanar.name}] Scholar of Sun reacts to ${reasonText} and counterattacks with [Solar Nova]!`
          );
          const enemies = this.getLivingEnemiesOf(solanar);
          if (enemies.length > 0) {
            this.executeCounterSkill(solanar, "solar_nova", enemies[0].id);
          }
        } finally {
          this._inSolarNovaCounter = false;
        }
      }
    }
  }

  getSpartanAlliesCount(unit) {
    if (!unit) return 0;
    const spartanTemplates = ["john_117", "fred_104", "kelly_087", "linda_034"];
    return this.units.filter(
      (u) =>
        u.teamId === unit.teamId &&
        u.id !== unit.id &&
        u.currentHp > 0 &&
        spartanTemplates.includes(u.templateId)
    ).length;
  }

  triggerSpartanTeamUp(attacker, primaryTarget) {
    if (this._inSpartanTeamUp || !attacker || !primaryTarget || primaryTarget.currentHp <= 0) return;
    const spartanBasicSkills = {
      john_117: "direct_shot",
      fred_104: "countermand",
      kelly_087: "ferocious_onslaught",
      linda_034: "headshot",
    };
    if (!spartanBasicSkills[attacker.templateId]) return;

    const allies = this.getLivingAlliesOf(attacker).filter(
      (u) => spartanBasicSkills[u.templateId] && u.id !== attacker.id
    );
    if (allies.length === 0) return;

    this._inSpartanTeamUp = true;
    try {
      const joiningNames = [];
      for (const spartan of allies) {
        let tgt = primaryTarget;
        if (tgt.currentHp <= 0) {
          tgt = this.getLivingEnemiesOf(spartan)[0];
          if (!tgt) break;
        }
        const basicSkillId = spartanBasicSkills[spartan.templateId];
        const basicSkill = Registry.getSkill(basicSkillId);
        if (basicSkill) {
          joiningNames.push(`${spartan.name} [${basicSkill.name}]`);
          this.executeAllySkill(spartan, basicSkillId, tgt.id);
        }
      }
      if (joiningNames.length > 0) {
        this.logPassive(
          `[Spartan Unity] ${joiningNames.join(", ")} ${joiningNames.length === 1 ? "coordinates" : "coordinate"} with ${attacker.name}!`
        );
      }
    } finally {
      this._inSpartanTeamUp = false;
    }
  }

  triggerBurnTick(unit) {
    if (unit.currentHp <= 0) return;

    // Tethren Dragonsoul's Auric Soul: All allies heal 5% MAX HP from [Burn] instead of taking damage
    const teamHasAuricSoul = this.units.some(
      (ally) =>
        ally.teamId === unit.teamId &&
        (this.hasAbilityFlag(ally, "auricSoulTeamBurnAura") ||
          (ally.abilityIds || []).includes("auric_soul"))
    );
    if (teamHasAuricSoul) {
      const healAmt = Math.max(1, Math.floor(unit.effectiveMaxHp * 0.05));
      unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + healAmt);
      this.log(
        `[Auric Soul] ${unit.name} is healed by ${healAmt} HP (5% MAX HP) from [Burn].`,
        "heal"
      );
      return;
    }

    const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * 0.05));
    this.dealTrueDamage(unit, dmg, "Burn");

    for (const u of this.getLivingUnits()) {
      if (this.getActiveAbilities(u).some((a) => a.id === "lethal_lava")) {
        u.currentEnergy = Math.min(u.maxEnergy, u.currentEnergy + 5);
        this.log(`[${u.name}] Lethal Lava regenerates +5 Energy from Burn damage.`, "info");
      }
    }
  }

  applyCalculatedDamage(
    target,
    amount,
    {
      attacker = null,
      skill = null,
      bypassShieldsAndBlocks = false,
      bypassShields = false,
      bypassUnkillable = false,
      sourceLabel = null,
      silentShields = false,
      isRedirectedDamage = false,
    } = {}
  ) {
    if (
      !target ||
      target.currentHp <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      target._justRevivedProtectThisSkill
    ) {
      return 0;
    }

    // John-117 Luck Is On My Side Active: Evade massive damage (>30% MAX HP) + Instant Turn
    if (
      !bypassShieldsAndBlocks &&
      this.hasAbilityFlag(target, "spartanBigHitEvade") &&
      amount > target.effectiveMaxHp * 0.3 &&
      (target.customCounters?.luckActiveCooldown || 0) <= 0
    ) {
      if (!target.customCounters) target.customCounters = {};
      target.customCounters.luckActiveCooldown = 3;
      target._evadedSkillViaPassive = true;
      this.logPassive(
        `[LUCK IS ON MY SIDE] John-117 evades massive damage (${amount} > 30% MAX HP) and takes an Instant Turn!`
      );
      const spartanCount = this.getSpartanAlliesCount(target);
      if (spartanCount >= 1) {
        for (const sId in target.cooldowns) {
          if (target.cooldowns[sId] > 0) target.cooldowns[sId] -= 1;
        }
      }
      if (spartanCount >= 2) {
        for (const ally of this.getLivingAlliesOf(target)) {
          this.modifyTurnMeter(ally, 0.25);
        }
      }
      if (spartanCount >= 3) {
        target.currentHp = target.effectiveMaxHp;
        this.executeCounterSkill(target, "battle_fire");
      }
      this.grantExtraTurn(target);
      return 0;
    }

    // Fred-104 Defensive Bulwark Active: Instantly activates Armor Up if receiving damage > 30% MAX HP
    if (
      this.hasAbilityFlag(target, "spartanBigHitArmorUp") &&
      amount > target.effectiveMaxHp * 0.3
    ) {
      this.logPassive(
        `[DEFENSIVE BULWARK] Fred-104 receives damage greater than 30% MAX HP and instantly triggers Armor Up!`
      );
      this.executeCounterSkill(target, "armor_up");
    }

    if (!bypassShieldsAndBlocks && this.statusManager.hasFlag(target, "blockDamage")) {
      if (!silentShields) {
        this.log(`${target.name}'s [Block Damage] negates incoming damage.`, "info");
      }
      return 0;
    }

    const fullDamage = Math.max(1, Math.round(amount));
    let remaining = fullDamage;
    const skipShields = bypassShieldsAndBlocks || bypassShields;

    if (!skipShields && (this.communalShields[target.teamId] || 0) > 0) {
      const absorbed = Math.min(this.communalShields[target.teamId], remaining);
      this.communalShields[target.teamId] -= absorbed;
      remaining -= absorbed;
      if (typeof target._absorbedByShieldThisSkill === "number") {
        target._absorbedByShieldThisSkill += absorbed;
      }
      if (!silentShields) {
        this.log(
          `Communal Shield absorbs ${absorbed} damage for ${target.name} (${this.communalShields[target.teamId]} Shield left).`,
          "info",
          { isSkill: false }
        );
      }
      if (remaining <= 0) return fullDamage;
    }

    if (!skipShields && (target.magmaShieldHp || 0) > 0 && remaining > 0) {
      const absorbedMagma = Math.min(target.magmaShieldHp, remaining);
      target.magmaShieldHp -= absorbedMagma;
      remaining -= absorbedMagma;
      if (typeof target._absorbedByShieldThisSkill === "number") {
        target._absorbedByShieldThisSkill += absorbedMagma;
      }
      if (target.magmaShieldHp <= 0) {
        this.statusManager.removeStatus(target, "magma_shield", { forceProtected: true });
      }
      if (!silentShields) {
        this.log(
          `${target.name}'s Magma Shield absorbs ${absorbedMagma} damage (${target.magmaShieldHp} Magma Shield left).`,
          "special",
          { isSkill: false }
        );
      }
      if (attacker && attacker.currentHp > 0 && absorbedMagma > 0) {
        this.dealTrueDamage(
          attacker,
          absorbedMagma,
          `${target.name}'s Magma Shield Reflect (100%)`
        );
      }
      if (remaining <= 0) return fullDamage;
    }

    if (!skipShields && (target.shieldHp || 0) > 0) {
      const absorbed = Math.min(target.shieldHp, remaining);
      target.shieldHp -= absorbed;
      remaining -= absorbed;
      if (typeof target._absorbedByShieldThisSkill === "number") {
        target._absorbedByShieldThisSkill += absorbed;
      }
      if (target.shieldHp <= 0) {
        this.statusManager.removeStatus(target, "shield", { forceProtected: true });
      }
      if (!silentShields && typeof target._absorbedByShieldThisSkill !== "number") {
        this.log(`${target.name}'s Shield absorbs ${absorbed} damage.`, "info", {
          isSkill: false,
        });
      }
      if (remaining <= 0) return fullDamage;
    }

    // Fred-104 Defensive Bulwark: intercepts 25% (or 50% with 1 Spartan Ally) damage for allies
    if (!isRedirectedDamage && !bypassShieldsAndBlocks && remaining > 0) {
      const fred = this.getLivingAlliesOf(target).find(
        (a) => a.id !== target.id && this.hasAbilityFlag(a, "defensiveBulwarkDamageShare")
      );
      if (fred) {
        const spartanCount = this.getSpartanAlliesCount(fred);
        const sharePct = spartanCount >= 1 ? 0.5 : 0.25;
        const sharedDmg = Math.floor(remaining * sharePct);
        if (sharedDmg > 0) {
          remaining -= sharedDmg;

          if (target._inSkillHitLoop) {
            target._fredSharedDamageThisSkill =
              (target._fredSharedDamageThisSkill || 0) + sharedDmg;
            target._fredInterceptorUnit = fred;
          } else {
            this.applyCalculatedDamage(fred, sharedDmg, {
              attacker,
              skill,
              isRedirectedDamage: true,
              silentShields: false,
            });
            this.logPassive(
              `[Defensive Bulwark] Fred-104 intercepts ${sharedDmg} damage (${Math.round(sharePct * 100)}%) for ${target.name}!`
            );
            const fredDefHealPct = spartanCount >= 1 ? 0.45 : 0.2;
            const fredHealAmt = Math.max(
              1,
              Math.floor(this.getEffectiveStats(fred).def * fredDefHealPct)
            );
            this.healUnit(fred, fredHealAmt, "Defensive Bulwark Regeneration", {
              isPassive: true,
            });

            if (spartanCount >= 2) {
              const sVal = Math.floor(3.0 * this.getEffectiveStats(fred).def);
              fred.shieldHp = (fred.shieldHp || 0) + sVal;
              target.shieldHp = (target.shieldHp || 0) + sVal;
              this.statusManager.applyStatus(fred, fred, "shield", {
                duration: 2,
                silent: true,
              });
              this.statusManager.applyStatus(fred, target, "shield", {
                duration: 2,
                silent: true,
              });
              this.logPassive(
                `[Defensive Bulwark] Fred-104 grants +${sVal} [Shield] (2T) to himself and ${target.name}.`
              );
            }
            if (spartanCount >= 3 && attacker && attacker.currentHp > 0) {
              this.logPassive(
                `[Defensive Bulwark] Fred-104 prepares to counterattack ${attacker.name} with [Countermand]!`
              );
              this.executeCounterSkill(fred, "countermand", attacker.id);
            }
          }
        }
      }
    }

    if (target.templateId === "theridine_great_septimus") {
      this.applyDamageToTheridine(target, remaining, attacker);
      return fullDamage;
    }

    const oldHpPct = (target.currentHp / target.effectiveMaxHp) * 100;
    let actual = Math.min(target.currentHp, remaining);

    if (
      !bypassShieldsAndBlocks &&
      !bypassUnkillable &&
      this.statusManager.hasFlag(target, "unkillable") &&
      target.currentHp - actual < 1
    ) {
      actual = Math.max(0, target.currentHp - 1);
      if (!silentShields) {
        this.log(`${target.name}'s [Unkillable] keeps them at 1 HP.`, "info");
      }
    }

    // Item fatal damage prevention (e.g. The Soul survives at 1 HP once)
    const tgtItem = this.getActiveItem(target);
    if (
      target.currentHp - actual <= 0 &&
      tgtItem &&
      typeof tgtItem.onBeforeFatalDamage === "function"
    ) {
      const prevented = tgtItem.onBeforeFatalDamage({
        unit: target,
        attacker,
        engine: this,
      });
      if (prevented) {
        actual = Math.max(0, target.currentHp - 1);
      }
    }

    target.currentHp -= actual;
    const newHpPct = (target.currentHp / target.effectiveMaxHp) * 100;

    if (sourceLabel && remaining > 0) {
      this.log(`${target.name} takes ${remaining} damage from ${sourceLabel}.`, "damage");
    }

    // Linda-034 Pinpoint Accuracy Lifesteal (25% damage healed) — aggregated per target when in multi-hit loop
    if (
      !target._inSkillHitLoop &&
      attacker &&
      fullDamage > 0 &&
      this.hasAbilityFlag(attacker, "healOnDamageDealtPct")
    ) {
      const pct = this.getAbilityFlagValue(attacker, "healOnDamageDealtPct") || 0.25;
      const lifesteal = Math.max(1, Math.floor(fullDamage * pct));
      this.healUnit(attacker, lifesteal, `${attacker.name}'s Pinpoint Accuracy Lifesteal`, {
        isPassive: true,
      });
    }

    // Kelly-087 Guarded and Ready: Whenever an ally under a Shield takes damage, heal 50% — aggregated per target when in multi-hit loop
    if (!target._inSkillHitLoop && fullDamage > 0 && (target.shieldHp || 0) > 0) {
      const kelly = this.getLivingAlliesOf(target).find((a) =>
        this.hasAbilityFlag(a, "guardedReadyShieldEcho")
      );
      if (kelly) {
        const echoHeal = Math.max(1, Math.floor(fullDamage * 0.5));
        this.healUnit(target, echoHeal, "Guarded and Ready Shield Echo", {
          isPassive: true,
        });
      }
    }

    // Kelly-087 Active Effect: Ally drops below 50% HP -> cleanses debuffs & grants Stone Skin (1T) (CD: 4)
    if (
      oldHpPct >= 50 &&
      target.currentHp / target.effectiveMaxHp < 0.5 &&
      target.currentHp > 0
    ) {
      const kelly = this.getLivingAlliesOf(target).find(
        (a) =>
          this.hasAbilityFlag(a, "guardedReadyEmergencyStoneSkin") &&
          (a.customCounters?.guardedReadyCooldown || 0) <= 0
      );
      if (kelly) {
        if (!kelly.customCounters) kelly.customCounters = {};
        kelly.customCounters.guardedReadyCooldown = 4;
        this.logPassive(
          `[GUARDED AND READY] ${target.name} fell below 50% HP! Kelly-087 cleanses all debuffs and grants [Stone Skin] (1T)!`
        );
        target.statuses = target.statuses.filter((s) => s.category !== "debuff" || s.isProtected);
        this.statusManager.applyStatus(kelly, target, "stone_skin", {
          duration: 1,
          silent: true,
        });
      }

      // John-117 3 Spartan Allies: Instantly activates Spartans, As One when ally drops below 50% HP
      const john = this.getLivingAlliesOf(target).find(
        (a) =>
          a.templateId === "john_117" &&
          this.getSpartanAlliesCount(a) >= 3 &&
          !a._spartansAsOneProcThisTurn
      );
      if (john) {
        john._spartansAsOneProcThisTurn = true;
        this.logPassive(
          `[Spartan Unity] Ally emergency (<50% HP)! John-117 instantly unleashes [Spartans, As One]!`
        );
        this.executeCounterSkill(john, "spartans_as_one");
      }
    }

    if (target.currentHp > 0 && actual > 0 && tgtItem && typeof tgtItem.onAfterTakeDamage === "function") {
      tgtItem.onAfterTakeDamage({
        unit: target,
        defender: target,
        holder: target,
        attacker,
        skill,
        damageTaken: fullDamage,
        engine: this,
      });
    }

    if (target.templateId === "first_genius_zander" && fullDamage > 0) {
      if (target.form === "evolution") {
        target.customCounters.evolutionDamageTaken =
          (target.customCounters.evolutionDamageTaken || 0) + fullDamage;
      }
      if (target.currentHp > 0) {
        this.checkZanderHpThresholds(target, oldHpPct, newHpPct);
      }
    }

    if (target.currentHp <= 0) {
      this.handleUnitDeath(target, attacker);
    }
    return fullDamage;
  }

  applyDamageToTheridine(theridine, damageAmount, attacker) {
    let dmgLeft = damageAmount;
    const atkVal = this.getEffectiveStats(theridine).atk;
    const enemyTeamId = theridine.teamId === 1 ? 2 : 1;

    while (dmgLeft > 0 && theridine.currentHp > 0) {
      if (dmgLeft >= theridine.currentHp) {
        const consumed = theridine.currentHp;
        dmgLeft -= consumed;

        if ((theridine.customCounters.chargingBarsRemaining || 0) > 0) {
          theridine.customCounters.chargingBarsRemaining -= 1;
          const shieldGrant = Math.round(atkVal * 10);
          this.communalShields[enemyTeamId] =
            (this.communalShields[enemyTeamId] || 0) + shieldGrant;
          this.log(
            `[${theridine.name}] Charging Bar broken (${theridine.customCounters.chargingBarsRemaining}/7 left). Heroes gain +${shieldGrant} Communal Shield.`,
            "special"
          );

          if (theridine.customCounters.chargingBarsRemaining === 0) {
            theridine.customCounters.chargingReactionsLeft = 0;
            this.modifyTurnMeter(theridine, -0.5, { bypassImmunity: true });
            this.log(
              `All 7 Charging Bars broken! [${theridine.name}] exits charging state and has action delayed by 50%.`,
              "crit"
            );
          }
          theridine.currentHp = theridine.effectiveMaxHp;
        } else {
          theridine.customCounters.hpBarsRemaining =
            (theridine.customCounters.hpBarsRemaining ?? 16) - 1;
          const shieldGrant = Math.round(atkVal * 5);
          this.communalShields[enemyTeamId] =
            (this.communalShields[enemyTeamId] || 0) + shieldGrant;

          if (theridine.customCounters.hpBarsRemaining > 0) {
            theridine.currentHp = theridine.effectiveMaxHp;
            this.log(
              `[${theridine.name}] Godspawn HP Bar depleted (${theridine.customCounters.hpBarsRemaining}/16 bars remaining). Heroes gain +${shieldGrant} Communal Shield.`,
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
        dmgLeft = 0;
      }
    }
    return damageAmount;
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
          `[${zander.name}] dropped below ${th}% HP: Genius's Foresight delays Zander's action by 50% and heals all heroes by ${healAmt} HP.`,
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
      `[${zander.name}] enters EVOLUTION STATE (SPD: 150, DEF: -50, ATK: 20, Termination Counter = 8).`,
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
      `[${zander.name}] returns to Base Form. Transmutation Counter reset to 0.`,
      "special"
    );
  }

  dealTrueDamage(target, amount, sourceLabel = "True Damage") {
    return this.applyCalculatedDamage(target, amount, {
      bypassShieldsAndBlocks: false,
      sourceLabel,
    });
  }

  healUnit(target, amount, sourceLabel = "Healing", { isPassive = false } = {}) {
    if (!target || target.currentHp <= 0 || !Number.isFinite(amount) || amount <= 0) return 0;
    const healMod = this.statusManager.getStatModifier(target, "healReceivedMultiplier") ?? 1.0;
    const itemMod = this.getActiveItem(target)?.id === "crystal_jade" ? 1.1 : 1.0;
    const effectiveHeal = Math.max(0, Math.floor(amount * healMod * itemMod));
    const prevHp = target.currentHp;
    target.currentHp = Math.min(target.effectiveMaxHp, target.currentHp + effectiveHeal);
    const actualGained = target.currentHp - prevHp;
    if (actualGained > 0) {
      const msg = `[${sourceLabel}] ${target.name} recovers +${actualGained} HP (${target.currentHp}/${target.effectiveMaxHp} HP).`;
      if (isPassive) {
        this.logPassive(msg);
      } else {
        this.log(msg, "heal", { isSkill: false });
      }
    }
    return actualGained;
  }

  handleUnitDeath(target, killer) {
    if (target._deathHandled && target.currentHp <= 0) return;
    target._deathHandled = true;
    target.currentHp = 0;
    target.turnMeter = 0;
    target.defeatedAtTurn = this.turnNumber;
    this.extraTurnQueue = this.extraTurnQueue.filter((id) => id !== target.id);
    this.log(`[DEFEATED] ${target.name} has fallen.`, "crit", { isSkill: false });

    // Resurrection Orb: revive at 50% HP once if not under Block Revive
    const tgtItem = this.getActiveItem(target);
    if (
      tgtItem &&
      tgtItem.id === "resurrection_orb" &&
      !target.blockRevive &&
      !target.customCounters?.resurrectionOrbUsed
    ) {
      target.customCounters.resurrectionOrbUsed = true;
      target.itemId = "none";
      target.currentHp = Math.max(1, Math.floor(target.effectiveMaxHp * 0.5));
      target._deathHandled = false;
      this.log(
        `[${target.name}] Resurrection Orb shatters and revives ${target.name} at ${target.currentHp} HP (50% MAX HP)!`,
        "heal"
      );
      return;
    }

    for (const ab of this.getActiveAbilities(target)) {
      if (typeof ab.onDeath === "function") {
        ab.onDeath({ unit: target, killer, engine: this });
      }
    }

    if (killer && killer.currentHp > 0 && killer.teamId !== target.teamId) {
      for (const ab of this.getActiveAbilities(killer)) {
        if (typeof ab.onKillEnemy === "function") {
          ab.onKillEnemy({ unit: killer, victim: target, engine: this });
        }
      }
      const killerItem = this.getActiveItem(killer);
      if (killerItem && typeof killerItem.onKill === "function") {
        killerItem.onKill({
          unit: killer,
          attacker: killer,
          victim: target,
          engine: this,
        });
      }
    }

    const allTeamAllies = this.units.filter(
      (a) => a.teamId === target.teamId && a.id !== target.id && !a.isSummon
    );
    for (const ally of allTeamAllies) {
      for (const ab of this.getActiveAbilities(ally)) {
        if (typeof ab.onAllyKilled === "function") {
          ab.onAllyKilled({ unit: ally, deadAlly: target, killer, engine: this });
        }
      }
      if (ally.currentHp > 0) {
        const allyItem = this.getActiveItem(ally);
        if (allyItem && typeof allyItem.onAllyDied === "function") {
          allyItem.onAllyDied({
            unit: ally,
            holder: ally,
            deadAlly: target,
            killer,
            engine: this,
          });
        }
      }
    }

    // Solanar the Gleaming's Scholar of Sun:
    const remainingLivingOnTeam = this.units.filter(
      (u) => u.teamId === target.teamId && !u.isSummon && u.currentHp > 0
    );
    if (remainingLivingOnTeam.length === 0) {
      const deadSolanar = this.units.find(
        (u) =>
          u.teamId === target.teamId &&
          !u.isSummon &&
          u.currentHp <= 0 &&
          !u.blockRevive &&
          !u.customCounters?.scholarOfSunRevived &&
          (u.abilityIds || []).includes("scholar_of_sun")
      );
      if (deadSolanar) {
        const scholarAb = Registry.getAbility("scholar_of_sun");
        if (scholarAb && typeof scholarAb.tryReviveSolanar === "function") {
          scholarAb.tryReviveSolanar({ solanar: deadSolanar, engine: this });
          if (deadSolanar.currentHp > 0) {
            deadSolanar._deathHandled = false;
          }
        }
      }
    }

    if (target.isSummon) {
      const summonDef = Registry.getSummon(target.templateId);
      if (summonDef && typeof summonDef.onDestroy === "function") {
        summonDef.onDestroy({ summonUnit: target, killer, engine: this });
      }
    }

    this.checkWinCondition({ logOutcome: false });
  }

  checkWinCondition({ logOutcome = false } = {}) {
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
      if (logOutcome && !this._winOutcomeLogged) {
        this._winOutcomeLogged = true;
        this.log("VICTORY: Team 1 triumphs.", "special", {
          isMatchOutcome: true,
        });
      }
    } else if (!team1Alive) {
      this.winnerTeam = 2;
      if (logOutcome && !this._winOutcomeLogged) {
        this._winOutcomeLogged = true;
        this.log("DEFEAT: Team 2 prevails.", "crit", {
          isMatchOutcome: true,
        });
      }
    }
    return this.winnerTeam;
  }

  getAvailableMovesForUnit(unit) {
    if (!unit || unit.currentHp <= 0 || unit.isActionlessTotem) return [];

    this.syncUnitActiveMoves(unit);

    const moveIds = [...(unit.activeMoveIds || []), "wait", "rest"];
    const hasZeroCostLink = this.statusManager.hasFlag(unit, "zeroEnergyCost");
    const activeItem = this.getActiveItem(unit);
    const isRangedOnly = this.statusManager.hasFlag(unit, "rangedOnly");

    return moveIds
      .map((moveId) => {
        const skill = Registry.getSkill(moveId);
        if (!skill) return null;

        const cdRemaining = unit.cooldowns[moveId] || 0;
        let effectiveEnergyCost = hasZeroCostLink ? 0 : skill.energyCost || 0;
        if (!hasZeroCostLink && effectiveEnergyCost > 0) {
          if (
            activeItem &&
            activeItem.id === "devilsknife" &&
            unit.customCounters?.devilsknifeMoveId === moveId
          ) {
            effectiveEnergyCost = Math.max(1, effectiveEnergyCost - 10);
          }
          if (activeItem && activeItem.id === "thorn_ring" && skill.element === "Ice") {
            effectiveEnergyCost = Math.max(1, Math.floor(effectiveEnergyCost * 0.9));
          }
        }
        let usable = true;
        let lockReason = "";
        const isForcedMove = unit.forcedNextSkillId === moveId;

        if (usable && isRangedOnly && skill.category === "Melee") {
          usable = false;
          lockReason = "Really Long Arms restricts unit to Ranged/Status moves";
        }

        if (
          unit.forcedNextSkillId &&
          moveId !== unit.forcedNextSkillId &&
          !skill.isUniversal
        ) {
          const forcedSkill = Registry.getSkill(unit.forcedNextSkillId);
          usable = false;
          lockReason = `Must use [${forcedSkill?.name || unit.forcedNextSkillId}] next`;
        }

        if (usable && skill.cannotCastManually && !isForcedMove) {
          usable = false;
          lockReason = "Triggered automatically by ability";
        }

        if (usable && skill.requiresPreviousSkill && !isForcedMove) {
          if (unit.lastNonUniversalSkillId !== skill.requiresPreviousSkill) {
            const reqSkill = Registry.getSkill(skill.requiresPreviousSkill);
            usable = false;
            lockReason = `Requires [${reqSkill?.name || skill.requiresPreviousSkill}] first`;
          }
        }

        if (usable && typeof skill.minOtherSkillsUsed === "number") {
          const used = unit.skillsUsedCount || 0;
          if (used < skill.minOtherSkillsUsed) {
            usable = false;
            lockReason = `Requires ${skill.minOtherSkillsUsed} skills used first (${used}/${skill.minOtherSkillsUsed})`;
          }
        }

        if (usable && cdRemaining > 0) {
          usable = false;
          lockReason = `Cooldown: ${cdRemaining}T`;
        }

        if (usable && typeof skill.canUse === "function") {
          try {
            const check = skill.canUse({ attacker: unit, unit, engine: this });
            if (check && !check.allowed) {
              usable = false;
              lockReason = check.reason;
            }
          } catch (err) {
            console.error(`Error in skill.canUse for ${moveId}:`, err);
            usable = false;
            lockReason = "Skill requirement not met";
          }
        }

        if (usable && unit.currentEnergy < effectiveEnergyCost) {
          usable = false;
          lockReason = isForcedMove
            ? `Queued Next — Needs ${effectiveEnergyCost} Energy (Use Wait/Rest)`
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

  cleanupDefeatedBossSummons() {
    this.units = this.units.filter((u) => {
      const isBossSummonUnit =
        u.isBossSummon ||
        u.isSummon ||
        u.templateId === "swarm_spawn" ||
        u.templateId === "soul_spear";
      if (
        isBossSummonUnit &&
        u.currentHp <= 0 &&
        u.defeatedAtTurn !== undefined &&
        this.turnNumber > u.defeatedAtTurn
      ) {
        this.extraTurnQueue = this.extraTurnQueue.filter((id) => id !== u.id);
        return false;
      }
      return true;
    });
  }

  checkAndAdvanceRound() {
    const combatants = this.units.filter(
      (u) => u.currentHp > 0 && !u.isActionlessTotem
    );
    if (combatants.length === 0) return;
    const allActed = combatants.every((u) =>
      this.actedInCurrentRound.includes(u.id)
    );
    if (allActed) {
      this.roundNumber += 1;
      this.actedInCurrentRound = [];
      for (const u of combatants) {
        for (const ab of this.getActiveAbilities(u)) {
          if (typeof ab.onRoundStart === "function") {
            ab.onRoundStart({ unit: u, roundNumber: this.roundNumber, engine: this });
          }
        }
      }
    }
  }

  beginUnitTurn(unit, { isExtraTurn = false } = {}) {
    const prevNextTurnPhase = this._inNextTurnPhase;
    this._inNextTurnPhase = true;
    try {
      this.cleanupDefeatedBossSummons();
      this.activeUnitId = unit.id;
      if (!isExtraTurn && !this.actedInCurrentRound.includes(unit.id)) {
        this.actedInCurrentRound.push(unit.id);
      }

      this.log(
        `[Next Turn] ${unit.name}'s turn begins${isExtraTurn ? " (EXTRA/INSTANT TURN)" : ""} (${unit.currentHp}/${unit.effectiveMaxHp} HP, ${unit.currentEnergy}/${unit.maxEnergy} EN).`,
        "next_turn",
        { isSkill: false }
      );

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

      if (!isExtraTurn && unit.customCounters) {
        if (unit.customCounters.luckActiveCooldown > 0) {
          unit.customCounters.luckActiveCooldown -= 1;
        }
        if (unit.customCounters.guardedReadyCooldown > 0) {
          unit.customCounters.guardedReadyCooldown -= 1;
        }
      }

      for (const u of this.units) {
        u._spartansAsOneProcThisTurn = false;
      }

      if (unit.templateId === "first_genius_zander" && unit.form === "evolution") {
        unit.customCounters.termination = Math.max(
          0,
          (unit.customCounters.termination ?? 8) - 1
        );
        this.log(
          `[${unit.name}] Termination Counter ticks down to ${unit.customCounters.termination}/8.`,
          "status"
        );
        if (unit.customCounters.termination === 0) {
          unit.forcedNextSkillId = "cyclicity_alpha_scepter";
        }
      }

      if (
        unit.templateId === "theridine_great_septimus" &&
        (unit.customCounters.chargingBarsRemaining || 0) > 0
      ) {
        this.log(
          `[${unit.name}] is charging Im Anfang War die Tat (${unit.customCounters.chargingBarsRemaining} bars left, ${unit.customCounters.chargingReactionsLeft} reactions remaining).`,
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

      if (unit.currentHp <= 0 || this.checkWinCondition({ logOutcome: true })) {
        this.advanceToNextTurn();
        return;
      }

      if (shouldSkip) {
        this.log(`${unit.name} is incapacitated and skips their turn.`, "status");
        this.statusManager.tickStatuses(unit, "TURN_END");
        this.checkAndAdvanceRound();
        this.advanceToNextTurn();
        return;
      }
    } finally {
      this._inNextTurnPhase = prevNextTurnPhase;
    }
  }

  executeBonusHit({ attacker, target, element, stab, rawMultiplier, ignoreDefPct = 0, label }) {
    const runHit = () => {
      if (!target || target.currentHp <= 0 || !attacker || attacker.currentHp <= 0) return;
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
      const dealt = this.applyCalculatedDamage(target, damage, {
        attacker,
        skill: tempSkill,
      });
      this.log(
        `[Normal Attack] ${attacker.name} [${label}] -> ${target.name}: ${dealt} DMG${isCrit ? " [CRIT]" : ""}`,
        "normal_attack",
        { isSkill: true, isPrimaryAttack: false }
      );
    };

    const frame = this.currentResolutionFrame();
    if (frame && (frame.phase === "attack" || frame.phase === "passive")) {
      this.queueFollowUpAttack(runHit, { category: "bonus" });
    } else {
      runHit();
    }
  }

  executeFollowUpSkill(attacker, skillId, targetId = null, reasonMessage = null) {
    if (!attacker || attacker.currentHp <= 0 || this.winnerTeam) return;
    if (reasonMessage) {
      this.logPassive(reasonMessage);
    }
    const runFollowUp = () => {
      if (attacker.currentHp <= 0 || this.winnerTeam) return;
      const skill = Registry.getSkill(skillId);
      if (!skill) return;
      if (!attacker.customCounters.predatorMovesUsed) {
        attacker.customCounters.predatorMovesUsed = {};
      }
      attacker.customCounters.predatorMovesUsed[skillId] = true;
      this.runSkillResolution(attacker, skill, targetId, {
        isFreeCounter: false,
        isTeamUp: false,
        isRepeatAttack: true,
      });
      this.syncUnitActiveMoves(attacker);
    };

    const frame = this.currentResolutionFrame();
    if (frame && (frame.phase === "attack" || frame.phase === "passive")) {
      this.queueFollowUpAttack(runFollowUp, {
        category: "bonus",
        dedupKey: `followup:${attacker.id}:${skillId}:${targetId || "auto"}`,
      });
    } else {
      runFollowUp();
    }
  }

  executeAllySkill(attacker, skillId, targetId = null) {
    if (!attacker || attacker.currentHp <= 0 || this.winnerTeam) return;
    const runAlly = () => {
      if (attacker.currentHp <= 0 || this.winnerTeam) return;
      const skill = Registry.getSkill(skillId);
      if (!skill) return;
      this.runSkillResolution(attacker, skill, targetId, {
        isFreeCounter: true,
        isTeamUp: true,
      });
      this.syncUnitActiveMoves(attacker);
    };

    const frame = this.currentResolutionFrame();
    if (frame && (frame.phase === "attack" || frame.phase === "passive")) {
      this.queueFollowUpAttack(runAlly, {
        category: "ally_attack",
        dedupKey: `ally:${attacker.id}:${skillId}:${targetId || "auto"}`,
      });
    } else {
      runAlly();
    }
  }

  executeCounterSkill(attacker, skillId, targetId = null) {
    if (!attacker || attacker.currentHp <= 0 || this.winnerTeam) return;
    const runCounter = () => {
      if (attacker.currentHp <= 0 || this.winnerTeam) return;
      const skill = Registry.getSkill(skillId);
      if (!skill) return;
      if (!attacker.customCounters.predatorMovesUsed) {
        attacker.customCounters.predatorMovesUsed = {};
      }
      attacker.customCounters.predatorMovesUsed[skillId] = true;
      this.runSkillResolution(attacker, skill, targetId, { isFreeCounter: true });
      this.syncUnitActiveMoves(attacker);
    };

    const frame = this.currentResolutionFrame();
    if (frame && (frame.phase === "attack" || frame.phase === "passive")) {
      this.queueFollowUpAttack(runCounter, {
        category: "counterattack",
        dedupKey: `counter:${attacker.id}:${skillId}:${targetId || "auto"}`,
      });
    } else {
      runCounter();
    }
  }

  getUnitEvasionChance(unit) {
    let evasion = 0;
    if (this.hasAbilityFlag(unit, "innateEvadeChance")) {
      evasion += this.getAbilityFlagValue(unit, "innateEvadeChance") || 0.1;
    }
    if (this.statusManager.hasStatus(unit, "predator_sprint")) {
      evasion += 0.5;
    }
    if (this.hasAbilityFlag(unit, "yautjaCloakEvasion")) {
      if (unit.customCounters?.cloakStartEvasionActive) {
        evasion += 0.5;
      }
      evasion += Math.min(0.6, unit.customCounters?.killEvasionBonus || 0);
    }
    if (unit.customCounters?.evasionBonus) {
      evasion += unit.customCounters.evasionBonus / 100;
    }
    const item = this.getActiveItem(unit);
    if (item) {
      if (item.evasionBonus) {
        evasion += item.evasionBonus > 1 ? item.evasionBonus / 100 : item.evasionBonus;
      }
      if (item.id === "gravity_coil" && !unit.customCounters?.airborne) {
        evasion += 0.1;
      }
    }
    return Math.min(0.85, evasion);
  }

  executeAction({ actorId, moveId, targetId = null }) {
    if (this.winnerTeam) return false;
    const attacker = this.getUnitById(actorId);
    if (!attacker || attacker.id !== this.activeUnitId) return false;

    const available = this.getAvailableMovesForUnit(attacker);
    const moveInfo = available.find((m) => m.id === moveId);
    if (!moveInfo || !moveInfo.usable) return false;

    // Advance turn number at the start of the action so the entire sequence
    // (1: Primary Attack -> 2: Passives -> 3: Follow-up Attacks -> 4: Outcomes -> 5: Final Result -> 6: Next Turn)
    // is grouped together and ordered by priority under [Tn].
    this.turnNumber += 1;
    const turnLogsStart = this.logs.length;

    const skill = Registry.getSkill(moveId);
    const energySpent = moveInfo.energyCost || 0;

    attacker.currentEnergy = Math.max(0, attacker.currentEnergy - energySpent);
    if (skill.cooldown) {
      attacker.cooldowns[skill.id] = skill.cooldown;
    }

    if (this.statusManager.hasStatus(attacker, "extrapolation_link")) {
      this.statusManager.removeStatus(attacker, "extrapolation_link", {
        forceProtected: true,
      });
      if (!skill.isUniversal) {
        const massiveDmg = Math.max(1, Math.floor(attacker.effectiveMaxHp * 0.65));
        this.log(
          `${attacker.name} triggered Zander's [Extrapolation: Beta Link] by casting [${skill.name}] instead of Wait/Rest!`,
          "crit"
        );
        this.dealTrueDamage(attacker, massiveDmg, "Extrapolation: Beta Link Backlash");
        if (attacker.currentHp <= 0) {
          this.log(
            `[Final Result] ${attacker.name} was defeated by [Extrapolation: Beta Link] backlash (0/${attacker.effectiveMaxHp} HP).`,
            "final_result"
          );
          this.checkWinCondition({ logOutcome: true });
          if (!this.winnerTeam) {
            this.advanceToNextTurn();
          } else {
            this.activeUnitId = null;
          }
          this.finalizeTurnLogs(turnLogsStart);
          return true;
        }
      }
    }

    if (!skill.isUniversal) {
      attacker.skillsUsedCount = (attacker.skillsUsedCount || 0) + 1;
      attacker.lastNonUniversalSkillId = skill.id;
      if (!attacker.customCounters.predatorMovesUsed) {
        attacker.customCounters.predatorMovesUsed = {};
      }
      attacker.customCounters.predatorMovesUsed[skill.id] = true;

      if (attacker.forcedNextSkillId === skill.id) {
        attacker.forcedNextSkillId = null;
      }

      if (skill.forcesNextSkill) {
        attacker.forcedNextSkillId = skill.forcesNextSkill;
      }

      if (skill.upgradesSkill && skill.upgradesSkill.from && skill.upgradesSkill.to) {
        if (!attacker.skillUpgrades) attacker.skillUpgrades = {};
        attacker.skillUpgrades[skill.upgradesSkill.from] = skill.upgradesSkill.to;
      }
    }

    // 1. Attack -> 2. Passive -> 3. Attacks (if applicable) -> 4. Outcomes
    try {
      this.runSkillResolution(attacker, skill, targetId, { isFreeCounter: false });
    } catch (err) {
      console.error(`Error resolving skill ${skill.id}:`, err);
    }
    this.syncUnitActiveMoves(attacker);

    if (moveId === "rest") {
      const atkItem = this.getActiveItem(attacker);
      if (atkItem && typeof atkItem.onRest === "function") {
        atkItem.onRest({ unit: attacker, engine: this });
      }
    }

    if (!skill.isUniversal) {
      if (skill.forcesNextSkill) {
        const nextSkillDef = Registry.getSkill(skill.forcesNextSkill);
        this.log(
          `[${attacker.name}] next required skill queued: [${nextSkillDef?.name || skill.forcesNextSkill}].`,
          "special"
        );
      }

      const enemyZander = this.getLivingEnemiesOf(attacker).find(
        (e) => e.templateId === "first_genius_zander" && e.form === "base"
      );
      if (enemyZander && energySpent > 0) {
        enemyZander.customCounters.transmutation =
          (enemyZander.customCounters.transmutation || 0) + energySpent;
        this.logPassive(
          `[${enemyZander.name}] Transmutation Counter +${energySpent} -> ${enemyZander.customCounters.transmutation}/600.`
        );
        if (enemyZander.customCounters.transmutation >= 600) {
          enemyZander.customCounters.transmutation = 0;
          this.logPassive(
            `[${enemyZander.name}] Transmutation Counter reached 600: granted an Instant Turn to activate [Mode: Evolution].`
          );
          this.enterZanderEvolution(enemyZander);
          this.grantExtraTurn(enemyZander);
        }
      }
    }

    const enemyTheridine = this.getLivingEnemiesOf(attacker).find(
      (e) =>
        e.templateId === "theridine_great_septimus" &&
        (e.customCounters.chargingBarsRemaining || 0) > 0
    );
    if (enemyTheridine && enemyTheridine.currentHp > 0) {
      enemyTheridine.customCounters.chargingReactionsLeft -= 1;
      const left = enemyTheridine.customCounters.chargingReactionsLeft;
      this.logPassive(
        `[${enemyTheridine.name}] reacts after ${attacker.name}'s turn (${7 - left}/7 actions elapsed, ${enemyTheridine.customCounters.chargingBarsRemaining} Charging Bars left).`
      );
      if (left <= 0) {
        enemyTheridine.customCounters.chargingBarsRemaining = 0;
        this.logPassive(
          `[${enemyTheridine.name}] completes Im Anfang War die Tat charging and unleashes [FOR ONE IS HOLY]!`
        );
        this.executeCounterSkill(enemyTheridine, "for_one_is_holy");
      }
    }

    for (const ab of this.getActiveAbilities(attacker)) {
      if (typeof ab.onTurnEnd === "function") {
        ab.onTurnEnd({ unit: attacker, engine: this });
      }
    }
    const endItem = this.getActiveItem(attacker);
    if (endItem && typeof endItem.onTurnEnd === "function") {
      endItem.onTurnEnd({ unit: attacker, engine: this });
    }
    // Buffs only end AFTER a character takes their turn (and do not decrease on the turn placed/stolen)
    this.statusManager.tickStatuses(attacker, "TURN_END");

    // 5. Final Result & Match Outcome
    const livingAllies = this.getLivingAlliesOf(attacker);
    const livingEnemies = this.getLivingEnemiesOf(attacker);
    const shieldNote =
      (attacker.shieldHp || 0) > 0
        ? `, Shield: ${attacker.shieldHp}`
        : (attacker.magmaShieldHp || 0) > 0
        ? `, Magma Shield: ${attacker.magmaShieldHp}`
        : "";
    this.log(
      `[Final Result] ${attacker.name} completes turn (${attacker.currentHp}/${attacker.effectiveMaxHp} HP${shieldNote}, ${attacker.currentEnergy}/${attacker.maxEnergy} EN) • Standing: Team ${attacker.teamId} (${livingAllies.length} alive) vs Opponents (${livingEnemies.length} alive).`,
      "final_result",
      { isSkill: false }
    );

    // 6. Next Turn (or Victory/Defeat)
    this.checkWinCondition({ logOutcome: true });
    if (!this.winnerTeam) {
      this.checkAndAdvanceRound();
      this.advanceToNextTurn();
    } else {
      this.activeUnitId = null;
    }

    // Deduplicate and enforce strict priority ordering across the turn:
    // 1. Primary Attack -> 2. Passives -> 3. Follow-up Attacks -> 4. Outcomes -> 5. Final Result -> 6. Next Turn
    this.finalizeTurnLogs(turnLogsStart);

    return true;
  }

  /**
   * Executes a skill and enforces strict ordering:
   *   1. Attack (Primary skill header)
   *   2. Passive (Passive reactions triggered during the attack)
   *   3. Attacks (if applicable: Bonus/Repeat Attacks -> Ally Attacks -> Counterattacks)
   *   4. Outcomes (Debuffs/Buffs, Shield Absorptions, Heals, Defeats)
   */
  runSkillResolution(
    attacker,
    skill,
    targetId,
    { isFreeCounter = false, isTeamUp = false, isRepeatAttack = false } = {}
  ) {
    const frame = {
      phase: "attack",
      passiveLogs: [],
      followUpQueue: [],
      dedupKeys: new Set(),
    };
    this._resolutionStack.push(frame);
    const isPrimaryAttack =
      this._resolutionStack.length === 1 && !isFreeCounter && !isTeamUp && !isRepeatAttack && !skill._isRepeat;

    const attackCategory = isTeamUp
      ? "ally_attack"
      : isFreeCounter && !isRepeatAttack && !skill._isRepeat
      ? "counterattack"
      : "normal_attack";
    const attackPrefix = skill.isUniversal
      ? ""
      : attackCategory === "ally_attack"
      ? "[Ally Attack] "
      : attackCategory === "counterattack"
      ? "[Counterattack] "
      : "[Normal Attack] ";

    try {
      const preSkillLogsStart = this.logs.length;
      if (typeof skill.onBeforeSkill === "function") {
        skill.onBeforeSkill({ attacker, engine: this });
      }
      const preSkillLogs = this.logs.splice(preSkillLogsStart);
      let preSkillLogsFlushed = false;

      let targets = [];
      if (skill.targetType === "self") {
        targets = [attacker];
      } else if (skill.targetType === "all_allies") {
        targets = this.getLivingAlliesOf(attacker);
      } else if (skill.targetType === "all_enemies") {
        targets = this.getLivingEnemiesOf(attacker);
      } else if (skill.targetType === "any_unit") {
        const chosen =
          this.getUnitById(targetId) || this.getLivingEnemiesOf(attacker)[0];
        if (chosen) {
          targets = [chosen];
        }
      } else if (skill.targetType === "single_enemy") {
        const chosen =
          this.getUnitById(targetId) || this.getLivingEnemiesOf(attacker)[0];
        if (chosen && chosen.currentHp > 0) {
          targets = [chosen];
        }
      }

      if (typeof skill.execute === "function" && !skill.computeRawHit) {
        // Allow enemy-targeted status skills to be evaded by Yautja Cloak / Evasion
        if (
          !skill.undodgeable &&
          (skill.targetType === "single_enemy" || skill.targetType === "all_enemies")
        ) {
          const survivingTargets = [];
          for (const target of targets) {
            if (target.teamId !== attacker.teamId && target.currentHp > 0) {
              const evadeChance = this.getUnitEvasionChance(target);
              if (evadeChance > 0 && this.rng() < evadeChance) {
                this.log(
                  `${attackPrefix}${attacker.name} [${skill.name}] -> ${target.name}: EVADED (${Math.round(evadeChance * 100)}% Evasion).`,
                  attackCategory,
                  { isSkill: true, isPrimaryAttack }
                );
                if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
                  this.logs.push(...preSkillLogs);
                  preSkillLogsFlushed = true;
                }
                if (
                  !isFreeCounter &&
                  this.hasAbilityFlag(target, "counterOnEvade") &&
                  attacker.currentHp > 0
                ) {
                  this.logPassive(
                    `[${target.name}] Yautja Cloak triggers on Evasion and counterattacks with [Wrist Blades]!`
                  );
                  this.executeCounterSkill(target, "wrist_blades", attacker.id);
                }
                continue;
              }
            }
            survivingTargets.push(target);
          }
          targets = survivingTargets;
        }

        if (
          targets.length > 0 ||
          skill.targetType === "self" ||
          skill.targetType === "all_allies"
        ) {
          const execLogsStart = this.logs.length;
          skill.execute({ attacker, targets, engine: this });
          const addedLogs = this.logs.splice(execLogsStart);
          const skillHeaders = [];
          const skillEffects = [];
          for (const entry of addedLogs) {
            const isHeaderMsg =
              entry.isSkill ||
              entry.message.startsWith("[WAIT]") ||
              entry.message.startsWith("[REST]") ||
              entry.message.startsWith("[FORM]") ||
              entry.message.startsWith(`[${attacker.name}]`) ||
              entry.message.startsWith(`${attacker.name} casts`);
            if (isHeaderMsg && skillHeaders.length === 0) {
              entry.isSkill = true;
              entry.isPrimaryAttack = isPrimaryAttack;
              entry.type = skill.isUniversal ? "info" : attackCategory;
              if (
                !skill.isUniversal &&
                !entry.message.startsWith("[Normal Attack]") &&
                !entry.message.startsWith("[Counterattack]") &&
                !entry.message.startsWith("[Ally Attack]")
              ) {
                entry.message = `${attackPrefix}${entry.message}`;
              }
              skillHeaders.push(entry);
            } else {
              entry.isSkill = false;
              entry.isPrimaryAttack = false;
              skillEffects.push(entry);
            }
          }
          if (skillHeaders.length === 0) {
            const targetLabel =
              targets.map((t) => t.name).join(", ") || attacker.name;
            this.log(
              `${attackPrefix}${attacker.name} [${skill.name}] -> ${targetLabel}`,
              skill.isUniversal ? "info" : attackCategory,
              { isSkill: true, isPrimaryAttack }
            );
          } else {
            this.logs.push(...skillHeaders);
          }
          if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
            this.logs.push(...preSkillLogs);
            preSkillLogsFlushed = true;
          }
          this.logs.push(...skillEffects);
        }
      } else if (skill.computeRawHit) {
        const attackedDefendersThisSkill = new Set();

        for (const target of targets) {
          if (target.currentHp <= 0) continue;

          // 1. Evasion Check (Yautja Cloak, Predator Sprint, Refracting Mirror, Lens of Intangibility)
          if (!skill.undodgeable) {
            const evadeChance = this.getUnitEvasionChance(target);
            if (evadeChance > 0 && this.rng() < evadeChance) {
              this.log(
                `${attackPrefix}${attacker.name} [${skill.name}] -> ${target.name}: EVADED (${Math.round(evadeChance * 100)}% Evasion).`,
                attackCategory,
                { isSkill: true, isPrimaryAttack }
              );
              if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
                this.logs.push(...preSkillLogs);
                preSkillLogsFlushed = true;
              }
              if (
                !isFreeCounter &&
                this.hasAbilityFlag(target, "counterOnEvade") &&
                attacker.currentHp > 0
              ) {
                this.logPassive(
                  `[${target.name}] Yautja Cloak triggers on Evasion and counterattacks with [Wrist Blades]!`
                );
                this.executeCounterSkill(target, "wrist_blades", attacker.id);
              }
              continue;
            }
          }

          // 2. Accuracy Check (includes Blindness -20% accuracy penalty)
          if (!skill.undodgeable && skill.accuracy !== null) {
            const accBonus = this.getEffectiveStats(attacker).accuracyBonus || 0;
            const blindPenalty = this.statusManager.hasStatus(attacker, "blindness")
              ? -20
              : 0;
            const effectiveAcc = Math.max(
              5,
              Math.min(100, (skill.accuracy ?? 100) + accBonus + blindPenalty)
            );
            if (effectiveAcc < 100 && this.rng() * 100 > effectiveAcc) {
              this.log(
                `${attackPrefix}${attacker.name} [${skill.name}] -> ${target.name}: MISSED.`,
                attackCategory,
                { isSkill: true, isPrimaryAttack }
              );
              if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
                this.logs.push(...preSkillLogs);
                preSkillLogsFlushed = true;
              }
              continue;
            }
          }

          const hitEffectLogsStart = this.logs.length;
          target._absorbedByShieldThisSkill = 0;
          target._inSkillHitLoop = true;
          target._weakHitLoggedThisSkill = false;
          target._fredSharedDamageThisSkill = 0;
          target._fredInterceptorUnit = null;
          target._evadedSkillViaPassive = false;

          if (typeof skill.onBeforeAttack === "function") {
            skill.onBeforeAttack({ attacker, target, engine: this });
          }

          const hits =
            typeof skill.getDynamicHitCount === "function"
              ? skill.getDynamicHitCount({ attacker, target, engine: this })
              : skill.hits || 1;

          let totalDamageToTarget = 0;
          let critHitsCount = 0;
          let maxIgnoredDefPct = 0;
          const perHitAmounts = [];

          const bypassShieldsAndBlocks =
            Boolean(skill.bypassShieldsAndBlocks) ||
            (this.getActiveAbilities(attacker).some((a) => a.id === "lethal_lava") &&
              this.statusManager.hasStatus(target, "hex"));

          for (let h = 0; h < hits; h++) {
            if (target._justRevivedProtectThisSkill || target._evadedSkillViaPassive) break;

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
                isFreeCounter,
              });

            let dealt = damage;
            if (target.currentHp > 0) {
              dealt = this.applyCalculatedDamage(target, damage, {
                attacker,
                skill,
                bypassShieldsAndBlocks,
                bypassShields: Boolean(skill.bypassShields),
                bypassUnkillable: Boolean(skill.bypassUnkillable),
                silentShields: true,
              });
              if (target._evadedSkillViaPassive) break;
            } else if (
              !bypassShieldsAndBlocks &&
              this.statusManager.hasFlag(target, "blockDamage")
            ) {
              dealt = 0;
            }

            totalDamageToTarget += dealt;
            perHitAmounts.push(isCrit ? `${dealt}!` : `${dealt}`);
            if (isCrit) critHitsCount += 1;
            if (ignoredDefPct > maxIgnoredDefPct) maxIgnoredDefPct = ignoredDefPct;
            attackedDefendersThisSkill.add(target);

            if (this.statusManager.hasFlag(target, "removeOnDamage")) {
              this.statusManager.removeStatus(target, "sleep");
            }

            if (typeof skill.onEachHit === "function") {
              skill.onEachHit({ attacker, target, hitIndex: h, engine: this });
            }

            // Debt-Bearer Alnith's Marker of Debt on-hit proc & Blood Due healing
            if (this.hasAbilityFlag(attacker, "markerOfDebtOnHit") && target.currentHp > 0) {
              const totalEnemyStacks = this.getTotalEnemyBloodDue(attacker);
              const bonusChance = Math.min(0.25, totalEnemyStacks * 0.05);
              if (this.rng() < 0.5 + bonusChance) {
                const debuffPool = [
                  "poison_dot",
                  "burn",
                  "hemorrhage",
                  "acidic",
                  "windstruck",
                  "bleed",
                  "decay",
                ];
                const picked =
                  debuffPool[Math.floor(this.rng() * debuffPool.length)];
                this.statusManager.applyStatus(attacker, target, picked, {
                  duration: 1,
                  stacks: 1,
                });
              }
              const targetStacks = this.statusManager.getStacks(target, "blood_due");
              if (targetStacks > 0 && attacker.currentHp > 0) {
                const atkVal = this.getEffectiveStats(attacker).atk;
                const healAmt = Math.max(
                  1,
                  Math.round(atkVal * 0.04 * targetStacks)
                );
                attacker.currentHp = Math.min(
                  attacker.effectiveMaxHp,
                  attacker.currentHp + healAmt
                );
              }
            }

            const atkItemEachHit = this.getActiveItem(attacker);
            if (atkItemEachHit && typeof atkItemEachHit.onEachHit === "function") {
              atkItemEachHit.onEachHit({
                attacker,
                target,
                skill,
                hitIndex: h,
                engine: this,
              });
            }

            if (target.currentHp <= 0) {
              if (typeof skill.onTargetKilled === "function") {
                skill.onTargetKilled({ attacker, target, engine: this });
              }
            }
          }

          target._inSkillHitLoop = false;
          delete target._evadedSkillViaPassive;

          // Emit aggregated once-per-target passive & shield reactions:
          if (target._fredSharedDamageThisSkill > 0 && target._fredInterceptorUnit) {
            const fred = target._fredInterceptorUnit;
            const shared = target._fredSharedDamageThisSkill;
            const spartanCount = this.getSpartanAlliesCount(fred);
            this.logPassive(
              `[${fred.name}] [Defensive Bulwark] intercepts ${shared} DMG for ${target.name}!`
            );
            this.applyCalculatedDamage(fred, shared, {
              attacker,
              skill,
              isRedirectedDamage: true,
              silentShields: false,
            });
            if (fred.currentHp > 0) {
              const fredDefHealPct = spartanCount >= 1 ? 0.45 : 0.2;
              const fredHealAmt = Math.max(
                1,
                Math.floor(this.getEffectiveStats(fred).def * fredDefHealPct)
              );
              this.healUnit(fred, fredHealAmt, "Defensive Bulwark Regeneration", {
                isPassive: true,
              });
            }
            if (spartanCount >= 2 && fred.currentHp > 0) {
              const sVal = Math.floor(3.0 * this.getEffectiveStats(fred).def);
              fred.shieldHp = (fred.shieldHp || 0) + sVal;
              this.statusManager.applyStatus(fred, fred, "shield", {
                duration: 2,
                silent: true,
              });
              if (target.currentHp > 0) {
                target.shieldHp = (target.shieldHp || 0) + sVal;
                this.statusManager.applyStatus(fred, target, "shield", {
                  duration: 2,
                  silent: true,
                });
              }
              this.logPassive(
                `[Defensive Bulwark] ${fred.name} grants +${sVal} [Shield] (2T) to himself and ${target.name}.`
              );
            }
            if (
              spartanCount >= 3 &&
              fred.currentHp > 0 &&
              attacker &&
              attacker.currentHp > 0
            ) {
              this.logPassive(
                `[${fred.name}] [Defensive Bulwark (3 Spartan Allies)] counterattacks ${attacker.name} with [Countermand]!`
              );
              this.executeCounterSkill(fred, "countermand", attacker.id);
            }
          }
          delete target._fredSharedDamageThisSkill;
          delete target._fredInterceptorUnit;
          delete target._weakHitLoggedThisSkill;

          if (
            totalDamageToTarget > 0 &&
            attacker.currentHp > 0 &&
            this.hasAbilityFlag(attacker, "healOnDamageDealtPct")
          ) {
            const lifestealPct =
              this.getAbilityFlagValue(attacker, "healOnDamageDealtPct") || 0.25;
            const healAmt = Math.max(1, Math.round(totalDamageToTarget * lifestealPct));
            this.logPassive(
              `[${attacker.name}] [Pinpoint Accuracy] heals ${healAmt} HP from damage inflicted.`
            );
            this.healUnit(attacker, healAmt, "Pinpoint Accuracy");
          }

          if (totalDamageToTarget > 0 && target.currentHp > 0 && (target.shieldHp || 0) > 0) {
            const kelly = this.getLivingAlliesOf(target).find((u) =>
              this.hasAbilityFlag(u, "guardedReadyShieldEcho")
            );
            if (kelly) {
              const echoHeal = Math.max(1, Math.round(totalDamageToTarget * 0.5));
              this.logPassive(
                `[${kelly.name}] [Guarded and Ready] heals shielded ${target.name} for ${echoHeal} HP (50% of damage taken).`
              );
              this.healUnit(target, echoHeal, "Guarded and Ready");
            }
          }

          const bufferedHitEffectLogs = this.logs.splice(hitEffectLogsStart);
          const absorbedByShield = target._absorbedByShieldThisSkill || 0;
          delete target._absorbedByShieldThisSkill;

          // Single condensed log line per target combining all hits (Cause -> Effect):
          const absorbedSummary =
            absorbedByShield > 0 ? ` (${absorbedByShield} absorbed by Shield)` : "";
          const hitsBreakdown =
            perHitAmounts.length > 1
              ? ` (${perHitAmounts.length} hits: ${perHitAmounts.join(" + ")})`
              : "";
          const critSummary =
            critHitsCount > 0
              ? perHitAmounts.length > 1
                ? ` [${critHitsCount} CRIT]`
                : " [CRIT]"
              : "";
          const ignoreSummary =
            maxIgnoredDefPct > 0 ? ` [Ignored ${maxIgnoredDefPct}% DEF]` : "";

          this.log(
            `${attackPrefix}${attacker.name} [${skill.name}] -> ${target.name}: ${totalDamageToTarget} DMG${absorbedSummary}${hitsBreakdown}${critSummary}${ignoreSummary}`,
            attackCategory,
            { isSkill: true, isPrimaryAttack }
          );

          if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
            this.logs.push(...preSkillLogs);
            preSkillLogsFlushed = true;
          }
          this.logs.push(...bufferedHitEffectLogs);

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
                skill,
                damageDealt: totalDamageToTarget,
                engine: this,
              });
            }
          }

          if (typeof skill.onAfterAttack === "function") {
            skill.onAfterAttack({
              attacker,
              target,
              totalDamageToTarget,
              critHitsCount,
              engine: this,
              isRepeat: Boolean(skill._isRepeat),
            });
          }
        }

        if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
          this.logs.push(...preSkillLogs);
          preSkillLogsFlushed = true;
        }

        this.recalculateSoulSpearDestruction();

        // ============================================================
        // PHASE 2: PASSIVE (Flush passive triggers & evaluate post-attack passives)
        // ============================================================
        frame.phase = "passive";
        for (const msg of frame.passiveLogs) {
          this.log(msg, "passive", { isSkill: false });
        }
        frame.passiveLogs.length = 0;

        if (!isFreeCounter) {
          for (const defender of attackedDefendersThisSkill) {
            for (const ab of this.getActiveAbilities(defender)) {
              if (typeof ab.onAfterSkillAttacked === "function") {
                ab.onAfterSkillAttacked({ attacker, defender, skill, engine: this });
              }
            }
            // [Counterattack] buff: counterattack with basic move (0 Energy)
            if (
              defender.currentHp > 0 &&
              attacker.currentHp > 0 &&
              this.statusManager.hasFlag(defender, "counterOnAttacked")
            ) {
              const basicMoveId = defender.activeMoveIds?.[0];
              if (basicMoveId) {
                this.logPassive(
                  `[${defender.name}] [Counterattack] triggers and retaliates with [${Registry.getSkill(basicMoveId)?.name || basicMoveId}]!`
                );
                this.executeCounterSkill(defender, basicMoveId, attacker.id);
              }
            }
          }

          // ByuN's Micro Jackson: when an enemy is attacked by an ally, 20% chance for ByuN to join in with [2-Barrack Rush]
          if (attackedDefendersThisSkill.size > 0) {
            const primaryTarget = [...attackedDefendersThisSkill][0];
            const allyByuns = this.getLivingAlliesOf(attacker).filter(
              (u) =>
                u.id !== attacker.id &&
                this.hasAbilityFlag(u, "allyAttackJoinChance")
            );
            for (const byun of allyByuns) {
              if (primaryTarget.currentHp > 0 && this.rng() < 0.2) {
                this.logPassive(
                  `[${byun.name}] Micro Jackson coordinates with ${attacker.name} to join in with [2-Barrack Rush]!`
                );
                this.executeAllySkill(byun, "two_barrack_rush", primaryTarget.id);
              }
            }
          }
        }

        // Spartan Strike Team join-in: When a Spartan attacks or counterattacks, other living Spartans join in with basic skill
        if (
          !isTeamUp &&
          !isRepeatAttack &&
          !skill._isRepeat &&
          this.hasAbilityFlag(attacker, "spartanTeamUp") &&
          attackedDefendersThisSkill.size > 0
        ) {
          const primaryTarget = [...attackedDefendersThisSkill][0];
          this.triggerSpartanTeamUp(attacker, primaryTarget);
        }
      } else {
        if (!preSkillLogsFlushed && preSkillLogs.length > 0) {
          this.logs.push(...preSkillLogs);
          preSkillLogsFlushed = true;
        }
        frame.phase = "passive";
        for (const msg of frame.passiveLogs) {
          this.log(msg, "passive", { isSkill: false });
        }
        frame.passiveLogs.length = 0;
      }

      // ============================================================
      // PHASE 3: ATTACKS (IF APPLICABLE) — Repeat/Bonus -> Ally Attacks -> Counterattacks
      // ============================================================
      frame.phase = "followup";
      if (typeof skill.onAfterSkill === "function") {
        skill.onAfterSkill({ attacker, targets, engine: this });
      }

      if (frame.followUpQueue.length > 0) {
        const priorityOrder = { bonus: 1, ally_attack: 2, counterattack: 3 };
        const sortedQueue = [...frame.followUpQueue].sort(
          (a, b) => (priorityOrder[a.category] || 9) - (priorityOrder[b.category] || 9)
        );
        frame.followUpQueue.length = 0;
        for (const item of sortedQueue) {
          if (this.winnerTeam) break;
          item.fn();
        }
      }

      if (!isFreeCounter) {
        for (const u of this.units) {
          if (u._justRevivedProtectThisSkill) {
            delete u._justRevivedProtectThisSkill;
          }
        }
      }
    } finally {
      this._resolutionStack.pop();
    }
  }

  computeAiAction(unit) {
    if (!unit || unit.currentHp <= 0) return null;
    const allMoves = this.getAvailableMovesForUnit(unit);
    const usableMoves = allMoves.filter((m) => m.usable);
    const enemies = this.getLivingEnemiesOf(unit);
    if (enemies.length === 0 || usableMoves.length === 0) return null;

    const hexTarget = enemies.find((e) => this.statusManager.hasStatus(e, "hex"));
    const lowestHpTarget = [...enemies].sort((a, b) => a.currentHp - b.currentHp)[0];
    const defaultTarget = hexTarget || lowestHpTarget || enemies[0];

    if (unit.forcedNextSkillId) {
      const forcedUsable = usableMoves.find((m) => m.id === unit.forcedNextSkillId);
      if (forcedUsable) {
        return { actorId: unit.id, moveId: forcedUsable.id, targetId: defaultTarget.id };
      }
      const energyMove = unit.currentHp > unit.effectiveMaxHp * 0.5 ? "rest" : "wait";
      return { actorId: unit.id, moveId: energyMove, targetId: unit.id };
    }

    const setupSkills = usableMoves.filter((m) => Boolean(m.forcesNextSkill));
    if (setupSkills.length > 0) {
      return {
        actorId: unit.id,
        moveId: setupSkills[0].id,
        targetId: defaultTarget.id,
      };
    }

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
    this.units.forEach((u) => {
      u.shieldHp = u.shieldHp || 0;
      u.magmaShieldHp = u.magmaShieldHp || 0;
      this.syncUnitActiveMoves(u);
    });
    this.logs = snapshot.logs || [];
  }
}
