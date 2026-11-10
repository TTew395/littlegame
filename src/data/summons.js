/**
 * Summon / Minion / Linked Construct Definitions
 */

import { Registry } from "../engine/Registry.js";

export const SUMMON_LIST = [
  {
    id: "soul_spear",
    name: "Soul Spear",
    avatar: "SPR",
    types: ["Death"],
    speciesId: "construct_totem",
    description:
      "Tied to an enemy character (HP = 200% of tied character's MAX HP). Takes +100% damage from its tied character. Destroys tied character's MAX HP by 1% per 2% HP the Soul Spear has. When destroyed, damages Antikhonor by 5% of their MAX HP.",
    isActionlessTotem: true,
    onDestroy({ summonUnit, engine }) {
      engine.recalculateSoulSpearDestruction();

      const summoner = engine.getUnitById(summonUnit.summonerId);
      if (summoner && summoner.currentHp > 0) {
        const backlash = Math.max(1, Math.floor(summoner.effectiveMaxHp * 0.05));
        engine.dealTrueDamage(
          summoner,
          backlash,
          `Soul Spear Shattered (${summonUnit.linkedTargetName})`
        );
      }
    },
  },
];

export function registerAllSummons() {
  SUMMON_LIST.forEach((s) => Registry.registerSummon(s));
}
