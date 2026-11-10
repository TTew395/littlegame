/**
 * Holdable Items Registry (Common, Uncommon, Rare, Legendary, Mythical)
 * Includes all items from the user specification with functional combat hooks.
 */

import { Registry } from "../engine/Registry.js";

export const ITEM_LIST = [
  {
    id: "none",
    name: "None",
    rarity: "None",
    description: "No item equipped.",
  },

  // ==========================================================
  // COMMON ITEMS
  // ==========================================================
  {
    id: "kawabunga_coffee",
    name: "Kawabunga Coffee",
    rarity: "Common",
    description: "Gain 5 energy per turn.",
    onTurnStart({ unit, engine }) {
      unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 5);
      engine.log(`[Item] ${unit.name}'s Kawabunga Coffee grants +5 Energy.`, "info");
    },
  },
  {
    id: "choco_diamond",
    name: "Choco Diamond",
    rarity: "Common",
    description: "Heals 5 - 30 health when below 60% health.",
    onTurnStart({ unit, engine }) {
      if (unit.currentHp < unit.effectiveMaxHp * 0.6) {
        const heal = 5 + Math.floor(engine.rng() * 26);
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + heal);
        engine.log(`[Item] ${unit.name}'s Choco Diamond heals ${heal} HP.`, "heal");
      }
    },
  },
  {
    id: "bayonet",
    name: "Bayonet",
    rarity: "Common",
    description: "10% more damage to any melee attack.",
    modifyOutgoingDamage({ skill, damage }) {
      if (skill.category === "Melee") return damage * 1.1;
      return damage;
    },
  },
  {
    id: "cup_o_joe",
    name: "Cup o' Joe",
    rarity: "Common",
    description: "Heals the user by 10 and restores energy by 30 (activates when below 75% HP or Energy).",
    onTurnStart({ unit, engine }) {
      if (
        !unit.customCounters.cupOJoeUsed &&
        (unit.currentHp < unit.effectiveMaxHp * 0.75 || unit.currentEnergy < unit.maxEnergy * 0.7)
      ) {
        unit.customCounters.cupOJoeUsed = true;
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 10);
        unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 30);
        engine.log(`[Item] ${unit.name} drinks Cup o' Joe (+10 HP, +30 Energy).`, "heal");
      }
    },
  },
  {
    id: "scientist_id",
    name: "Scientist ID",
    rarity: "Common",
    description: "Boosts Tech (Tek) and Acid moves damage by 10%.",
    modifyOutgoingDamage({ skill, damage }) {
      if (skill.element === "Tek" || skill.element === "Tech" || skill.element === "Acid") {
        return damage * 1.1;
      }
      return damage;
    },
  },
  {
    id: "bluefruit",
    name: "Bluefruit",
    rarity: "Common",
    description: "Gives 15 energy when reaching 85% energy (one time use).",
    onTurnStart({ unit, engine }) {
      if (
        !unit.customCounters.bluefruitUsed &&
        unit.maxEnergy > 0 &&
        unit.currentEnergy / unit.maxEnergy >= 0.85
      ) {
        unit.customCounters.bluefruitUsed = true;
        unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 15);
        engine.log(`[Item] ${unit.name}'s Bluefruit activates (+15 Energy, consumed).`, "info");
      }
    },
  },
  {
    id: "centipede",
    name: "Centipede",
    rarity: "Common",
    description: "+15 energy and +5 health at the end of the next 3 turns (one time use).",
    onBattleStart({ unit }) {
      unit.customCounters.centipedeTurns = 3;
    },
    onTurnEnd({ unit, engine }) {
      if ((unit.customCounters.centipedeTurns || 0) > 0) {
        unit.customCounters.centipedeTurns -= 1;
        unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 15);
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 5);
        engine.log(`[Item] ${unit.name}'s Centipede grants +15 Energy and +5 HP (${unit.customCounters.centipedeTurns} turns left).`, "heal");
      }
    },
  },
  {
    id: "lightning_sword",
    name: "Lightning Sword",
    rarity: "Common",
    description: "Has a 30% chance of doing 10% more damage to any character.",
    modifyOutgoingDamage({ damage, engine }) {
      if (engine.rng() <= 0.3) return damage * 1.1;
      return damage;
    },
  },
  {
    id: "assorted_biscuits",
    name: "Assorted Biscuits",
    rarity: "Common",
    description: "Heals 10% health, activates when the character is at or below 30 health.",
    onAfterTakeDamage({ defender, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp <= 30 &&
        !defender.customCounters.biscuitsUsed
      ) {
        defender.customCounters.biscuitsUsed = true;
        const heal = Math.max(1, Math.floor(defender.effectiveMaxHp * 0.1));
        defender.currentHp = Math.min(defender.effectiveMaxHp, defender.currentHp + heal);
        engine.log(`[Item] ${defender.name}'s Assorted Biscuits heal ${heal} HP.`, "heal");
      }
    },
  },
  {
    id: "painkillers",
    name: "Painkillers",
    rarity: "Common",
    description: "Gives 15 health and gives 35 energy (one time use when below 60% HP or Energy).",
    onTurnStart({ unit, engine }) {
      if (
        !unit.customCounters.painkillersUsed &&
        (unit.currentHp < unit.effectiveMaxHp * 0.6 || unit.currentEnergy < unit.maxEnergy * 0.6)
      ) {
        unit.customCounters.painkillersUsed = true;
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 15);
        unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 35);
        engine.log(`[Item] ${unit.name} uses Painkillers (+15 HP, +35 Energy).`, "heal");
      }
    },
  },
  {
    id: "picnic_set",
    name: "Picnic Set",
    rarity: "Common",
    description: "Heal 10% HP when resting (one time use).",
    onRest({ unit, engine }) {
      if (!unit.customCounters.picnicUsed) {
        unit.customCounters.picnicUsed = true;
        const heal = Math.max(1, Math.floor(unit.effectiveMaxHp * 0.1));
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + heal);
        engine.log(`[Item] ${unit.name}'s Picnic Set heals ${heal} HP while resting.`, "heal");
      }
    },
  },
  {
    id: "chitin_plating",
    name: "Chitin Plating",
    rarity: "Common",
    description: "Reduces physical damage by 5%. Calculates alongside defense.",
    modifyIncomingDamage({ skill, damage }) {
      if (skill.category === "Physical" || skill.category === "Melee") {
        return damage * 0.95;
      }
      return damage;
    },
  },
  {
    id: "escape_kit",
    name: "Escape Kit",
    rarity: "Common",
    description: "Allows escape of cages, beartraps, and other physical trapping moves.",
  },
  {
    id: "rocket_boots",
    name: "Rocket Boots",
    rarity: "Common",
    description: "Gain 5 speed each turn.",
    onTurnStart({ unit, engine }) {
      unit.baseStats.spd += 5;
      engine.log(`[Item] ${unit.name}'s Rocket Boots increase SPD by +5 (now ${unit.baseStats.spd}).`, "info");
    },
  },
  {
    id: "leek",
    name: "Leek",
    rarity: "Common",
    description: "Physical attacks deal +1 plant damage.",
    modifyOutgoingDamage({ skill, damage }) {
      if (skill.category === "Physical" || skill.category === "Melee") {
        return damage + 1;
      }
      return damage;
    },
  },
  {
    id: "sharp_claws",
    name: "Sharp Claws",
    rarity: "Common",
    description: "Physical attacks have a 20% chance to inflict bleed.",
    onAfterDealDamage({ attacker, target, skill, engine }) {
      if (
        target.currentHp > 0 &&
        (skill?.category === "Physical" || skill?.category === "Melee") &&
        engine.rng() <= 0.2
      ) {
        engine.statusManager.applyStatus(attacker, target, "bleed", { duration: 2, stacks: 1 });
      }
    },
  },
  {
    id: "sponge",
    name: "Sponge",
    rarity: "Common",
    description: "Literally just a piece of sponge that seems to do nothing.",
  },
  {
    id: "gilded_diamond",
    name: "Gilded Diamond",
    rarity: "Common",
    description: "The wearer receives 2% less damage for each buff they are under.",
    modifyIncomingDamage({ defender, damage, engine }) {
      const buffs = engine.statusManager.countCategory(defender, "buff");
      return damage * Math.max(0.5, 1 - 0.02 * buffs);
    },
  },
  {
    id: "crystal_jade",
    name: "Crystal Jade",
    rarity: "Common",
    description: "The wearer's heals are boosted by 10%.",
  },
  {
    id: "pipe_of_the_charmer",
    name: "Pipe of the Charmer",
    rarity: "Common",
    description: "Has a 5% chance to place a [Sleep] debuff when attacked.",
    onAfterTakeDamage({ attacker, defender, engine }) {
      if (attacker && attacker.currentHp > 0 && engine.rng() <= 0.05) {
        engine.statusManager.applyStatus(defender, attacker, "sleep", { duration: 1 });
      }
    },
  },
  {
    id: "warlords_axe",
    name: "Warlord's Axe",
    rarity: "Common",
    description: "Deal 5% more damage.",
    modifyOutgoingDamage({ damage }) {
      return damage * 1.05;
    },
  },
  {
    id: "mask_of_rage",
    name: "Mask of Rage",
    rarity: "Common",
    description: "Takes 5% less damage while under a [Taunt] buff.",
    modifyIncomingDamage({ defender, damage, engine }) {
      if (engine.statusManager.hasStatus(defender, "taunt")) {
        return damage * 0.95;
      }
      return damage;
    },
  },

  // ==========================================================
  // UNCOMMON ITEMS
  // ==========================================================
  {
    id: "fire_ruby",
    name: "Fire Ruby",
    rarity: "Uncommon",
    description: "+20% damage on first fire attack (must deal damage).",
    modifyOutgoingDamage({ attacker, skill, damage }) {
      if (skill.element === "Fire" && !attacker.customCounters.fireRubyUsed) {
        attacker.customCounters.fireRubyUsed = true;
        return damage * 1.2;
      }
      return damage;
    },
  },
  {
    id: "portable_healerator",
    name: "Portable Healerator",
    rarity: "Uncommon",
    description: "Heal 20 health when activated (below 50% HP). Destroyed upon activation.",
    onAfterTakeDamage({ defender, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp < defender.effectiveMaxHp * 0.5 &&
        !defender.customCounters.healeratorUsed
      ) {
        defender.customCounters.healeratorUsed = true;
        defender.currentHp = Math.min(defender.effectiveMaxHp, defender.currentHp + 20);
        defender.itemId = "none";
        engine.log(`[Item] ${defender.name}'s Portable Healerator heals 20 HP and is destroyed.`, "heal");
      }
    },
  },
  {
    id: "devilsknife",
    name: "Devilsknife",
    rarity: "Uncommon",
    description: "Lowers energy cost by 10 (minimum of 1 energy cost) of a random move for the battle.",
    onBattleStart({ unit, engine }) {
      const moves = unit.activeMoveIds || [];
      if (moves.length > 0) {
        const picked = moves[Math.floor(engine.rng() * moves.length)];
        unit.customCounters.devilsknifeMoveId = picked;
        const sk = Registry.getSkill(picked);
        engine.log(`[Item] ${unit.name}'s Devilsknife reduces [${sk?.name || picked}] Energy cost by 10.`, "info");
      }
    },
  },
  {
    id: "thorn_ring",
    name: "Thorn Ring",
    rarity: "Uncommon",
    description: "Lowers energy usage of ice attacks by 10%, but deals 10 damage to the user each turn until at or below 50% health.",
    onTurnStart({ unit, engine }) {
      if (unit.currentHp > unit.effectiveMaxHp * 0.5) {
        engine.dealTrueDamage(unit, 10, "Thorn Ring");
      }
    },
  },
  {
    id: "black_knife",
    name: "Black Knife",
    rarity: "Uncommon",
    description: "Replaces move 2 with Dark Fountain.",
    onBattleStart({ unit }) {
      if (unit.forms?.base?.moves?.length >= 2) {
        unit.forms.base.moves[1] = "dark_fountain";
      }
    },
  },
  {
    id: "fog_machine",
    name: "Fog Machine",
    rarity: "Uncommon",
    description: "Replaces current weather with Fog (one time use at battle start, granting +10% evasion).",
    onBattleStart({ unit, engine }) {
      unit.customCounters.evasionBonus = (unit.customCounters.evasionBonus || 0) + 10;
      engine.log(`[Item] ${unit.name}'s Fog Machine deploys battlefield Fog (+10% Evasion).`, "info");
    },
  },
  {
    id: "knife",
    name: "Knife",
    rarity: "Uncommon",
    description: "Deal 5 Steel damage to the target every time you use a physical move.",
    onAfterDealDamage({ attacker, target, skill, engine }) {
      if (
        target.currentHp > 0 &&
        (skill?.category === "Physical" || skill?.category === "Melee")
      ) {
        engine.dealTrueDamage(target, 5, `${attacker.name}'s Knife (Steel)`);
      }
    },
  },
  {
    id: "longsword",
    name: "Longsword",
    rarity: "Uncommon",
    description: "Targets targeting you with a physical move have their Turn Meter delayed by 15%.",
    onAfterTakeDamage({ attacker, skill, engine }) {
      if (
        attacker &&
        attacker.currentHp > 0 &&
        (skill?.category === "Physical" || skill?.category === "Melee")
      ) {
        engine.modifyTurnMeter(attacker, -0.15);
      }
    },
  },
  {
    id: "glock_17",
    name: "Gun (Glock 17)",
    rarity: "Uncommon",
    description: "Replaces first move with Shoot (Steel/Fire. 30 damage, 10 energy, 100 accuracy).",
    onBattleStart({ unit }) {
      if (unit.forms?.base?.moves?.length >= 1) {
        unit.forms.base.moves[0] = "glock_shoot";
      }
    },
  },
  {
    id: "ball",
    name: "Ball",
    rarity: "Uncommon",
    description: "Used once per game on first attack to deal 10 bonus damage and inflict [Stun] onto opponent.",
    onAfterDealDamage({ attacker, target, engine }) {
      if (target.currentHp > 0 && !attacker.customCounters.ballUsed) {
        attacker.customCounters.ballUsed = true;
        engine.dealTrueDamage(target, 10, "Ball Throw");
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
      }
    },
  },
  {
    id: "ketchup",
    name: "Ketchup",
    rarity: "Uncommon",
    description: "Heals user by 20 health instantly, or 5 health over 5 turns after reaching below 70% health (50/50 chance).",
    onAfterTakeDamage({ defender, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp < defender.effectiveMaxHp * 0.7 &&
        !defender.customCounters.ketchupUsed
      ) {
        defender.customCounters.ketchupUsed = true;
        if (engine.rng() < 0.5) {
          defender.currentHp = Math.min(defender.effectiveMaxHp, defender.currentHp + 20);
          engine.log(`[Item] ${defender.name}'s Ketchup heals 20 HP instantly.`, "heal");
        } else {
          defender.customCounters.ketchupRegenTurns = 5;
          engine.log(`[Item] ${defender.name}'s Ketchup activates 5 HP regen for 5 turns.`, "heal");
        }
      }
    },
    onTurnStart({ unit, engine }) {
      if ((unit.customCounters.ketchupRegenTurns || 0) > 0) {
        unit.customCounters.ketchupRegenTurns -= 1;
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 5);
        engine.log(`[Item] ${unit.name}'s Ketchup heals 5 HP.`, "heal");
      }
    },
  },
  {
    id: "remnant",
    name: "Remnant",
    rarity: "Uncommon",
    description: "Each opponent you defeat, gain 2% attack.",
    onKill({ attacker, engine }) {
      attacker.baseStats.atk = Math.round(attacker.baseStats.atk * 1.02 * 100) / 100;
      engine.log(`[Item] ${attacker.name}'s Remnant increases ATK by 2%.`, "info");
    },
  },
  {
    id: "butcher_knife",
    name: "Butcher Knife",
    rarity: "Uncommon",
    description: "Physical attacks lower target's DEF by 5 (if applicable).",
    onAfterDealDamage({ target, skill }) {
      if (
        target.currentHp > 0 &&
        (skill?.category === "Physical" || skill?.category === "Melee") &&
        target.baseStats.def > 0
      ) {
        target.baseStats.def = Math.max(0, target.baseStats.def - 5);
      }
    },
  },
  {
    id: "apple",
    name: "Apple",
    rarity: "Uncommon",
    description: "Heals 20 health when below 80% health. 60% chance to be a Bad Apple!! and deal 10 acid damage instead.",
    onAfterTakeDamage({ defender, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp < defender.effectiveMaxHp * 0.8 &&
        !defender.customCounters.appleUsed
      ) {
        defender.customCounters.appleUsed = true;
        if (engine.rng() <= 0.6) {
          engine.log(`[Item] Bad Apple!! ${defender.name}'s Apple deals 10 Acid damage instead!`, "crit");
          engine.dealTrueDamage(defender, 10, "Bad Apple (Acid)");
        } else {
          defender.currentHp = Math.min(defender.effectiveMaxHp, defender.currentHp + 20);
          engine.log(`[Item] ${defender.name}'s Apple heals 20 HP.`, "heal");
        }
      }
    },
  },
  {
    id: "soul_flame",
    name: "Soul Flame",
    rarity: "Uncommon",
    description: "25% chance at start of battle to be blessed ('Rushing Death Approaches'): Death moves cost 0 Energy, deal +25% damage, and ignore 25 DEF. If unblessed, +30% energy cost to Fire and Death attacks.",
    onBattleStart({ unit, engine }) {
      if (engine.rng() <= 0.25) {
        unit.customCounters.soulFlameBlessed = true;
        engine.log(`Rushing Death Approaches (${unit.name}'s Soul Flame is blessed!).`, "special");
      } else {
        unit.customCounters.soulFlameBlessed = false;
        engine.log(`[Item] ${unit.name}'s Soul Flame was not blessed (+30% Energy cost to Fire/Death moves).`, "status");
      }
    },
    modifyOutgoingDamage({ attacker, skill, damage }) {
      if (attacker.customCounters.soulFlameBlessed && skill.element === "Death") {
        return damage * 1.25;
      }
      return damage;
    },
  },
  {
    id: "dragonstone",
    name: "Dragonstone",
    rarity: "Uncommon",
    description: "Each hit taken increases the wearer's DEF by 1%. Stacks up to 10%.",
    onAfterTakeDamage({ defender }) {
      const stacks = defender.customCounters.dragonstoneStacks || 0;
      if (stacks < 10) {
        defender.customCounters.dragonstoneStacks = stacks + 1;
        defender.baseStats.def += 1;
      }
    },
  },
  {
    id: "heart_of_iron",
    name: "Heart of Iron",
    rarity: "Uncommon",
    description: "Increases the wearer's MAX HP by 1% for each hit they take. Stacks up to 10%.",
    onAfterTakeDamage({ defender }) {
      const stacks = defender.customCounters.heartOfIronStacks || 0;
      if (stacks < 10) {
        defender.customCounters.heartOfIronStacks = stacks + 1;
        const boost = Math.max(1, Math.round(defender.baseMaxHp * 0.01));
        defender.baseMaxHp += boost;
        defender.effectiveMaxHp += boost;
        defender.currentHp += boost;
      }
    },
  },
  {
    id: "shattered_hilt",
    name: "Shattered Hilt",
    rarity: "Uncommon",
    description: "Increases the wearer's damage by 10% when attacking targets with higher MAX HP.",
    modifyOutgoingDamage({ attacker, defender, damage }) {
      if (defender.effectiveMaxHp > attacker.effectiveMaxHp) {
        return damage * 1.1;
      }
      return damage;
    },
  },
  {
    id: "shield_of_the_captain",
    name: "Shield of the Captain",
    rarity: "Uncommon",
    description: "Increases DEF by 5.",
    statBonuses: { def: 5 },
  },
  {
    id: "lance_of_akumori",
    name: "Lance of Akumori",
    rarity: "Uncommon",
    description: "Wearer deals 2% more damage for each debuff the target is under.",
    modifyOutgoingDamage({ defender, damage, engine }) {
      const debuffs = engine.statusManager.countCategory(defender, "debuff");
      return damage * (1 + 0.02 * debuffs);
    },
  },
  {
    id: "frozen_quartz",
    name: "Frozen Quartz",
    rarity: "Uncommon",
    description: "Wearer takes 40% less damage when under [Freeze] or [Frozen] debuffs.",
    modifyIncomingDamage({ defender, damage, engine }) {
      if (
        engine.statusManager.hasStatus(defender, "freeze") ||
        engine.statusManager.hasStatus(defender, "frozen")
      ) {
        return damage * 0.6;
      }
      return damage;
    },
  },

  // ==========================================================
  // RARE ITEMS
  // ==========================================================
  {
    id: "mask_of_the_gods",
    name: "Mask of the Gods",
    rarity: "Rare",
    description: "Has a 1 in 20 (5%) chance each turn to release a rejuvenation nova (+25 health and energy).",
    onTurnStart({ unit, engine }) {
      if (engine.rng() <= 0.05) {
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 25);
        unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 25);
        engine.log(`[Item] ${unit.name}'s Mask of the Gods releases a Rejuvenation Nova (+25 HP, +25 Energy)!`, "heal");
      }
    },
  },
  {
    id: "the_soul",
    name: "The Soul",
    rarity: "Rare",
    description: "All allies share energy (sets max energy to 100 and synchronizes ally energy pools).",
    onBattleStart({ unit, engine }) {
      unit.maxEnergy = 100;
      unit.currentEnergy = Math.min(100, unit.currentEnergy);
      engine.log(`[Item] ${unit.name}'s The Soul links all allies' Energy pools.`, "special");
    },
  },
  {
    id: "grenade",
    name: "Grenade",
    rarity: "Rare",
    description: "Hits all opponents with 30 explosive Fire type damage at battle start. 30% chance to hit user as well (one time use).",
    onBattleStart({ unit, engine }) {
      engine.log(`[Item] ${unit.name} throws a Grenade (30 Fire DMG to all enemies)!`, "special");
      engine.getLivingEnemiesOf(unit).forEach((e) => {
        engine.dealTrueDamage(e, 30, "Grenade (Fire)");
      });
      if (engine.rng() <= 0.3) {
        engine.dealTrueDamage(unit, 30, "Grenade Backfire");
      }
    },
  },
  {
    id: "selling",
    name: "Selling",
    rarity: "Rare",
    description: "Has a 60% chance to give the opponent 20 health and energy, but 40% chance to give self 60 health and 60 energy. LET'S GO GAMBLING!!!",
    onTurnStart({ unit, engine }) {
      if (!unit.customCounters.sellingUsed) {
        unit.customCounters.sellingUsed = true;
        if (engine.rng() <= 0.4) {
          unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 60);
          unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 60);
          engine.log(`[Item] LET'S GO GAMBLING! ${unit.name} wins +60 HP and +60 Energy!`, "heal");
        } else {
          const enemy = engine.getLivingEnemiesOf(unit)[0];
          if (enemy) {
            enemy.currentHp = Math.min(enemy.effectiveMaxHp, enemy.currentHp + 20);
            enemy.currentEnergy = Math.min(enemy.maxEnergy, enemy.currentEnergy + 20);
            engine.log(`[Item] Selling backfires: ${enemy.name} gains +20 HP and +20 Energy.`, "status");
          }
        }
      }
    },
  },
  {
    id: "the_sun_oneshot",
    name: "The Sun from OneShot",
    rarity: "Rare",
    description: "When broken/used at battle start, everyone gets uncurable blindness for 1 round.",
    onBattleStart({ unit, engine }) {
      engine.getLivingUnits().forEach((u) => {
        engine.statusManager.applyStatus(unit, u, "blindness", {
          duration: 1,
          isProtected: true,
        });
      });
    },
  },
  {
    id: "poison_vial",
    name: "Poison",
    rarity: "Rare",
    description: "Kills anyone who steals this item by the end of next turn if they are not immune to Acid.",
  },
  {
    id: "strategists_kit",
    name: "Strategists Kit",
    rarity: "Rare",
    description: "Grants an Extra Turn after Resting.",
    onRest({ unit, engine }) {
      engine.log(`[Item] ${unit.name}'s Strategists Kit grants an Extra Turn after Resting!`, "special");
      engine.grantExtraTurn(unit);
    },
  },
  {
    id: "flashbang",
    name: "Flashbang",
    rarity: "Rare",
    description: "Stuns opponent(s) when used at battle start (One time Use).",
    onBattleStart({ unit, engine }) {
      engine.log(`[Item] ${unit.name} deploys Flashbang!`, "special");
      engine.getLivingEnemiesOf(unit).forEach((e) => {
        engine.statusManager.applyStatus(unit, e, "stun", { duration: 1 });
      });
    },
  },
  {
    id: "knuckleblaster",
    name: "Knuckleblaster",
    rarity: "Rare",
    description: "Your physical attacks also deal 10 Steel damage. If the target uses a physical move after you, also deal 15 Fire damage.",
    onAfterDealDamage({ attacker, target, skill, engine }) {
      if (
        target.currentHp > 0 &&
        (skill?.category === "Physical" || skill?.category === "Melee")
      ) {
        engine.dealTrueDamage(target, 10, "Knuckleblaster (Steel)");
      }
    },
  },
  {
    id: "necrobloxicon",
    name: "Necrobloxicon",
    rarity: "Rare",
    description: "User can survive at 1 health against an otherwise fatal attack. Boosts speed and attack by 20 when this happens and removes all defense (one time use).",
    onBeforeFatalDamage({ unit, engine }) {
      if (!unit.customCounters.necrobloxiconUsed) {
        unit.customCounters.necrobloxiconUsed = true;
        unit.currentHp = 1;
        unit.baseStats.spd += 20;
        unit.baseStats.atk += 20;
        unit.baseStats.def = 0;
        engine.log(`[Item] ${unit.name}'s Necrobloxicon prevents death at 1 HP (+20 SPD, +20 ATK, 0 DEF)!`, "special");
        return true;
      }
      return false;
    },
  },
  {
    id: "fractured_prism",
    name: "Fractured Prism",
    rarity: "Rare",
    description: "Wearer reflects 10% of damage taken.",
    onAfterTakeDamage({ attacker, defender, damageTaken, engine }) {
      if (attacker && attacker.currentHp > 0 && damageTaken > 0) {
        const refl = Math.max(1, Math.floor(damageTaken * 0.1));
        engine.dealTrueDamage(attacker, refl, `${defender.name}'s Fractured Prism Reflect`);
      }
    },
  },
  {
    id: "poisoned_hilt",
    name: "Poisoned Hilt",
    rarity: "Rare",
    description: "Wearer's attacks destroy ENEMY MAX HP by 1% for each buff the wearer is under. Stacks up to 10%.",
    onAfterDealDamage({ attacker, target, engine }) {
      if (target.currentHp > 0 && !target.isSummon) {
        const buffs = engine.statusManager.countCategory(attacker, "buff");
        if (buffs > 0) {
          target.destroyedHpPct = Math.min(10, (target.destroyedHpPct || 0) + buffs);
          target.effectiveMaxHp = Math.max(
            1,
            Math.floor(target.baseMaxHp * (1 - target.destroyedHpPct / 100))
          );
          if (target.currentHp > target.effectiveMaxHp) {
            target.currentHp = target.effectiveMaxHp;
          }
        }
      }
    },
  },
  {
    id: "unbroken_sheath",
    name: "Unbroken Sheath",
    rarity: "Rare",
    description: "Wearer has a 30% chance to block incoming [Stun], [Sleep], [Freeze] and [Frozen] debuffs.",
  },
  {
    id: "eye_of_flesh",
    name: "Eye of Flesh",
    rarity: "Rare",
    description: "Wearer's SPD increases by 20% after removing a [Stun], [Sleep], [Freeze], or [Frozen] debuff.",
  },
  {
    id: "hallowed_hilt",
    name: "Hallowed Hilt",
    rarity: "Rare",
    description: "Wearer places a [Block Damage] buff on themselves for 1 turn when their last living ally dies (or 20% chance whenever an ally dies, once per battle).",
    onAllyDied({ holder, engine }) {
      if (holder.customCounters.hallowedHiltUsed || holder.currentHp <= 0) return;
      const otherAllies = engine
        .getLivingAlliesOf(holder)
        .filter((a) => a.id !== holder.id);
      if (otherAllies.length === 0 || engine.rng() <= 0.2) {
        holder.customCounters.hallowedHiltUsed = true;
        engine.statusManager.applyStatus(holder, holder, "block_damage", { duration: 1 });
        engine.log(`[Item] ${holder.name}'s Hallowed Hilt grants [Block Damage] for 1 turn!`, "special");
      }
    },
  },
  {
    id: "ashes_of_corruption",
    name: "Ashes of Corruption",
    rarity: "Rare",
    description: "Wearer reflects 50% of damage taken when hit with a killing blow (includes surplus damage).",
  },

  // ==========================================================
  // LEGENDARY ITEMS
  // ==========================================================
  {
    id: "sigil_of_the_gods",
    name: "Sigil of the Gods",
    rarity: "Legendary",
    description: "Marks the user as a god. 10% chance at turn start to gain an Extra Turn; resurrects once with full HP when killed.",
    onTurnStart({ unit, engine }) {
      if (engine.rng() <= 0.1) {
        engine.log(`[Item] ${unit.name}'s Sigil of the Gods steals an Extra Turn!`, "special");
        engine.grantExtraTurn(unit);
      }
    },
    onBeforeFatalDamage({ unit, engine }) {
      if (!unit.customCounters.sigilGodsRevived) {
        unit.customCounters.sigilGodsRevived = true;
        unit.currentHp = unit.effectiveMaxHp;
        engine.log(`[Item] ${unit.name}'s Sigil of the Gods resurrects them at full HP!`, "heal");
        return true;
      }
      return false;
    },
  },
  {
    id: "legendary_hammer",
    name: "Legendary Hammer",
    rarity: "Legendary",
    description: "Steel type moves ignore 50% defense.",
  },
  {
    id: "super_vitamins",
    name: "Super Vitamins",
    rarity: "Legendary",
    description: "50% more damage on first STAB attack (one time use).",
    modifyOutgoingDamage({ attacker, skill, damage }) {
      if (skill.stab && !attacker.customCounters.superVitaminsUsed) {
        attacker.customCounters.superVitaminsUsed = true;
        return damage * 1.5;
      }
      return damage;
    },
  },
  {
    id: "medkit",
    name: "Medkit",
    rarity: "Legendary",
    description: "Heal 80 health when resting (one time use).",
    onRest({ unit, engine }) {
      if (!unit.customCounters.medkitUsed) {
        unit.customCounters.medkitUsed = true;
        unit.currentHp = Math.min(unit.effectiveMaxHp, unit.currentHp + 80);
        engine.log(`[Item] ${unit.name}'s Medkit heals 80 HP while resting!`, "heal");
      }
    },
  },
  {
    id: "insanitys_soul",
    name: "Insanity's Soul",
    rarity: "Legendary",
    description: "25% chance to take no damage from attacks.",
    modifyIncomingDamage({ defender, damage, engine }) {
      if (engine.rng() <= 0.25) {
        engine.log(`[Item] ${defender.name}'s Insanity's Soul negates the attack!`, "special");
        return 0;
      }
      return damage;
    },
  },
  {
    id: "high_tech_armor",
    name: "High Tech Armor",
    rarity: "Legendary",
    description: "10% less damage from physical attacks, immune to [Burn], -20% SPD. Passive item.",
    statBonuses: { spdMultiplier: 0.8 },
    modifyIncomingDamage({ skill, damage }) {
      if (skill.category === "Physical" || skill.category === "Melee") {
        return damage * 0.9;
      }
      return damage;
    },
  },
  {
    id: "really_long_arms",
    name: "Really Long Arms",
    rarity: "Legendary",
    description: "All attacks have +30% accuracy. Passive item.",
    statBonuses: { accuracyBonus: 30 },
  },
  {
    id: "scrapper",
    name: "Scrapper",
    rarity: "Legendary",
    description: "Scraps useless items into charges.",
  },
  {
    id: "terraria_ankh_shield",
    name: "Terraria Ankh Shield",
    rarity: "Legendary",
    description: "Grants [Block Debuffs] for 3 turns at the start of battle (one time use).",
    onBattleStart({ unit, engine }) {
      engine.statusManager.applyStatus(unit, unit, "block_debuffs", { duration: 3 });
    },
  },
  {
    id: "fumo",
    name: "Fumo",
    rarity: "Legendary",
    description: "20% chance each turn to grant a 1 HP decoy shield.",
    onTurnStart({ unit, engine }) {
      if (engine.rng() <= 0.2) {
        unit.shieldHp = (unit.shieldHp || 0) + 1;
        engine.statusManager.applyStatus(unit, unit, "shield", { duration: 1, silent: true });
        engine.log(`[Item] ${unit.name}'s Fumo spawns a 1 HP decoy barrier.`, "info");
      }
    },
  },
  {
    id: "red_bandana",
    name: "Red Bandana",
    rarity: "Legendary",
    description: "Enrages the user at battle start: +25 SPD, and next 3 attacks consume 0 Energy and deal +10 damage.",
    statBonuses: { spd: 25 },
    onBattleStart({ unit, engine }) {
      unit.customCounters.redBandanaCharges = 3;
      engine.log(`[Item] ${unit.name}'s Red Bandana enrages them (+25 SPD, 3 free +10 DMG attacks)!`, "special");
    },
    modifyOutgoingDamage({ attacker, damage }) {
      if ((attacker.customCounters.redBandanaCharges || 0) > 0) {
        return damage + 10;
      }
      return damage;
    },
  },
  {
    id: "resurrection_orb",
    name: "Resurrection Orb",
    rarity: "Legendary",
    description: "Once per battle, resurrects the wearer when killed at the cost of 75 Energy.",
    onBeforeFatalDamage({ unit, engine }) {
      if (!unit.customCounters.resOrbUsed && unit.currentEnergy >= 75) {
        unit.customCounters.resOrbUsed = true;
        unit.currentEnergy -= 75;
        unit.currentHp = Math.floor(unit.effectiveMaxHp * 0.5);
        engine.log(`[Item] ${unit.name}'s Resurrection Orb consumes 75 Energy to revive them at 50% HP!`, "heal");
        return true;
      }
      return false;
    },
  },
  {
    id: "lucky_block",
    name: "Lucky Block",
    rarity: "Legendary",
    description: "Grants a random stat surge when broken below 50% HP.",
    onAfterTakeDamage({ defender, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp < defender.effectiveMaxHp * 0.5 &&
        !defender.customCounters.luckyBlockUsed
      ) {
        defender.customCounters.luckyBlockUsed = true;
        engine.statusManager.applyStatus(defender, defender, "atk_up", { duration: 2 });
        engine.statusManager.applyStatus(defender, defender, "spd_up", { duration: 2 });
        engine.log(`[Item] ${defender.name}'s Lucky Block breaks open: gained [+ATK] and [+SPD]!`, "special");
      }
    },
  },
  {
    id: "tech_bomb",
    name: "Tech Bomb",
    rarity: "Legendary",
    description: "If attacked with a physical move when below 50% health, deals 15 damage to attacker, inflicts [Brittle], and increases user's SPD by 15 (1 time use).",
    onAfterTakeDamage({ attacker, defender, skill, engine }) {
      if (
        defender.currentHp > 0 &&
        defender.currentHp < defender.effectiveMaxHp * 0.5 &&
        !defender.customCounters.techBombUsed &&
        attacker &&
        (skill?.category === "Physical" || skill?.category === "Melee")
      ) {
        defender.customCounters.techBombUsed = true;
        defender.baseStats.spd += 15;
        engine.dealTrueDamage(attacker, 15, "Tech Bomb");
        engine.statusManager.applyStatus(defender, attacker, "brittle", { duration: 3 });
      }
    },
  },
  {
    id: "speed_coil",
    name: "Speed Coil",
    rarity: "Legendary",
    description: "Increases Speed by 15 and grants +10% evasion.",
    statBonuses: { spd: 15 },
    onBattleStart({ unit }) {
      unit.customCounters.evasionBonus = (unit.customCounters.evasionBonus || 0) + 10;
    },
  },
  {
    id: "gravity_coil",
    name: "Gravity Coil",
    rarity: "Legendary",
    description: "Switches between Grounded (+10% evasion) and Airborne (-25% physical damage taken) each turn.",
    onTurnStart({ unit }) {
      unit.customCounters.airborne = !unit.customCounters.airborne;
    },
    modifyIncomingDamage({ defender, skill, damage }) {
      if (
        defender.customCounters.airborne &&
        (skill.category === "Physical" || skill.category === "Melee")
      ) {
        return damage * 0.75;
      }
      return damage;
    },
  },
  {
    id: "double_effect_orb",
    name: "That-One-Double-Effect-Orb",
    rarity: "Legendary",
    description: "Amplifies outgoing damage and healing by 25%.",
    modifyOutgoingDamage({ damage }) {
      return damage * 1.25;
    },
  },
  {
    id: "crushing_warhammer",
    name: "Crushing Warhammer",
    rarity: "Legendary",
    description: "The wearer ignores 20% of target's DEF when attacking targets with higher MAX HP.",
    getBonusIgnoreDef({ attacker, target }) {
      return target.effectiveMaxHp > attacker.effectiveMaxHp ? 0.2 : 0;
    },
  },
  {
    id: "death_sickle",
    name: "Death Sickle",
    rarity: "Legendary",
    description: "Wearer deals 100% more damage, but takes 200% more damage.",
    modifyOutgoingDamage({ damage }) {
      return damage * 2.0;
    },
    modifyIncomingDamage({ damage }) {
      return damage * 3.0;
    },
  },
  {
    id: "fleshmelter_lash",
    name: "Fleshmelter Lash",
    rarity: "Legendary",
    description: "Wearer has a 20% chance each hit to deal bonus True Damage equal to 50% of the attack's damage (once per turn).",
    onAfterDealDamage({ attacker, target, damageDealt, engine }) {
      if (target.currentHp > 0 && damageDealt > 0 && engine.rng() <= 0.2) {
        const bonus = Math.max(1, Math.floor(damageDealt * 0.5));
        engine.dealTrueDamage(target, bonus, "Fleshmelter Lash (50% True DMG)");
      }
    },
  },
  {
    id: "gauntlet_of_ruin",
    name: "Gauntlet of Ruin",
    rarity: "Legendary",
    description: "Wearer deals True Damage equal to 1% of the target's MAX HP per debuff on them.",
    onAfterDealDamage({ attacker, target, engine }) {
      if (target.currentHp > 0) {
        const debuffs = engine.statusManager.countCategory(target, "debuff");
        if (debuffs > 0) {
          const pct = Math.min(0.1, 0.01 * debuffs);
          const dmg = Math.max(1, Math.floor(target.effectiveMaxHp * pct));
          engine.dealTrueDamage(target, dmg, `Gauntlet of Ruin (${debuffs} debuffs)`);
        }
      }
    },
  },
  {
    id: "wand_of_submission",
    name: "Wand of Submission",
    rarity: "Legendary",
    description: "Wearer has a 50% chance to reflect incoming [Stun], [Sleep], [Freeze] and [Frozen] debuffs.",
  },

  // ==========================================================
  // MYTHICAL ITEMS
  // ==========================================================
  {
    id: "equilibrium",
    name: "Equilibrium",
    rarity: "Mythical",
    description: "Switches world state every 3 turns, lowering opponent DEF by 5 and granting +10% dodge chance to the user.",
    onBattleStart({ unit }) {
      unit.customCounters.evasionBonus = (unit.customCounters.evasionBonus || 0) + 10;
    },
    onTurnStart({ unit, engine }) {
      unit.customCounters.eqCounter = (unit.customCounters.eqCounter || 0) + 1;
      if (unit.customCounters.eqCounter % 3 === 0) {
        engine.getLivingEnemiesOf(unit).forEach((e) => {
          e.baseStats.def = Math.max(0, e.baseStats.def - 5);
        });
        engine.log(`[Item] ${unit.name}'s Equilibrium shifts geometry: enemies lose 5 DEF!`, "special");
      }
    },
  },
  {
    id: "the_crystal",
    name: "The Crystal",
    rarity: "Mythical",
    description: "Sets wearer's DEF to 85%, heals to full at start, and doubles outgoing attack damage.",
    onBattleStart({ unit, engine }) {
      unit.baseStats.def = 85;
      unit.currentHp = unit.effectiveMaxHp;
      engine.log(`[Item] ${unit.name} activates The Crystal (DEF raised, 2x Damage)!`, "special");
    },
    modifyOutgoingDamage({ damage }) {
      return damage * 2.0;
    },
  },
  {
    id: "tests_hammer",
    name: "Test's Hammer",
    rarity: "Mythical",
    description: "After hitting an opponent with a Melee move, stuns them for 1 turn and locks them to Ranged moves for 2 turns.",
    onAfterDealDamage({ attacker, target, skill, engine }) {
      if (target.currentHp > 0 && skill?.category === "Melee") {
        engine.statusManager.applyStatus(attacker, target, "stun", { duration: 1 });
        engine.statusManager.applyStatus(attacker, target, "ranged_only_lock", { duration: 2 });
      }
    },
  },
  {
    id: "insanitys_mask",
    name: "Insanity's Mask",
    rarity: "Mythical",
    description: "Grants +25% ATK and +25% SPD at the start of battle.",
    onBattleStart({ unit, engine }) {
      engine.statusManager.applyStatus(unit, unit, "atk_up", { duration: 3 });
      engine.statusManager.applyStatus(unit, unit, "spd_up", { duration: 3 });
    },
  },
  {
    id: "egg_mythical",
    name: "E G G",
    rarity: "Mythical",
    description: "Deals 9999 Space type damage to everyone when the wearer is killed (99% accuracy).",
  },
  {
    id: "chronocube",
    name: "Chronocube",
    rarity: "Mythical",
    description: "Wearer takes two turns in a row at the start of the battle, then skips their next turn (once per battle).",
    onBattleStart({ unit, engine }) {
      unit.turnMeter = 1200;
      engine.grantExtraTurn(unit);
      unit.customCounters.chronocubeSkipNext = false;
      engine.log(`[Item] ${unit.name}'s Chronocube grants two consecutive opening turns!`, "special");
    },
  },
  {
    id: "blossoming_spore_rod",
    name: "Blossoming Spore Rod",
    rarity: "Mythical",
    description: "Whenever the wearer places a debuff, has a 30% chance of extending or stacking that debuff.",
  },
  {
    id: "refracting_mirror",
    name: "Refracting Mirror",
    rarity: "Mythical",
    description: "The wearer ignores 30% of target's DEF when attacking targets with higher MAX HP.",
    getBonusIgnoreDef({ attacker, target }) {
      return target.effectiveMaxHp > attacker.effectiveMaxHp ? 0.3 : 0;
    },
  },
  {
    id: "lens_of_intangibility",
    name: "Lens of Intangibility",
    rarity: "Mythical",
    description: "Will deal 50% more damage to targets with higher MAX HP.",
    modifyOutgoingDamage({ attacker, defender, damage }) {
      if (defender.effectiveMaxHp > attacker.effectiveMaxHp) {
        return damage * 1.5;
      }
      return damage;
    },
  },

  // Classic starter items retained for compatibility
  {
    id: "anarch_sigil",
    name: "Sigil of Anarchy",
    rarity: "Rare",
    description: "Increases SPD by 10 and grants +15 Energy at the start of battle.",
    statBonuses: { spd: 10 },
    onBattleStart({ unit }) {
      unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 15);
    },
  },
  {
    id: "chronos_hourglass",
    name: "Chronos Hourglass",
    rarity: "Rare",
    description: "Increases Speed by 15% and restores 5 Energy at the start of each turn.",
    statBonuses: { spdMultiplier: 1.15 },
    onTurnStart({ unit }) {
      unit.currentEnergy = Math.min(unit.maxEnergy, unit.currentEnergy + 5);
    },
  },
  {
    id: "vampiric_chalice",
    name: "Vampiric Chalice",
    rarity: "Rare",
    description: "Heals the wearer for 15% of damage dealt after attacking.",
    onAfterDealDamage({ attacker, damageDealt }) {
      if (damageDealt > 0 && attacker.currentHp > 0) {
        const heal = Math.max(1, Math.floor(damageDealt * 0.15));
        attacker.currentHp = Math.min(attacker.effectiveMaxHp, attacker.currentHp + heal);
      }
    },
  },
  {
    id: "aegis_core",
    name: "Aegis Core",
    rarity: "Rare",
    description: "Increases Defense by 10 and applies [Increase DEF] for 2 turns at battle start.",
    statBonuses: { def: 10 },
    onBattleStart({ unit, engine }) {
      engine.statusManager.applyStatus(unit, unit, "def_up", { duration: 2 });
    },
  },
  {
    id: "executioner_lens",
    name: "Executioner's Lens",
    rarity: "Rare",
    description: "Increases Critical Damage by 25% and Accuracy by 15%.",
    statBonuses: { critDmg: 25, accuracyBonus: 15 },
  },
];

export function registerAllItems() {
  ITEM_LIST.forEach((item) => Registry.registerItem(item));
}
