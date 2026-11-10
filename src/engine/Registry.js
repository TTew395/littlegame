/**
 * Central Registry for Game Content (Characters, Skills, Abilities, Statuses, Species, Items, Summons).
 * Designed so dozens of characters, bosses, items, skills, and abilities can be registered declaratively.
 */

class ContentRegistry {
  constructor() {
    this.characters = new Map();
    this.skills = new Map();
    this.abilities = new Map();
    this.statuses = new Map();
    this.species = new Map();
    this.items = new Map();
    this.summons = new Map();
  }

  registerCharacter(def) {
    if (!def.id) throw new Error("Character definition requires an id");
    this.characters.set(def.id, def);
    return def;
  }

  registerSkill(def) {
    if (!def.id) throw new Error("Skill definition requires an id");
    this.skills.set(def.id, def);
    return def;
  }

  registerAbility(def) {
    if (!def.id) throw new Error("Ability definition requires an id");
    this.abilities.set(def.id, def);
    return def;
  }

  registerStatus(def) {
    if (!def.id) throw new Error("Status definition requires an id");
    this.statuses.set(def.id, def);
    return def;
  }

  registerSpecies(def) {
    if (!def.id) throw new Error("Species definition requires an id");
    this.species.set(def.id, def);
    return def;
  }

  registerItem(def) {
    if (!def.id) throw new Error("Item definition requires an id");
    this.items.set(def.id, def);
    return def;
  }

  registerSummon(def) {
    if (!def.id) throw new Error("Summon definition requires an id");
    this.summons.set(def.id, def);
    return def;
  }

  getCharacter(id) {
    return this.characters.get(id);
  }

  getSkill(id) {
    return this.skills.get(id);
  }

  getAbility(id) {
    return this.abilities.get(id);
  }

  getStatus(id) {
    return this.statuses.get(id);
  }

  getSpecies(id) {
    return this.species.get(id);
  }

  getItem(id) {
    return this.items.get(id);
  }

  getSummon(id) {
    return this.summons.get(id);
  }

  getAllCharacters() {
    return Array.from(this.characters.values());
  }

  getAllItems() {
    return Array.from(this.items.values());
  }
}

export const Registry = new ContentRegistry();
