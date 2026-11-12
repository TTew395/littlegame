/**
 * Initializes and registers all modular game data into the central Registry.
 * To add new content, simply add entries to the arrays in `src/data/*.js`.
 */

import { registerAllStatuses } from "./statuses.js?v=14";
import { registerAllSpecies } from "./species.js?v=14";
import { registerAllItems } from "./items.js?v=14";
import { registerAllAbilities } from "./abilities.js?v=14";
import { registerAllSummons } from "./summons.js?v=14";
import { registerAllSkills } from "./skills.js?v=14";
import { registerAllCharacters } from "./characters.js?v=14";
import { registerAllInstantEffects } from "./instantEffects.js?v=14";

export function initializeGameContent() {
  registerAllStatuses();
  registerAllSpecies();
  registerAllItems();
  registerAllAbilities();
  registerAllSummons();
  registerAllSkills();
  registerAllCharacters();
  registerAllInstantEffects();
}
