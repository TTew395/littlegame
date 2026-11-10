/**
 * Species / Archetype Definitions (Emoji-free)
 */

import { Registry } from "../engine/Registry.js";

export const SPECIES_LIST = [
  {
    id: "none",
    name: "None",
    description: "No special species bonuses.",
    damageReductionByType: {},
  },
  {
    id: "human",
    name: "Human",
    description: "10% more damage on basic moves, no downside.",
    basicMoveDamageBonus: 0.1,
    damageReductionByType: {},
  },
  {
    id: "higher_being",
    name: "Higher Being",
    description: "50% reduced damage from Chaos, Dragon and Tek.",
    damageReductionByType: {
      Chaos: 0.5,
      Dragon: 0.5,
      Tek: 0.5,
    },
  },
  {
    id: "broken_deity",
    name: "Broken Deity",
    description: "Ancient entity of war and death. Takes 20% reduced damage from Psychic and Ghost.",
    damageReductionByType: {
      Psychic: 0.2,
      Ghost: 0.2,
    },
  },
  {
    id: "hive_sovereign",
    name: "Hive Sovereign",
    description: "Chitinous brood organism. Takes 20% reduced damage from Fighting and Earth.",
    damageReductionByType: {
      Fighting: 0.2,
      Earth: 0.2,
    },
  },
  {
    id: "lich_lord",
    name: "Undying Lich",
    description: "Necromantic master of the crypt. 25% reduced damage from Death and Poison.",
    damageReductionByType: {
      Death: 0.25,
      Poison: 0.25,
    },
  },
  {
    id: "magma_wyrm",
    name: "Magma Wyrm",
    description: "Born in volcanic hellfire. 30% reduced damage from Fire and Steel.",
    damageReductionByType: {
      Fire: 0.3,
      Steel: 0.3,
    },
  },
  {
    id: "chronos_archon",
    name: "Chronos Archon",
    description: "Master of temporal equations. 20% reduced damage from Time and Tek.",
    damageReductionByType: {
      Time: 0.2,
      Tek: 0.2,
    },
  },
  {
    id: "cosmic_warden",
    name: "Cosmic Warden",
    description: "Sentinel of the void. 20% reduced damage from Space and Light.",
    damageReductionByType: {
      Space: 0.2,
      Light: 0.2,
    },
  },
  {
    id: "seraphic_septimus",
    name: "Seraphic Septimus",
    description: "Multi-bar divine entity of pure Light.",
    damageReductionByType: {
      Light: 0.25,
    },
  },
  {
    id: "cyber_construct",
    name: "Cyber Construct",
    description: "30% reduced damage from Poison and Death; takes 20% extra damage from Electric.",
    damageReductionByType: {
      Poison: 0.3,
      Death: 0.3,
      Electric: -0.2,
    },
  },
  {
    id: "abyssal_knight",
    name: "Abyssal Knight",
    description: "25% reduced damage from Dark and Fighting.",
    damageReductionByType: {
      Dark: 0.25,
      Fighting: 0.25,
    },
  },
  {
    id: "celestial_vanguard",
    name: "Celestial Vanguard",
    description: "25% reduced damage from Light, Fire, and Astral.",
    damageReductionByType: {
      Light: 0.25,
      Fire: 0.25,
      Astral: 0.25,
    },
  },
  {
    id: "construct_totem",
    name: "Soul Construct",
    description: "Tied spiritual manifestation. Vulnerable (+100% damage) to the character it is bound to.",
    damageReductionByType: {},
  },
];

export function registerAllSpecies() {
  SPECIES_LIST.forEach((sp) => Registry.registerSpecies(sp));
}
