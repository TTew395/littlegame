/**
 * StatusManager
 * Handles applying, stacking, refreshing, ticking, and cleansing buffs & debuffs:
 * - Stacking vs Non-Stacking statuses
 * - Turn-ticking ("TURN_START", "TURN_END") vs Turn-Independent ("NEVER") statuses
 * - Protected statuses (cannot be cleansed/stolen)
 * - Immunity checks & Special Absorption (e.g. Ternax Hellfire's Lethal Lava absorbing [Burn])
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
    } = {}
  ) {
    if (target.currentHp <= 0) return false;
    const def = Registry.getStatus(statusId);
    if (!def) return false;

    // Special Boss Hook: Ternax Hellfire's "Lethal Lava"
    // "Whenever Ternax receives a [Burn] debuff, instantly removes it and heals Ternax by 10% of their MAX HP."
    if (
      statusId === "burn" &&
      this.engine.getActiveAbilities(target).some((a) => a.id === "lethal_lava")
    ) {
      const healAmt = Math.max(1, Math.floor(target.effectiveMaxHp * 0.1));
      target.currentHp = Math.min(target.effectiveMaxHp, target.currentHp + healAmt);
      this.engine.log(
        `🌋 [${target.name}] Lethal Lava absorbs [Burn] and heals ${healAmt} HP (10% MAX HP)!`,
        "heal"
      );
      return false;
    }

    // Check debuff immunity / Block Debuffs (unless bypassImmunity is true, e.g., Queen's Spawn Vulnerability or Magma Pound Hex)
    if (def.category === "debuff" && !bypassImmunity) {
      if (this.isImmuneTo(target, statusId)) {
        if (!silent) {
          this.engine.log(`🛡️ ${target.name} is immune to [${def.name}]!`, "info");
        }
        return false;
      }
      if (this.hasFlag(target, "blockDebuffs")) {
        if (!silent) {
          this.engine.log(
            `✨ ${target.name}'s [Block Debuffs] blocked [${def.name}]!`,
            "info"
          );
        }
        return false;
      }
    }

    const protectedFlag = Boolean(isProtected || def.isProtectedByDefault);
    const existing = target.statuses.find((s) => s.id === statusId);

    if (existing) {
      if (def.stackBehavior === "stack") {
        existing.stacks = Math.min(def.maxStacks || 99, existing.stacks + stacks);
        if (duration !== null) {
          existing.duration = Math.max(existing.duration ?? 0, duration);
        }
        existing.isProtected = existing.isProtected || protectedFlag;
      } else {
        if (duration !== null) {
          existing.duration = Math.max(existing.duration ?? 0, duration);
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
            ? Math.min(def.maxStacks || 99, stacks)
            : 1,
        duration: def.tickTiming === "NEVER" ? null : duration,
        isProtected: protectedFlag,
      });
    }

    if (!silent) {
      const protText = protectedFlag ? " 🔒" : "";
      const durText =
        def.tickTiming === "NEVER" || duration === null ? "" : ` (${duration}T)`;
      const stackText =
        def.stackBehavior === "stack"
          ? ` [x${this.getStacks(target, statusId)}]`
          : "";
      this.engine.log(
        `${def.icon} ${target.name} gains [${def.name}]${stackText}${durText}${protText}.`,
        def.category === "debuff" ? "status" : "info"
      );
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
    const idx = target.statuses.findIndex(
      (s) => s.category === "debuff" && !s.isProtected
    );
    if (idx !== -1) {
      const removed = target.statuses.splice(idx, 1)[0];
      this.engine.log(`✨ Cleansed [${removed.name}] from ${target.name}.`, "heal");
      return true;
    }
    return false;
  }

  tickStatuses(unit, timing) {
    if (unit.currentHp <= 0) return;

    // Trigger start-of-turn DoTs (Bleed / Burn)
    if (timing === "TURN_START") {
      for (const st of [...unit.statuses]) {
        if (st.id === "bleed") {
          let pct = 0.03 * st.stacks;
          if (this.engine.hasAbilityFlag(unit, "capEnemyMaxHpScalingPct")) {
            pct = Math.min(pct, 0.1);
          }
          const dmg = Math.max(1, Math.floor(unit.effectiveMaxHp * pct));
          this.engine.dealTrueDamage(unit, dmg, `Bleed x${st.stacks}`);
        } else if (st.id === "burn") {
          this.engine.triggerBurnTick(unit);
        }
      }
    }

    // Decrement duration on statuses matching `timing` (TURN_START or TURN_END)
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
          this.engine.log(`⏱️ [${st.name}] wore off from ${unit.name}.`, "info");
        }
      } else {
        remaining.push(st);
      }
    }
    unit.statuses = remaining;
  }
}
