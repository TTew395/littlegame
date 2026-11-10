/**
 * Initializes and registers all modular game data into the central Registry.
 * To add new content, simply add entries to the arrays in `src/data/*.js`.
 */

import { registerAllStatuses } from "./statuses.js";
import { registerAllSpecies } from "./species.js";
import { registerAllItems } from "./items.js";
import { registerAllAbilities } from "./abilities.js";
import { registerAllSummons } from "./summons.js";
import { registerAllSkills } from "./skills.js";
import { registerAllCharacters } from "./characters.js";

export function initializeGameContent() {
  registerAllStatuses();
  registerAllSpecies();
  registerAllItems();
  registerAllAbilities();
  registerAllSummons();
  registerAllSkills();
  registerAllCharacters();
}
