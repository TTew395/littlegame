# Realms of Anarchy — WebRTC Turn-Based Squad & Boss Raid Battler

A static, zero-backend multiplayer turn-based RPG built for **GitHub Pages** and **WebRTC DataChannels**, combining *Pokémon* (STAB, Accuracy, Species resistances, Multi-Form switching, Energy/Wait/Rest stances) and *Raid: Shadow Legends* (1000-threshold Turn Meter, Action Delay, Destroyed Max HP, Protected Debuffs, Multi-Character Boss Raids, and Linked Soul Spear Summons).

## ✨ Featured Characters & Mechanics Included

### 1. Karnage the Anarch (Multi-Form Striker)
- **Stats:** 110 HP | 120 Energy | 105 SPD | 10 DEF | 12 ATK
- **Ability — Avatar of Anarchy:** Increases C. DMG by 1 for every 3 points of SPD.
- **Species — Higher Being:** 50% reduced damage from Chaos, Dragon, and Tek.
- **Base Form Moves:**
  - **Sufferslash:** 2 hits (`1 x ATK + 0.1 x SPD` each), 15 Energy.
  - **Anarchic Realm:** Before attacking, 75% chance to swap HP with the target, then deals `4 x ATK + 0.1 x SPD` (STAB), 90 Energy.
  - **Trinity of Pain:** 3 hits (`1.5 x ATK + 0.1 x SPD` each, STAB, 60% Acc). Hit 1 places `[Block Passive Skills]` (2T), Hit 2 places `[Seal]` (2T), Hit 3 places `[Deathbrand]` (2T). If target's SPD is lower than Karnage's, these debuffs are **Protected** 🔒.
  - **Metamorph:** Transforms into Alternate Form and grants an **Extra Turn** (0 Energy, 4T Cooldown).
- **Alternate Form Moves:**
  - **Hellfire:** 2 hits (`1 x ATK + 0.1 x SPD` each), 15 Energy.
  - **Stars of Destruction:** Attacks all enemies (`2 x ATK + 0.1 x SPD`, STAB, 90% Acc), 90 Energy.
  - **Reality Reversal:** Attacks all enemies (`1.5 x ATK + 0.1 x SPD`, STAB, 60% Acc), 120 Energy. `>=1` debuff grants an extra hit; `>=2` debuffs ignores 30% DEF; `>=3` debuffs places `[Block Revive]` on kill.
  - **Metamorph:** Transforms back into Base Form and grants an **Extra Turn**.

### 2. Antikhonor, Broken God (5v1 Raid Boss)
- **Stats:** 900 HP (1058 eHP) | 100 Energy | 75 SPD | 15 DEF (-15% DMG) | 20 ATK
- **Ability 1 — Master of Legions:**
  - Starts battle and each turn with **8 stacks of War Armor** (each stack reduces incoming damage by 4%).
  - Reduced by 1 stack whenever attacked by an enemy skill (**once per skill**).
  - When War Armor is fully depleted: deals **10% MAX HP** damage to Antikhonor and delays action (Turn Meter) by **20%**, clearing all Glory stacks.
  - When attacked while at 0 War Armor stacks: takes **1% MAX HP True Damage** (once per skill).
- **Ability 2 — Almighty Immunity:**
  - Caps enemy MAX HP scaling effects at 10% of Boss MAX HP.
  - Immune to `[Stun]`, `[Sleep]`, `[Freeze]`, `[Frozen]`, `[Block Passive Skills]`, `[Heart-Melt]`, Turn Skipping, and Turn Meter reduction.
- **Boss Moves:**
  - **Lance of Light:** Single-target `[Death]` (`1 x ATK`, STAB), 10 Energy.
  - **Pyre of High Graves:** Attacks all enemies 3 times (`1.5 x ATK x 3`). Ignores **4% of target DEF per War Armor stack** on Antikhonor, 30 Energy.
  - **Glory to All Honorable Dead:** Requires 3 skills used first. Summons a tied **Soul Spear** for each enemy (`200%` of tied hero's MAX HP; takes `+100%` damage from its tied hero; destroys `1%` MAX HP for every `2%` HP the Soul Spear has; damages Antikhonor for `5%` MAX HP when destroyed). Raises War Armor to **12** and applies **1 Glory stack** to all characters. Forces *All Realms Leveled, Legions to Dust* next turn.
  - **All Realms Leveled, Legions to Dust:** Undodgeable AoE (`2 x ATK`). Damage increases by **+5% per 1% missing HP** and **+10% per 1% destroyed HP** per target. Ignores **100% DEF** and bypasses all enemy buffs/passives.

### 3. Universal Stance Commands
- **Wait:** Regains `1/5` of Max Energy and keeps full Defense.
- **Rest:** Regains `1/3` of Max Energy, halving Defense until the turn comes back to the character.

---

## 🧩 How to Add Dozens of Characters, Items, Skills, Bosses & Abilities

Everything is data-driven and registered through `src/engine/Registry.js`. You never have to touch the UI or networking code to add new content:

1. **Add a Status Effect (Buff/Debuff):** Add an object to `STATUS_LIST` in [`src/data/statuses.js`](./src/data/statuses.js) (`stackBehavior: "refresh" | "stack"`, `tickTiming: "TURN_START" | "TURN_END" | "NEVER"`).
2. **Add a Species:** Add an entry to `SPECIES_LIST` in [`src/data/species.js`](./src/data/species.js).
3. **Add an Item:** Add an entry to `ITEM_LIST` in [`src/data/items.js`](./src/data/items.js).
4. **Add an Ability:** Add an entry to `ABILITY_LIST` in [`src/data/abilities.js`](./src/data/abilities.js) using lifecycle hooks (`modifyStats`, `onBattleStart`, `onTurnStart`, `onAfterSkillAttacked`, `modifyIncomingDamage`, `onTurnEnd`).
5. **Add a Skill / Move:** Add an entry to `SKILL_LIST` in [`src/data/skills.js`](./src/data/skills.js).
6. **Add a Character or Boss:** Add an entry to `CHARACTER_LIST` in [`src/data/characters.js`](./src/data/characters.js).

---

## 🌐 Hosting on GitHub Pages
1. Go to your repository on GitHub: **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch** → Branch: `main` / `/ (root)` and click **Save**.
3. Open your live GitHub Pages URL and click **🌐 WebRTC Multiplayer** to host or join a P2P room!
