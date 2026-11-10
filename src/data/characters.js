/**
 * Character, Boss & Minion Roster Registry
 *
 * Includes:
 * - Heroes: Karnage the Anarch, Valkyria Chronos, Seraphina Dawn, Ignis the Sovereign, Vexor the Nightblade, Orion Starweaver (6th hero for 6-Character Zander Raid!)
 * - Raid Bosses:
 *   1. Antikhonor, Broken God (5 Characters Recommended)
 *   2. Ouroboros, The Swarm + Swarm Spawn (5 Characters Recommended)
 *   3. Crypt-Keeper Novok + Crypt Acolyte (5 Characters Recommended)
 *   4. Ternax Hellfire (5 Characters Recommended)
 *   5. First Genius, Zander [Base & Evolution State] (6 Characters Recommended)
 *   6. Allekheiros, Eternal Guardian (5 Characters Recommended)
 *   7. Theridine, Great Septimus (5 Characters Recommended)
 */

import { Registry } from "../engine/Registry.js";

export const CHARACTER_LIST = [
  // ==========================================================
  // HERO ROSTER (Up to 6 Heroes for Raid Battles)
  // ==========================================================
  {
    id: "karnage_the_anarch",
    name: "Karnage the Anarch",
    title: "Avatar of Anarchy",
    avatar: "👹",
    role: "Hero / Multi-Form Striker",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Fighting", "Chaos"],
    speciesId: "higher_being",
    defaultItemId: "anarch_sigil",
    abilityIds: ["avatar_of_anarchy"],
    stats: {
      hp: 110,
      energy: 120,
      spd: 105,
      def: 10,
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
  {
    id: "valkyria_chronos",
    name: "Valkyria Chronos",
    title: "Warden of the Rift",
    avatar: "⚡",
    role: "Hero / Tactician",
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
  {
    id: "seraphina_dawn",
    name: "Seraphina Dawn",
    title: "Keeper of the Sacred Flame",
    avatar: "👼",
    role: "Hero / Healer",
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
  {
    id: "ignis_drake",
    name: "Ignis the Sovereign",
    title: "Wyrm of the Obsidian Star",
    avatar: "🐉",
    role: "Hero / AoE Nuker",
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
  {
    id: "vexor_nightblade",
    name: "Vexor the Nightblade",
    title: "Phantom of the Void",
    avatar: "🗡️",
    role: "Hero / Assassin",
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
  {
    id: "orion_starweaver",
    name: "Orion Starweaver",
    title: "Astral Arbiter",
    avatar: "🌟",
    role: "Hero / Cosmic Breaker",
    isBoss: false,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Space", "Time"],
    speciesId: "celestial_vanguard",
    defaultItemId: "executioner_lens",
    abilityIds: ["temporal_overdrive"],
    stats: {
      hp: 130,
      energy: 120,
      spd: 104,
      def: 15,
      atk: 14,
      critRate: 25,
      critDmg: 60,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "🌟",
        moves: [
          "spear_breaker_volley",
          "stars_of_destruction",
          "celestial_aegis",
          "chrono_burst",
        ],
      },
    },
  },

  // ==========================================================
  // BOSS 1: ANTIKHONOR, BROKEN GOD
  // ==========================================================
  {
    id: "antikhonor_broken_god",
    name: "Antikhonor, Broken God",
    title: "Master of Legions • 5 Characters Recommended",
    avatar: "👑",
    role: "Raid Boss (Death)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Basic",
    types: ["Death"],
    speciesId: "broken_deity",
    defaultItemId: "none",
    abilityIds: ["master_of_legions", "almighty_immunity"],
    stats: {
      hp: 900,
      energy: 100,
      spd: 75,
      def: 15,
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
  // BOSS 2: OUROBOROS, THE SWARM (+ SWARM SPAWN)
  // ==========================================================
  {
    id: "ouroboros_the_swarm",
    name: "Ouroboros, The Swarm",
    title: "Brood Queen • 5 Characters Recommended",
    avatar: "🪲",
    role: "Raid Boss (Bug)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Bug",
    types: ["Bug"],
    speciesId: "hive_sovereign",
    defaultItemId: "none",
    abilityIds: ["brood_queen", "almighty_immunity"],
    stats: {
      hp: 400, // 400 HP (1600 eHP with 75% DEF)
      energy: 100,
      spd: 100,
      def: 75, // -75% damage
      atk: 20,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Hive Queen",
        avatar: "🪲",
        moves: [
          "swarm_strike_boss",
          "swarm_ensemble_boss",
          "larval_evolution",
          "fallen_stars_eulogy",
        ],
      },
    },
  },
  {
    id: "swarm_spawn",
    name: "Swarm Spawn",
    title: "Queen's Brood",
    avatar: "🐛",
    role: "Swarm Minion",
    isBoss: false,
    isMinion: true,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Bug",
    types: ["Bug"],
    speciesId: "hive_sovereign",
    defaultItemId: "none",
    abilityIds: ["queens_spawn"],
    stats: {
      hp: 20, // 20 HP (22 eHP)
      energy: 100,
      spd: 100,
      def: 10, // -10% damage
      atk: 20,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Broodling",
        avatar: "🐛",
        moves: ["swarm_strike_minion", "swarm_ensemble_minion"],
      },
    },
  },

  // ==========================================================
  // BOSS 3: CRYPT-KEEPER NOVOK (+ CRYPT ACOLYTE)
  // ==========================================================
  {
    id: "crypt_keeper_novok",
    name: "Crypt-Keeper Novok",
    title: "Gravewalker • 5 Characters Recommended",
    avatar: "⚰️",
    role: "Raid Boss (Death)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Death",
    types: ["Death"],
    speciesId: "lich_lord",
    defaultItemId: "none",
    abilityIds: ["gravewalker", "almighty_immunity"],
    stats: {
      hp: 300, // 300 HP (316 eHP)
      energy: 100,
      spd: 80,
      def: 5, // -5% damage
      atk: 20,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Crypt-Keeper",
        avatar: "⚰️",
        moves: [
          "tombfire",
          "osteomancy",
          "fallens_sheath",
          "walker_among_graves",
        ],
      },
    },
  },
  {
    id: "grave_acolyte",
    name: "Crypt Acolyte",
    title: "Risen Legionnaire",
    avatar: "💀",
    role: "Undead Minion",
    isBoss: false,
    isMinion: true,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Death",
    types: ["Death"],
    speciesId: "lich_lord",
    defaultItemId: "none",
    abilityIds: [],
    stats: {
      hp: 80,
      energy: 100,
      spd: 85,
      def: 10,
      atk: 12,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Risen",
        avatar: "💀",
        moves: ["lance_of_light", "wait"],
      },
    },
  },

  // ==========================================================
  // BOSS 4: TERNAX HELLFIRE
  // ==========================================================
  {
    id: "ternax_hellfire",
    name: "Ternax Hellfire",
    title: "Lethal Lava • 5 Characters Recommended",
    avatar: "🌋",
    role: "Raid Boss (Dragon/Fire)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Dragon",
    types: ["Dragon", "Fire"],
    speciesId: "magma_wyrm",
    defaultItemId: "none",
    abilityIds: ["lethal_lava", "molten_immunity"],
    stats: {
      hp: 400, // 400 HP (421 eHP)
      energy: 100,
      spd: 90,
      def: 5, // -5% damage
      atk: 15,
      critRate: 20,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Hellfire Wyrm",
        avatar: "🌋",
        moves: ["molten_slag", "magma_pound", "overburn", "hexreaper"],
      },
    },
  },

  // ==========================================================
  // BOSS 5: FIRST GENIUS, ZANDER (BASE & EVOLUTION STATE)
  // ==========================================================
  {
    id: "first_genius_zander",
    name: "First Genius, Zander",
    title: "Genius's Foresight • 6 Characters Recommended",
    avatar: "⏳",
    role: "Raid Boss (Time • 4x 400 HP)",
    isBoss: true,
    recommendedHeroes: 6,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Time",
    types: ["Time"],
    speciesId: "chronos_archon",
    defaultItemId: "none",
    abilityIds: ["genius_foresight", "almighty_immunity"],
    stats: {
      hp: 1600, // 400/400 Health x 4 (2666 eHP)
      energy: 120,
      spd: 110,
      def: 40, // -40% damage in Base Form, -50 (+50% damage) in Evolution State
      atk: 10,
      critRate: 20,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Base Form",
        avatar: "⏳",
        moves: [
          "computation_alpha_set",
          "permutation_gamma",
          "extrapolation_beta_link",
          "mode_evolution",
        ],
      },
      evolution: {
        name: "Evolution State",
        avatar: "⚛️",
        moves: [
          "collapse_delta",
          "restructuring_phi",
          "continuation_gamma",
          "cyclicity_alpha_scepter",
        ],
      },
    },
  },

  // ==========================================================
  // BOSS 6: ALLEKHEIROS, ETERNAL GUARDIAN
  // ==========================================================
  {
    id: "allekheiros_eternal_guardian",
    name: "Allekheiros, Eternal Guardian",
    title: "Forever Waiting • 5 Characters Recommended",
    avatar: "🌌",
    role: "Raid Boss (Space)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Space",
    types: ["Space"],
    speciesId: "cosmic_warden",
    defaultItemId: "none",
    abilityIds: ["forever_waiting", "almighty_immunity"],
    stats: {
      hp: 400, // 400 HP (615 eHP)
      energy: 120,
      spd: 100,
      def: 35, // -35% damage
      atk: 20,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Eternal Guardian",
        avatar: "🌌",
        moves: [
          "sweep_the_field",
          "heart_of_thorns",
          "ten_thousand_years_silent",
          "flectere_si_nequeno",
        ],
      },
      enhanced: {
        name: "Awakened Guardian",
        avatar: "🌠",
        moves: [
          "sweep_the_field",
          "stars_shall_weep",
          "ten_thousand_years_silent",
          "flectere_si_nequeno",
        ],
      },
    },
  },

  // ==========================================================
  // BOSS 7: THERIDINE, GREAT SEPTIMUS
  // ==========================================================
  {
    id: "theridine_great_septimus",
    name: "Theridine, Great Septimus",
    title: "Godspawn (50 HP x 16 Bars) • 5 Characters Recommended",
    avatar: "👁️‍🗨️",
    role: "Raid Boss (Light)",
    isBoss: true,
    recommendedHeroes: 5,
    level: 1,
    exp: 0,
    maxExp: 1000,
    rank: "Light",
    types: ["Light", "Time"],
    speciesId: "seraphic_septimus",
    defaultItemId: "none",
    abilityIds: ["godspawn", "almighty_immunity"],
    stats: {
      hp: 50, // 50/50 Health x 16 Bars (MAX HP considered 50)
      energy: 100,
      spd: 100,
      def: 15,
      atk: 10,
      critRate: 15,
      critDmg: 50,
    },
    forms: {
      base: {
        name: "Great Septimus",
        avatar: "👁️‍🗨️",
        moves: [
          "as_one_shall_rest",
          "for_one_shall_suffer",
          "im_anfang_war_die_tat",
          "for_one_is_holy",
        ],
      },
    },
  },
];

export function registerAllCharacters() {
  CHARACTER_LIST.forEach((ch) => Registry.registerCharacter(ch));
}
