/**
 * StatusManager (Emoji-free)
 */

import { Registry } from "./Registry.js";

export class StatusManager {
  constructor(engine) {
    this.engine = engine;
  }

  hasStatus(unit, statusId) {
    return unit.statuses.some((s) => s.id === statusId && s.stacks > 0);
  }

  getStacks(unit, statusId) {
    const found = unit.statuses.find((s) => s.id === statusId);
    return found ? found.stacks : 0;
  }

  countCategory(unit, category) {
    return unit.statuses.filter((s) => {
      const def = Registry.getStatus(s.id);
      return def && def.category === category;
    }).length;
  }

  hasFlag(unit, flagName) {
    return unit.statuses.some((s) => {
      const def = Registry.getStatus(s.id);
      return def && def.flags && def.flags[flagName];
    });
  }

  isImmuneTo(target, statusId) {
    const abilities = this.engine.getActiveAbilities(target);
    for (const ab of abilities) {
      if (ab.immunities && ab.immunities.includes(statusId)) {
        return true;
      }
    }
    const item = this.engine.getActiveItem(target);
    if (item && item.immunities && item.immunities.includes(statusId)) {
      return true;
    }
    return false;
  }

  applyStatus(
    source,
    target,
    statusId,
    {
      duration = null,
      stacks = 1,
      isProtected = false,
      bypassImmunity = false,
      silent = false,
      isReflected = false,
    } = {}
  ) {
    if (!target || target.currentHp <= 0) return false;
    const def = Registry.getStatus(statusId);
    if (!def) return false;
    if (target._justRevivedProtectThisSkill && def.category === "debuff") {
      return false;
    }

    // Special Boss Hook: Ternax Hellfire's "Lethal Lava"
    if (
      statusId === "burn" &&
      this.engine.getActiveAbilities(target).some((a) => a.id === "lethal_lava")
    ) {
      const healAmt = Math.max(1, Math.floor(target.effectiveMaxHp * 0.1));
      target.currentHp = Math.min(target.effectiveMaxHp, target.currentHp + healAmt);
      this.engine.log(
        `[${target.name}] Lethal Lava absorbs [Burn] and heals ${healAmt} HP (10% MAX HP).`,
        "heal",
        { isSkill: false }
      );
      return false;
    }

    if (def.category === "debuff" && !bypassImmunity) {
      if (this.isImmuneTo(target, statusId)) {
        if (!silent) {
          this.engine.log(`${target.name} is immune to [${def.name}].`, "info", {
            isSkill: false,
          });
        }
        // Marius the Gallant's Steadfast Knight: counterattack with Auric Lance when enemy attempts to place [Decrease SPD]
        if (
          (statusId === "spd_down" || statusId === "windstruck") &&
          source &&
          source.teamId !== target.teamId &&
          this.engine.hasAbilityFlag(target, "counterOnSpdDownAttempt")
        ) {
          this.engine.log(
            `[${target.name}] Steadfast Knight triggers against [${def.name}] attempt and counterattacks with [Auric Lance]!`,
            "special",
            { isSkill: false }
          );
          this.engine.executeCounterSkill(target, "auric_lance", source.id);
        }
        return false;
      }
      if (this.hasFlag(target, "blockDebuffs")) {
        if (!silent) {
          this.engine.log(
            `${target.name}'s [Block Debuffs] blocked [${def.name}].`,
            "info",
            { isSkill: false }
          );
        }
        return false;
      }

      // Unbroken Sheath: 30% chance to block incoming debuffs
      const targetItem = this.engine.getActiveItem(target);
      if (targetItem && targetItem.id === "unbroken_sheath" && this.engine.rng() < 0.3) {
        if (!silent) {
          this.engine.log(
            `${target.name}'s [Unbroken Sheath] blocked [${def.name}].`,
            "info",
            { isSkill: false }
          );
        }
        return false;
      }

      // Wand of Submission: 50% chance to reflect debuff back onto attacker
      if (
        !isReflected &&
        targetItem &&
        targetItem.id === "wand_of_submission" &&
        source &&
        source.id !== target.id &&
        this.engine.rng() < 0.5
      ) {
        this.engine.log(
          `${target.name}'s [Wand of Submission] reflects [${def.name}] back onto ${source.name}!`,
          "special",
          { isSkill: false }
        );
        return this.applyStatus(target, source, statusId, {
          duration,
          stacks,
          isProtected,
          bypassImmunity,
          silent,
          isReflected: true,
        });
      }
    }

    // Item status amplifiers: Blossoming Spore Rod (30% chance to double debuff) & That-One-Double-Effect-Orb
    let effectiveStacks = stacks;
    let effectiveDuration = duration;
    const sourceItem = source ? this.engine.getActiveItem(source) : null;
    if (
      def.category === "debuff" &&
      sourceItem &&
      sourceItem.id === "blossoming_spore_rod" &&
      this.engine.rng() < 0.3
    ) {
      if (def.stackBehavior === "stack") {
        effectiveStacks *= 2;
      } else if (effectiveDuration !== null) {
        effectiveDuration *= 2;
      }
      if (!silent) {
        this.engine.log(
          `[${source.name}] Blossoming Spore Rod doubles [${def.name}]!`,
          "special",
          { isSkill: false }
        );
      }
    }
    const targetItem = this.engine.getActiveItem(target);
    if (targetItem && targetItem.id === "that_one_double_effect_orb") {
      if (def.stackBehavior === "stack") {
        effectiveStacks *= 2;
      } else if (effectiveDuration !== null) {
        effectiveDuration *= 2;
      }
    }

    const protectedFlag = Boolean(isProtected || def.isProtectedByDefault);
    const existing = target.statuses.find((s) => s.id === statusId);

    if (existing) {
      if (def.stackBehavior === "stack") {
        existing.stacks = Math.min(
          def.maxStacks || 99,
          existing.stacks + effectiveStacks
        );
        if (effectiveDuration !== null) {
          existing.duration = Math.max(existing.duration ?? 0, effectiveDuration);
        }
        existing.isProtected = existing.isProtected || protectedFlag;
      } else {
        if (effectiveDuration !== null) {
          existing.duration = Math.max(existing.duration ?? 0, effectiveDuration);
        }
        existing.isProtected = existing.isProtected || protectedFlag;
      }
    } else {
      target.statuses.push({
        id: statusId,
        name: def.name,
        icon: def.icon,
        category: def.category,
        tickTiming: def.tickTiming,
        stacks:
          def.stackBehavior === "stack"
            ? Math.min(def.maxStacks || 99, effectiveStacks)
            : 1,
        duration: def.tickTiming === "NEVER" ? null : effectiveDuration,
        isProtected: protectedFlag,
      });
    }

    if (!silent) {
      const protText = protectedFlag ? " [PROTECTED]" : "";
      const durText =
        def.tickTiming === "NEVER" || effectiveDuration === null
          ? ""
          : ` (${effectiveDuration}T)`;
      const stackText =
        def.stackBehavior === "stack"
          ? ` [x${this.getStacks(target, statusId)}]`
          : "";
      this.engine.log(
        `${target.name} gains [${def.name}]${stackText}${durText}${protText}.`,
        def.category === "debuff" ? "status" : "info",
        { isSkill: false }
      );
    }

    // Debt-Bearer Alnith's Marker of Debt: whenever a debuff is placed on an enemy, apply 1 stack of [Blood Due]
    if (def.category === "debuff" && statusId !== "blood_due") {
      const opposingAlniths = this.engine
        .getLivingEnemiesOf(target)
        .filter((u) => this.engine.hasAbilityFlag(u, "applyBloodDueOnDebuff"));
      if (opposingAlniths.length > 0) {
        this.engine.addBloodDueStack(opposingAlniths[0], target, 1);
      }
    }

    // Solanar the Gleaming's Scholar of Sun / Solar Nova: 20% chance to counterattack with [Solar Nova] when any character receives a buff
    if (def.category === "buff" && this.engine.turnNumber > 0) {
      this.engine.triggerSolarNovaReaction(target, `${target.name}'s [${def.name}] buff`);
    }

    return true;
  }

  setStatusStacks(target, statusId, stacks, { isProtected = false } = {}) {
    if (stacks <= 0) {
      this.removeStatus(target, statusId, { forceProtected: true });
      return;
    }
    const def = Registry.getStatus(statusId);
    if (!def) return;

    const existing = target.statuses.find((s) => s.id === statusId);
    const prevStacks = existing ? existing.stacks : 0;
    if (existing) {
      existing.stacks = Math.min(def.maxStacks || 99, stacks);
      existing.isProtected =
        existing.isProtected || isProtected || Boolean(def.isProtectedByDefault);
    } else {
      target.statuses.push({
        id: statusId,
        name: def.name,
        icon: def.icon,
        category: def.category,
        tickTiming: def.tickTiming,
        stacks: Math.min(def.maxStacks || 99, stacks),
        duration: null,
        isProtected: isProtected || Boolean(def.isProtectedByDefault),
      });
    }

    if (
      stacks > prevStacks &&
      this.engine.turnNumber > 0 &&
      (def.category === "buff" ||
        ["war_armor", "brood_atk_boost", "forever_waiting_guard"].includes(statusId))
    ) {
      this.engine.triggerSolarNovaReaction(target, `${target.name}'s [${def.name}]`);
    }
  }

  addStacks(target, statusId, delta) {
    const current = this.getStacks(target, statusId);
    this.setStatusStacks(target, statusId, current + delta);
  }

  removeStatus(target, statusId, { forceProtected = false } = {}) {
    target.statuses = target.statuses.filter((s) => {
      if (s.id !== statusId) return true;
      if (s.isProtected && !forceProtected) return true;
      return false;
    });
    if (statusId === "shield") {
      target.shieldHp = 0;
    }
  }

  cleanseOneDebuff(target) {
    const teamHasAuricSoul = this.engine.units.some(
      (ally) =>
        ally.teamId === target.teamId &&
        (this.engine.hasAbilityFlag(ally, "auricSoulTeamBurnAura") ||
          (ally.abilityIds || []).includes("auric_soul"))
    );
    const idx = target.statuses.findIndex(
      (s) =>
        s.category === "debuff" &&
        !s.isProtected &&
        !(teamHasAuricSoul && s.id === "burn")
    );
    if (idx !== -1) {
      const removed = target.statuses.splice(idx, 1)[0];
      this.engine.log(`Cleansed [${removed.name}] from ${target.name}.`, "heal", {
        isSkill: false,
      });
      return true;
    }
    return false;
  }

  tickStatuses(unit, timing) {
    if (unit.currentHp <= 0) return;

    if (timing === "TURN_START") {
      for (const st of [...unit.statuses]) {
        if (st.id === "bleed") {
          let pct = 0.03 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Bleed x${st.stacks}`);
        } else if (st.id === "poison_dot") {
          let pct = 0.03 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Poison x${st.stacks}`);
        } else if (st.id === "hemorrhage") {
          let pct = 0.04 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Hemorrhage x${st.stacks}`);
        } else if (st.id === "acidic") {
          let pct = 0.03 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Acidic x${st.stacks}`);
        } else if (st.id === "decay") {
          let pct = 0.05 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Decay x${st.stacks}`);
        } else if (st.id === "burn") {
          this.engine.triggerBurnTick(unit);
        }
      }
    }

    const remaining = [];
    for (const st of unit.statuses) {
      const def = Registry.getStatus(st.id);
      if (!def || def.tickTiming === "NEVER" || st.duration === null) {
        remaining.push(st);
        continue;
      }

      if (def.tickTiming === timing) {
        st.duration -= 1;
        if (st.duration > 0) {
          remaining.push(st);
        } else {
          if (st.id === "shield") unit.shieldHp = 0;
          this.engine.log(`[${st.name}] wore off from ${unit.name}.`, "info", {
            isSkill: false,
          });
        }
      } else {
        remaining.push(st);
      }
    }
    unit.statuses = remaining;
  }
}
