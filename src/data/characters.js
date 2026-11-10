/**
 * Character & Boss Roster Registry
 *
 * Adding a new character takes just one object entry in CHARACTER_LIST!
 * Supports:
 * - Multi-form characters (like Karnage the Anarch's Base & Alternate Forms)
 * - Raid Bosses with multiple passives (like Antikhonor, Broken God)
 * - Full 5-character Raid Squads & PvP Teams
 */

import { Registry } from "../engine/Registry.js";

export const CHARACTER_LIST = [
  // ==========================================================
  // 1. KARNAGE THE ANARCH (Featured Hero / Multi-Form)
  // ==========================================================
  {
    id: "karnage_the_anarch",
    name: "Karnage the Anarch",
    title: "Avatar of Anarchy",
    avatar: "👹",
    role: "Hero / Striker",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Fighting", "Chaos"],
    speciesId: "higher_being",
    defaultItemId: "none",
    abilityIds: ["avatar_of_anarchy"],
    stats: {
      hp: 110,
      energy: 120,
      spd: 105,
      def: 10, // 10% base damage reduction
      atk: 12,
      critRate: 25,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "👹",
        moves: [
          "sufferslash",
          "anarchic_realm",
          "trinity_of_pain",
          "metamorph_to_alt",
        ],
      },
      alternate: {
        name: "Alternate Form",
        avatar: "👿",
        moves: [
          "hellfire",
          "stars_of_destruction",
          "reality_reversal",
          "metamorph_to_base",
        ],
      },
    },
  },

  // ==========================================================
  // 2. ANTIKHONOR, BROKEN GOD (Featured 5v1 Raid Boss)
  // ==========================================================
  {
    id: "antikhonor_broken_god",
    name: "Antikhonor, Broken God",
    title: "Master of Legions • 5 Characters Recommended",
    avatar: "👑",
    role: "Raid Boss",
    isBoss: true,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Death"],
    speciesId: "broken_deity",
    defaultItemId: "none",
    abilityIds: ["master_of_legions", "almighty_immunity"],
    stats: {
      hp: 900, // 900 HP (1058 eHP with 15% DEF)
      energy: 100,
      spd: 75,
      def: 15, // -15% damage taken
      atk: 20,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Broken God",
        avatar: "👑",
        moves: [
          "lance_of_light",
          "pyre_of_high_graves",
          "glory_to_all_honorable_dead",
          "all_realms_leveled",
        ],
      },
    },
  },

  // ==========================================================
  // 3. VALKYRIA CHRONOS (Tachyon Support / Turn Meter Booster)
  // ==========================================================
  {
    id: "valkyria_chronos",
    name: "Valkyria Chronos",
    title: "Warden of the Rift",
    avatar: "⚡",
    role: "Tactician / Support",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Tek", "Light"],
    speciesId: "cyber_construct",
    defaultItemId: "chronos_hourglass",
    abilityIds: ["temporal_overdrive"],
    stats: {
      hp: 135,
      energy: 110,
      spd: 112,
      def: 14,
      atk: 11,
      critRate: 20,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "⚡",
        moves: [
          "chrono_burst",
          "spear_breaker_volley",
          "time_dilation_field",
          "sunfire_smite",
        ],
      },
    },
  },

  // ==========================================================
  // 4. SERAPHINA DAWN (Celestial Healer / Cleanser)
  // ==========================================================
  {
    id: "seraphina_dawn",
    name: "Seraphina Dawn",
    title: "Keeper of the Sacred Flame",
    avatar: "👼",
    role: "Healer / Guardian",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Light"],
    speciesId: "celestial_vanguard",
    defaultItemId: "aegis_core",
    abilityIds: ["astral_ward"],
    stats: {
      hp: 150,
      energy: 120,
      spd: 98,
      def: 18,
      atk: 10,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "👼",
        moves: [
          "sunfire_smite",
          "celestial_aegis",
          "spear_breaker_volley",
          "chrono_burst",
        ],
      },
    },
  },

  // ==========================================================
  // 5. IGNIS DRAKE (AoE Dragon Nuker / Soul Spear Breaker)
  // ==========================================================
  {
    id: "ignis_drake",
    name: "Ignis the Sovereign",
    title: "Wyrm of the Obsidian Star",
    avatar: "🐉",
    role: "AoE Nuker",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Dragon", "Chaos"],
    speciesId: "higher_being",
    defaultItemId: "executioner_lens",
    abilityIds: ["dragon_blood_fury"],
    stats: {
      hp: 125,
      energy: 115,
      spd: 95,
      def: 12,
      atk: 15,
      critRate: 30,
      critDmg: 65,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "🐉",
        moves: [
          "crimson_rend",
          "draconic_cataclysm",
          "spear_breaker_volley",
          "sufferslash",
        ],
      },
    },
  },

  // ==========================================================
  // 6. VEXOR THE NIGHTBLADE (Multi-Hit Bleed / War Armor Shredder)
  // ==========================================================
  {
    id: "vexor_nightblade",
    name: "Vexor the Nightblade",
    title: "Phantom of the Void",
    avatar: "🗡️",
    role: "Assassin",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Chaos", "Fighting"],
    speciesId: "abyssal_knight",
    defaultItemId: "vampiric_chalice",
    abilityIds: ["avatar_of_anarchy"],
    stats: {
      hp: 115,
      energy: 110,
      spd: 108,
      def: 11,
      atk: 14,
      critRate: 30,
      critDmg: 55,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "🗡️",
        moves: [
          "crimson_rend",
          "sufferslash",
          "trinity_of_pain",
          "spear_breaker_volley",
        ],
      },
    },
  },
];

export function registerAllCharacters() {
  CHARACTER_LIST.forEach((ch) => Registry.registerCharacter(ch));
}
