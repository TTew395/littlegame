/**
 * DamagePipeline
 * Handles all stat calculations and damage formulas:
 * - Effective Stats (Base + Item + Status Buffs/Debuffs + Stance + Passive Abilities)
 * - Negative Defense support (e.g. First Genius, Zander Evolution State DEF: -50 = +50% damage taken)
 * - STAB (Same-Type Attack Bonus: 1.25x)
 * - Critical Hits (Crit Rate & Crit Damage)
 * - Defense Mitigation & Ignore DEF %
 * - Stacking Vulnerability (+10% damage taken per stack) & War Armor (-4% per stack)
 * - Outgoing & Incoming Ability Modifiers (Gravewalker, Astral Ward, Forever Waiting)
 * - Tied Construct Vulnerability (Soul Spear takes +100% damage from its tied hero)
 */

import { Registry } from "./Registry.js";

export class DamagePipeline {
  constructor(engine) {
    this.engine = engine;
  }

  getEffectiveStats(unit) {
    const stats = {
      hp: unit.effectiveMaxHp ?? unit.baseMaxHp ?? 100,
      maxHp: unit.effectiveMaxHp ?? unit.baseMaxHp ?? 100,
      energy: unit.maxEnergy ?? 100,
      atk: unit.baseStats.atk,
      def: unit.baseStats.def,
      spd: unit.baseStats.spd,
      critRate: unit.baseStats.critRate ?? 15,
      critDmg: unit.baseStats.critDmg ?? 50,
      accuracyBonus: 0,
    };

    // 1. Item stat bonuses (disabled if unit is under [Seal])
    const isSealed = this.engine.statusManager.hasFlag(unit, "sealItems");
    if (!isSealed && unit.itemId && unit.itemId !== "none") {
      const item = Registry.getItem(unit.itemId);
      if (item && item.statBonuses) {
        if (item.statBonuses.atk) stats.atk += item.statBonuses.atk;
        if (item.statBonuses.def) stats.def += item.statBonuses.def;
        if (item.statBonuses.spd) stats.spd += item.statBonuses.spd;
        if (item.statBonuses.critRate) stats.critRate += item.statBonuses.critRate;
        if (item.statBonuses.critDmg) stats.critDmg += item.statBonuses.critDmg;
        if (item.statBonuses.accuracyBonus) {
          stats.accuracyBonus += item.statBonuses.accuracyBonus;
        }
        if (item.statBonuses.spdMultiplier) {
          stats.spd = Math.floor(stats.spd * item.statBonuses.spdMultiplier);
        }
      }
      if (item && typeof item.modifyStats === "function") {
        item.modifyStats({ unit, stats, engine: this.engine });
      }
    }

    // Dynamic item counters (Rocket Boots, Remnant)
    if (unit.customCounters?.rocketBootsSpdBonus) {
      stats.spd += unit.customCounters.rocketBootsSpdBonus;
    }
    if (unit.customCounters?.remnantAtkBonusPct) {
      stats.atk *= 1 + unit.customCounters.remnantAtkBonusPct;
    }

    // 2. Status modifiers (Buffs & Debuffs)
    for (const st of unit.statuses) {
      const def = Registry.getStatus(st.id);
      if (!def || !def.statModifiers) continue;
      const mod = def.statModifiers;
      if (mod.atkMultiplier !== undefined) stats.atk *= mod.atkMultiplier;
      if (mod.defMultiplier !== undefined && stats.def > 0) {
        stats.def *= mod.defMultiplier;
      }
      if (mod.spdMultiplier !== undefined) stats.spd *= mod.spdMultiplier;
      if (mod.critRateBonus !== undefined) stats.critRate += mod.critRateBonus;
      if (mod.critDmgBonus !== undefined) stats.critDmg += mod.critDmgBonus;
      if (mod.critDmgPerStack) stats.critDmg += mod.critDmgPerStack * st.stacks;
    }

    stats.critRate = Math.max(0, Math.min(100, stats.critRate));
    stats.critDmg = Math.max(0, stats.critDmg);

    // 3. Stance modifier: "Rest" halves defense until turn comes back to the character
    if (unit.stance === "rest" && stats.def > 0) {
      stats.def *= 0.5;
    }

    // 4. Passive Ability stat hooks (e.g., Karnage's Avatar of Anarchy, Ouroboros Brood Queen)
    const abilities = this.engine.getActiveAbilities(unit);
    for (const ab of abilities) {
      if (typeof ab.modifyStats === "function") {
        ab.modifyStats({ unit, stats, engine: this.engine });
      }
    }

    stats.atk = Math.max(1, Math.round(stats.atk * 10) / 10);
    // Allow negative defense (e.g. Zander Evolution State DEF: -50 = +50% damage)
    stats.def = Math.round(stats.def * 10) / 10;
    stats.spd = Math.max(1, Math.round(stats.spd));
    return stats;
  }

  computeHitDamage({
    attacker,
    target,
    skill,
    ignoreDefPct = 0,
    hitIndex = 0,
    isFreeCounter = false,
  }) {
    const atkStats = this.getEffectiveStats(attacker);
    const tgtStats = this.getEffectiveStats(target);

    // 1. Base raw damage from skill formula
    let rawDamage = skill.computeRawHit({
      attacker,
      target,
      stats: atkStats,
      targetStats: tgtStats,
      hitIndex,
      engine: this.engine,
    });
    if (!Number.isFinite(rawDamage) || rawDamage < 0) {
      rawDamage = atkStats.atk || 1;
    }

    // Cap skills that scale off ENEMY MAX HP against Almighty Immunity bosses (e.g. For One is Holy)
    if (
      this.engine.hasAbilityFlag(target, "capEnemyMaxHpScalingPct") &&
      skill.id === "for_one_is_holy"
    ) {
      rawDamage = Math.min(rawDamage, target.effectiveMaxHp * 0.1);
    }

    // Human Species: +10% damage on basic moves
    const passivesBlocked = this.engine.statusManager.hasFlag(attacker, "blockPassives");
    if (!passivesBlocked && attacker.speciesId) {
      const atkSpecies = Registry.getSpecies(attacker.speciesId);
      const isBasicSlotMove =
        skill.isBasicMove || (attacker.activeMoveIds && attacker.activeMoveIds[0] === skill.id);
      if (atkSpecies && atkSpecies.basicMoveDamageMultiplier && isBasicSlotMove) {
        rawDamage *= atkSpecies.basicMoveDamageMultiplier;
      }
    }

    // Counterattack bonus (Arix's Cursed Holder: +25% counterattack damage)
    if (isFreeCounter) {
      const mult = this.engine.getAbilityFlagValue(attacker, "counterattackDmgMultiplier");
      if (mult) {
        rawDamage *= mult;
      }
    }

    // 2. STAB (Same-Type Attack Bonus)
    const hasStab =
      skill.stab === true ||
      (attacker.types && attacker.types.includes(skill.element));
    if (hasStab && skill.element && skill.element !== "None") {
      rawDamage *= 1.25;
    }

    // 3. Critical Hit Roll (Supports guaranteed crit skills and Wrongly Created 2.0x crit)
    let isCrit =
      Boolean(skill.alwaysCrit) || this.engine.rng() * 100 < atkStats.critRate;

    // Linda-034's Pinpoint Accuracy: cannot receive crits from enemies with lower ATK
    if (isCrit && target && this.engine.hasAbilityFlag(target, "immuneToCritFromLowerAtk")) {
      const tgtAtk = this.engine.getEffectiveStats(target).atk;
      if (atkStats.atk < tgtAtk) {
        isCrit = false;
      }
    }

    // John-117's Luck Is On My Side: 25% chance of converting hits to weak hits (30% less damage, cannot crit)
    if (target && this.engine.hasAbilityFlag(target, "convertHitsToWeakHitsChance")) {
      const weakChance =
        this.engine.getAbilityFlagValue(target, "convertHitsToWeakHitsChance") || 0.25;
      if (this.engine.rng() < weakChance) {
        isCrit = false;
        rawDamage *= 0.7;
        this.engine.log(
          `[Weak Hit] ${target.name}'s Luck Is On My Side glanced the incoming blow (-30% DMG)!`,
          "info"
        );
      }
    }

    if (isCrit) {
      const fixedCritMult = this.engine.getAbilityFlagValue(attacker, "fixedCritMultiplier");
      if (fixedCritMult) {
        rawDamage *= fixedCritMult;
      } else {
        rawDamage *= 1 + atkStats.critDmg / 100;
      }
    }

    // Kelly-087's Calculated Fortification damage bonus
    if (attacker.customCounters?.calculatedFortBonusDmgPct) {
      rawDamage *= 1 + attacker.customCounters.calculatedFortBonusDmgPct;
    }

    // 4. Defense Mitigation (Supports positive DEF reduction and negative DEF amplification)
    let clampedIgnoreDef = Math.max(0, Math.min(1, ignoreDefPct));

    // Linda-034's Pinpoint Accuracy: hits ignore 20% DEF of targets with lower ATK
    if (target && this.engine.hasAbilityFlag(attacker, "ignoreDefAgainstLowerAtk")) {
      const tgtAtk = this.engine.getEffectiveStats(target).atk;
      if (atkStats.atk > tgtAtk) {
        clampedIgnoreDef = Math.min(1.0, clampedIgnoreDef + 0.2);
      }
    }

    // Item Ignore DEF bonus (e.g. Crushing Warhammer, Refracting Mirror)
    const atkItem = this.engine.getActiveItem(attacker);
    const ignoreDefFn =
      atkItem &&
      (typeof atkItem.getExtraIgnoreDefPct === "function"
        ? atkItem.getExtraIgnoreDefPct.bind(atkItem)
        : typeof atkItem.getBonusIgnoreDef === "function"
        ? atkItem.getBonusIgnoreDef.bind(atkItem)
        : null);
    if (ignoreDefFn) {
      const extraIgnore = ignoreDefFn({
        attacker,
        target,
        skill,
        engine: this.engine,
      });
      if (extraIgnore > 0) {
        clampedIgnoreDef = Math.min(1, clampedIgnoreDef + extraIgnore);
      }
    }

    // Check Dragonblood Fury passive bonus
    if (
      this.engine
        .getActiveAbilities(attacker)
        .some((a) => a.id === "dragon_blood_fury")
    ) {
      if (target.currentHp / target.effectiveMaxHp >= 0.5) {
        rawDamage *= 1.15;
      } else {
        clampedIgnoreDef = Math.min(1, clampedIgnoreDef + 0.2);
      }
    }

    let finalDamage = rawDamage;
    if (tgtStats.def >= 0) {
      const effectiveDefPct = Math.max(
        0,
        Math.min(0.85, (tgtStats.def * (1 - clampedIgnoreDef)) / 100)
      );
      finalDamage = rawDamage * (1 - effectiveDefPct);
    } else {
      // Negative DEF increases damage taken (e.g. DEF -50 => +50% damage)
      const ampPct = Math.abs(tgtStats.def) / 100;
      finalDamage = rawDamage * (1 + ampPct);
    }

    // 5. Outgoing damage ability & item modifiers (e.g. Novok's Gravewalker, Tethren's Auric Soul, Bayonet)
    for (const ab of this.engine.getActiveAbilities(attacker)) {
      if (typeof ab.modifyOutgoingDamage === "function") {
        finalDamage = ab.modifyOutgoingDamage({
          attacker,
          defender: target,
          skill,
          damage: finalDamage,
          engine: this.engine,
        });
      }
    }
    if (atkItem && typeof atkItem.modifyOutgoingDamage === "function") {
      finalDamage = atkItem.modifyOutgoingDamage({
        attacker,
        defender: target,
        skill,
        damage: finalDamage,
        engine: this.engine,
      });
    }

    // Team Aura: Tethren Dragonsoul's Auric Soul (+10% damage to burning enemies)
    const attackerTeamHasAuricSoul = this.engine.units.some(
      (ally) =>
        ally.teamId === attacker.teamId &&
        (this.engine.hasAbilityFlag(ally, "auricSoulTeamBurnAura") ||
          (ally.abilityIds || []).includes("auric_soul"))
    );
    if (
      attackerTeamHasAuricSoul &&
      this.engine.statusManager.hasStatus(target, "burn")
    ) {
      finalDamage *= 1.1;
    }

    // 6. Buff / Passive / Species / Item damage reduction (Skipped if skill has bypassMitigation: true)
    if (!skill.bypassMitigation) {
      const tgtPassivesBlocked = this.engine.statusManager.hasFlag(
        target,
        "blockPassives"
      );
      if (!tgtPassivesBlocked && target.speciesId) {
        const sp = Registry.getSpecies(target.speciesId);
        if (
          sp &&
          sp.damageReductionByType &&
          sp.damageReductionByType[skill.element] !== undefined
        ) {
          const reduction = sp.damageReductionByType[skill.element];
          finalDamage *= 1 - reduction;
        }
      }

      // Status-based damage modifiers (War Armor, Forever Waiting, Deathbrand, Vulnerability, Brittle, Decay)
      for (const st of target.statuses) {
        if (skill.bypassShieldsAndBlocks && (st.id === "strengthen" || st.id === "ally_protection")) {
          continue;
        }
        const def = Registry.getStatus(st.id);
        if (!def || !def.statModifiers) continue;
        if (def.statModifiers.dmgReductionPerStack) {
          const red = Math.min(
            0.9,
            def.statModifiers.dmgReductionPerStack * st.stacks
          );
          finalDamage *= 1 - red;
        }
        if (def.statModifiers.incomingDmgPerStack) {
          finalDamage *= 1 + def.statModifiers.incomingDmgPerStack * st.stacks;
        }
        if (def.statModifiers.incomingDamageMultiplier) {
          finalDamage *= def.statModifiers.incomingDamageMultiplier;
        }
      }

      // Team Aura: Tethren Dragonsoul's Auric Soul (-10% damage taken from burning attackers)
      const defenderTeamHasAuricSoul = this.engine.units.some(
        (ally) =>
          ally.teamId === target.teamId &&
          (this.engine.hasAbilityFlag(ally, "auricSoulTeamBurnAura") ||
            (ally.abilityIds || []).includes("auric_soul"))
      );
      if (
        defenderTeamHasAuricSoul &&
        this.engine.statusManager.hasStatus(attacker, "burn")
      ) {
        finalDamage *= 0.9;
      }

      // Team aura / Defender passives (e.g. Seraphina's Astral Ward, Novok's Gravewalker, ByuN's Micro Jackson)
      const targetAllies = this.engine.getLivingAlliesOf(target);
      for (const ally of targetAllies) {
        for (const ab of this.engine.getActiveAbilities(ally)) {
          if (typeof ab.modifyIncomingDamage === "function") {
            finalDamage = ab.modifyIncomingDamage({
              unit: ally,
              attacker,
              defender: target,
              skill,
              damage: finalDamage,
              engine: this.engine,
            });
          }
        }
      }

      // Defender Item incoming damage modifier (Chitin Plating, Gilded Diamond, Mask of Rage, Frozen Quartz)
      const defItem = this.engine.getActiveItem(target);
      if (defItem && typeof defItem.modifyIncomingDamage === "function") {
        finalDamage = defItem.modifyIncomingDamage({
          attacker,
          defender: target,
          skill,
          damage: finalDamage,
          engine: this.engine,
        });
      }
    }

    // 7. Soul Spear Linked Target Vulnerability (+100% damage from tied character)
    if (target.isSummon && target.linkedTargetId === attacker.id) {
      finalDamage *= 2.0;
    }

    const safeFinalDamage = Number.isFinite(finalDamage) ? finalDamage : 1;
    return {
      damage: Math.max(1, Math.round(safeFinalDamage)),
      isCrit,
      ignoredDefPct: Math.round(clampedIgnoreDef * 100),
    };
  }
}
