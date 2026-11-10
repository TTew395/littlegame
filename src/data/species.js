/**
 * Species / Archetype Definitions
 * Easily add new species with elemental/type resistances, stat bonuses, or passive traits.
 */

import { Registry } from "../engine/Registry.js";

export const SPECIES_LIST = [
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
