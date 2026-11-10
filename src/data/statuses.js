/**
 * Status Effect Definitions (Buffs, Debuffs, Stacking, Non-Stacking, Turn-based & Event-based)
 *
 * Properties:
 * - id: unique string ID
 * - name: display name
 * - icon: emoji or icon symbol
 * - category: "buff" | "debuff" | "special"
 * - stackBehavior: "refresh" (non-stacking, refreshes max duration) | "stack" (adds stacks) | "independent"
 * - maxStacks: max stacks when stackBehavior === "stack"
 * - tickTiming: "TURN_START" | "TURN_END" | "NEVER" (event-driven or permanent)
 * - isProtectedByDefault: boolean (cannot be cleansed/removed if true)
 * - statModifiers: optional { atkPct, defPct, spdPct, dmgReductionPerStack, ... }
 * - flags: { skipTurn, blockPassives, blockActiveSkills, blockRevive, ... }
 */

import { Registry } from "../engine/Registry.js";

export const STATUS_LIST = [
  // ==========================================
  // NON-STACKING TURN-BASED DEBUFFS
  // ==========================================
  {
    id: "block_passive_skills",
    name: "Block Passive Skills",
    icon: "🔇",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Disables all passive abilities and species traits while active.",
    flags: { blockPassives: true },
  },
  {
    id: "seal",
    name: "Seal",
    icon: "⛓️",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Seals item effects, bonus Turn Meter gains, and secondary triggers.",
    flags: { sealItems: true, blockBonusTurnMeter: true },
  },
  {
    id: "deathbrand",
    name: "Deathbrand",
    icon: "💀",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Increases incoming damage taken by 25% and marks the target for execution.",
    statModifiers: { incomingDamageMultiplier: 1.25 },
  },
  {
    id: "stun",
    name: "Stun",
    icon: "💫",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_START",
    description: "Unable to act for the turn. Cooldowns do not tick while Stunned.",
    flags: { skipTurn: true },
  },
  {
    id: "sleep",
    name: "Sleep",
    icon: "💤",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_START",
    description: "Skips turn unless woken up by direct damage.",
    flags: { skipTurn: true, removeOnDamage: true },
  },
  {
    id: "freeze",
    name: "Freeze",
    icon: "🧊",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_START",
    description: "Skips turn, takes 20% less direct damage while frozen.",
    flags: { skipTurn: true },
    statModifiers: { incomingDamageMultiplier: 0.8 },
  },
  {
    id: "heart_melt",
    name: "Heart-Melt",
    icon: "💔",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Reduces Defense by 30% and healing received by 50%.",
    statModifiers: { defMultiplier: 0.7 },
  },
  {
    id: "def_down",
    name: "Decrease DEF",
    icon: "🛡️⬇️",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Decreases Defense by 50%.",
    statModifiers: { defMultiplier: 0.5 },
  },
  {
    id: "spd_down",
    name: "Decrease SPD",
    icon: "🥾⬇️",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Decreases Speed by 30%.",
    statModifiers: { spdMultiplier: 0.7 },
  },

  // ==========================================
  // STACKING TURN-BASED DEBUFFS
  // ==========================================
  {
    id: "bleed",
    name: "Bleed",
    icon: "🩸",
    category: "debuff",
    stackBehavior: "stack",
    maxStacks: 10,
    tickTiming: "TURN_START",
    description: "Deals 3% of Max HP damage per stack at the start of the turn.",
  },
  {
    id: "burn",
    name: "HP Burn",
    icon: "🔥",
    category: "debuff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_START",
    description: "Deals 5% of Max HP damage at the start of the turn.",
  },

  // ==========================================
  // NON-STACKING TURN-BASED BUFFS
  // ==========================================
  {
    id: "atk_up",
    name: "Increase ATK",
    icon: "⚔️⬆️",
    category: "buff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Increases Attack by 50%.",
    statModifiers: { atkMultiplier: 1.5 },
  },
  {
    id: "def_up",
    name: "Increase DEF",
    icon: "🛡️⬆️",
    category: "buff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Increases Defense by 60%.",
    statModifiers: { defMultiplier: 1.6 },
  },
  {
    id: "spd_up",
    name: "Increase SPD",
    icon: "⚡⬆️",
    category: "buff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Increases Speed by 30%.",
    statModifiers: { spdMultiplier: 1.3 },
  },
  {
    id: "block_debuffs",
    name: "Block Debuffs",
    icon: "✨",
    category: "buff",
    stackBehavior: "refresh",
    maxStacks: 1,
    tickTiming: "TURN_END",
    description: "Prevents incoming debuffs.",
    flags: { blockDebuffs: true },
  },

  // ==========================================
  // STACKING TURN-INDEPENDENT / EVENT-DRIVEN STATUSES
  // ==========================================
  {
    id: "war_armor",
    name: "War Armor",
    icon: "🛡️✨",
    category: "buff",
    stackBehavior: "stack",
    maxStacks: 20,
    tickTiming: "NEVER", // Controlled by Master of Legions & Glory to All Honorable Dead
    isProtectedByDefault: true,
    description: "Each stack decreases damage taken by 4%. Reduced by 1 (+ attacker Glory stacks) when attacked (once per skill). Resets to 8 on Antikhonor's turn.",
    statModifiers: { dmgReductionPerStack: 0.04 },
  },
  {
    id: "glory",
    name: "Glory",
    icon: "👑",
    category: "special",
    stackBehavior: "stack",
    maxStacks: 50,
    tickTiming: "NEVER", // Cleared when Antikhonor takes a turn or War Armor hits 0
    isProtectedByDefault: true,
    description: "Whenever this character attacks with a skill, increases Glory by 1 and reduces Antikhonor's War Armor stacks by this character's Glory count.",
  },
  {
    id: "poise_focus",
    name: "Battle Focus",
    icon: "🎯",
    category: "buff",
    stackBehavior: "stack",
    maxStacks: 5,
    tickTiming: "NEVER",
    description: "Increases Crit Damage by 10% per stack. Does not expire with turns.",
    statModifiers: { critDmgPerStack: 10 },
  },
];

export function registerAllStatuses() {
  STATUS_LIST.forEach((s) => Registry.registerStatus(s));
}
