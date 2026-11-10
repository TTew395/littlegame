/**
 * DamagePipeline
 * Handles all stat calculations and damage formulas:
 * - Effective Stats (Base + Item + Status Buffs/Debuffs + Stance + Passive Abilities like Avatar of Anarchy)
 * - STAB (Same-Type Attack Bonus: 1.25x)
 * - Critical Hits (Crit Rate & Crit Damage)
 * - Defense Mitigation (e.g. Defense 15 = 15% reduction) & Ignore DEF % (Reality Reversal, Pyre of High Graves, All Realms Leveled)
 * - Species Elemental Resistances (e.g. Higher Being: 50% reduced damage from Chaos, Dragon, Tek)
 * - Stacking Damage Reduction (Antikhonor's War Armor: 4% per stack)
 * - Tied Construct Vulnerability (Soul Spear takes +100% damage from its tied hero)
 */

import { Registry } from "./Registry.js";

export class DamagePipeline {
  constructor(engine) {
    this.engine = engine;
  }

  getEffectiveStats(unit) {
    const stats = {
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
    }

    // 2. Status modifiers (Buffs & Debuffs)
    for (const st of unit.statuses) {
      const def = Registry.getStatus(st.id);
      if (!def || !def.statModifiers) continue;
      const mod = def.statModifiers;
      if (mod.atkMultiplier) stats.atk *= mod.atkMultiplier;
      if (mod.defMultiplier) stats.def *= mod.defMultiplier;
      if (mod.spdMultiplier) stats.spd *= mod.spdMultiplier;
      if (mod.critDmgPerStack) stats.critDmg += mod.critDmgPerStack * st.stacks;
    }

    // 3. Stance modifier: "Rest" halves defense until turn comes back to the character
    if (unit.stance === "rest") {
      stats.def *= 0.5;
    }

    // 4. Passive Ability stat hooks (e.g., Karnage's Avatar of Anarchy: +1 C.DMG per 3 SPD)
    const abilities = this.engine.getActiveAbilities(unit);
    for (const ab of abilities) {
      if (typeof ab.modifyStats === "function") {
        ab.modifyStats({ unit, stats, engine: this.engine });
      }
    }

    stats.atk = Math.max(1, Math.round(stats.atk * 10) / 10);
    stats.def = Math.max(0, Math.round(stats.def * 10) / 10);
    stats.spd = Math.max(1, Math.round(stats.spd));
    return stats;
  }

  computeHitDamage({ attacker, target, skill, ignoreDefPct = 0 }) {
    const atkStats = this.getEffectiveStats(attacker);
    const tgtStats = this.getEffectiveStats(target);

    // 1. Base raw damage from skill formula
    let rawDamage = skill.computeRawHit({
      attacker,
      target,
      stats: atkStats,
      targetStats: tgtStats,
      engine: this.engine,
    });

    // 2. STAB (Same-Type Attack Bonus)
    const hasStab =
      skill.stab === true ||
      (attacker.types && attacker.types.includes(skill.element));
    if (hasStab && skill.element && skill.element !== "None") {
      rawDamage *= 1.25;
    }

    // 3. Critical Hit Roll
    const isCrit = this.engine.rng() * 100 < atkStats.critRate;
    if (isCrit) {
      rawDamage *= 1 + atkStats.critDmg / 100;
    }

    // 4. Defense Mitigation (e.g., DEF 15 = 15% damage reduction, reduced by ignoreDefPct)
    let clampedIgnoreDef = Math.max(0, Math.min(1, ignoreDefPct));

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

    const effectiveDefPct = Math.max(
      0,
      Math.min(0.85, (tgtStats.def * (1 - clampedIgnoreDef)) / 100)
    );
    let finalDamage = rawDamage * (1 - effectiveDefPct);

    // 5. Buff / Passive / Species damage reduction (Skipped if skill has bypassMitigation: true, like All Realms Leveled)
    if (!skill.bypassMitigation) {
      // Species damage reduction (e.g. Higher Being: 50% reduced damage from Chaos, Dragon, Tek)
      const passivesBlocked = this.engine.statusManager.hasFlag(
        target,
        "blockPassives"
      );
      if (!passivesBlocked && target.speciesId) {
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

      // Status-based damage modifiers (e.g., War Armor: -4% per stack, Deathbrand: +25% damage taken)
      for (const st of target.statuses) {
        const def = Registry.getStatus(st.id);
        if (!def || !def.statModifiers) continue;
        if (def.statModifiers.dmgReductionPerStack) {
          const red = Math.min(
            0.9,
            def.statModifiers.dmgReductionPerStack * st.stacks
          );
          finalDamage *= 1 - red;
        }
        if (def.statModifiers.incomingDamageMultiplier) {
          finalDamage *= def.statModifiers.incomingDamageMultiplier;
        }
      }

      // Team aura passives (e.g., Seraphina's Astral Ward)
      const targetAllies = this.engine.getLivingAlliesOf(target);
      for (const ally of targetAllies) {
        for (const ab of this.engine.getActiveAbilities(ally)) {
          if (typeof ab.modifyIncomingDamage === "function") {
            finalDamage = ab.modifyIncomingDamage({
              attacker,
              defender: target,
              damage: finalDamage,
            });
          }
        }
      }
    }

    // 6. Soul Spear Linked Target Vulnerability:
    // "Soul Spears take 100% more damage from the characters they are tied to."
    if (target.isSummon && target.linkedTargetId === attacker.id) {
      finalDamage *= 2.0;
    }

    return {
      damage: Math.max(1, Math.round(finalDamage)),
      isCrit,
      ignoredDefPct: Math.round(clampedIgnoreDef * 100),
    };
  }
}
