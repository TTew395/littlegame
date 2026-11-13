/**
 * Main Application & UI Controller (Emoji-free + Command Hub + Team Builder + Condensed Logs)
 */

import { initializeGameContent } from "./data/index.js?v=15";
import { Registry } from "./engine/Registry.js";
import { BattleEngine } from "./engine/BattleEngine.js?v=15";
import { P2PNetworkManager } from "./network/P2PNetworkManager.js?v=15";

initializeGameContent();

export const BOSS_ENCOUNTERS = [
  {
    id: "raid_antikhonor",
    bossId: "antikhonor_broken_god",
    name: "Antikhonor, Broken God",
    recommended: "5 Characters Recommended",
    summary: "War Armor (8/12 stacks), Glory, Linked Soul Spears, Destroyed MAX HP.",
    enemyTeam: [{ characterId: "antikhonor_broken_god" }],
  },
  {
    id: "raid_ouroboros",
    bossId: "ouroboros_the_swarm",
    name: "Ouroboros, The Swarm",
    recommended: "5 Characters Recommended",
    summary: "Brood Queen Swarm Spawns, Evolution Counter (8), Queen's Spawn Vulnerability.",
    enemyTeam: [
      { characterId: "ouroboros_the_swarm" },
      { characterId: "swarm_spawn" },
      { characterId: "swarm_spawn" },
    ],
  },
  {
    id: "raid_novok",
    bossId: "crypt_keeper_novok",
    name: "Crypt-Keeper Novok",
    recommended: "5 Characters Recommended",
    summary: "Gravewalker Revive, Shield-scaling Team-Up, Ally Death 20% True DMG Backlash.",
    enemyTeam: [
      { characterId: "crypt_keeper_novok" },
      { characterId: "grave_acolyte" },
      { characterId: "grave_acolyte" },
    ],
  },
  {
    id: "raid_ternax",
    bossId: "ternax_hellfire",
    name: "Ternax Hellfire",
    recommended: "5 Characters Recommended",
    summary: "Lethal Lava Burn Heal & Energy Regen, Molten Immunity, Hex Defense Bypass.",
    enemyTeam: [{ characterId: "ternax_hellfire" }],
  },
  {
    id: "raid_zander",
    bossId: "first_genius_zander",
    name: "First Genius, Zander",
    recommended: "6 Characters Recommended",
    summary: "Transmutation (600) -> Evolution State, Beta-Link 0-Energy Trap, Termination (8).",
    enemyTeam: [{ characterId: "first_genius_zander" }],
  },
  {
    id: "raid_allekheiros",
    bossId: "allekheiros_eternal_guardian",
    name: "Allekheiros, Eternal Guardian",
    recommended: "5 Characters Recommended",
    summary: "Forever Waiting (-10% DMG per hit), Silent Charging Counter, Stars Shall Weep.",
    enemyTeam: [{ characterId: "allekheiros_eternal_guardian" }],
  },
  {
    id: "raid_theridine",
    bossId: "theridine_great_septimus",
    name: "Theridine, Great Septimus",
    recommended: "5 Characters Recommended",
    summary: "Godspawn (50 HP x 16 Bars), Communal Shields, 7-Bar Im Anfang War die Tat.",
    enemyTeam: [{ characterId: "theridine_great_septimus" }],
  },
];

class GameApp {
  constructor() {
    this.currentView = "hub"; // "hub" | "battle"
    this.engine = null;
    this.selectedMoveId = null;
    this.selectedTargetId = null;
    this.inspectedUnitId = null;
    this.autoBossAi = true;

    // Hub state: player's selected team (up to 6 characters) & opposing team (up to 6 champions or bosses)
    this.selectedTeam = [
      { characterId: "karnage_the_anarch", itemId: "anarch_sigil" },
      { characterId: "byun", itemId: "kawabunga_coffee" },
      { characterId: "marius_the_gallant", itemId: "shield_of_the_captain" },
      { characterId: "solanar_the_gleaming", itemId: "fire_ruby" },
      { characterId: "debt_bearer_alnith", itemId: "sharp_claws" },
    ];
    this.selectedEnemyTeam = [
      { characterId: "antikhonor_broken_god", itemId: "none" },
    ];
    this.selectedBossEncounterId = "raid_antikhonor";
    this.lastEncounterConfig = null;

    this.network = new P2PNetworkManager({
      onStatusChange: (text, state) => this.updateNetworkStatusUI(text, state),
      onPeerConnected: () => {
        if (this.network.role === "host" && this.engine) {
          this.network.broadcastBattleState(this.engine.serializeState());
        }
      },
      onBattleStateReceived: (snapshot) => {
        if (!this.engine) {
          this.engine = new BattleEngine({ mode: snapshot.mode, seed: snapshot.seed });
        }
        this.engine.hydrateState(snapshot);
        this.switchView("battle");
        this.ensureValidSelection({ syncInspectorToActive: true });
        this.renderAll();
      },
      onActionSubmitted: (action) => {
        if (this.network.role === "host" && this.engine) {
          this.handlePlayerAction(action, { fromRemotePeer: true });
        }
      },
    });

    this.statusDrawerFilter = "all";
    this.statusDrawerSearch = "";

    this.bindStaticEvents();
    this.initStatusDrawer();
    this.renderHub();
    this.renderCodexModal();
  }

  switchView(viewName) {
    this.currentView = viewName;
    const hubEl = document.getElementById("hub-screen");
    const battleEl = document.getElementById("battle-screen");
    const returnHubBtn = document.getElementById("return-hub-btn");

    if (viewName === "hub") {
      hubEl?.classList.remove("hidden");
      battleEl?.classList.add("hidden");
      returnHubBtn?.classList.add("hidden");
      this.renderHub();
    } else {
      hubEl?.classList.add("hidden");
      battleEl?.classList.remove("hidden");
      returnHubBtn?.classList.remove("hidden");
    }
  }

  // =========================================================================
  // HUB & PRE-BATTLE TEAM BUILDER
  // =========================================================================
  renderHub() {
    this.renderSelectedTeamSlots();
    this.renderSelectedEnemyTeamSlots();
    this.renderCharacterPool();
    this.renderBossSelectionGrid();
  }

  renderSelectedTeamSlots() {
    const container = document.getElementById("selected-team-slots");
    const countLabel = document.getElementById("team-count-label");
    if (!container) return;

    if (countLabel) {
      countLabel.textContent = String(this.selectedTeam.length);
    }

    const allItems = Registry.getAllItems();

    if (this.selectedTeam.length === 0) {
      container.innerHTML = `<div class="empty-team-msg">No characters selected. Click "+ Team 1" on any character below to add up to 6 members.</div>`;
      return;
    }

    container.innerHTML = this.selectedTeam
      .map((slot, idx) => {
        const charDef = Registry.getCharacter(slot.characterId);
        if (!charDef) return "";
        const itemOptions = allItems
          .map(
            (it) =>
              `<option value="${it.id}" ${it.id === slot.itemId ? "selected" : ""}>${
                it.tier ? `[${it.tier}] ` : ""
              }${it.name}</option>`
          )
          .join("");

        return `
          <div class="team-slot-card">
            <div class="slot-top">
              <span class="unit-code-badge ${charDef.isBoss ? "boss" : ""}">${charDef.avatar}</span>
              <div class="slot-info">
                <strong>${idx + 1}. ${charDef.name}</strong>
                <small>${charDef.types.join(" / ")} • HP ${charDef.stats.hp} • SPD ${charDef.stats.spd}</small>
              </div>
              <button type="button" class="slot-remove-btn" data-remove-idx="${idx}" title="Remove from team">Remove</button>
            </div>
            <select class="slot-item-select" data-slot-idx="${idx}">
              ${itemOptions}
            </select>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll("[data-remove-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeIdx);
        this.selectedTeam.splice(idx, 1);
        this.renderHub();
      });
    });

    container.querySelectorAll(".slot-item-select").forEach((sel) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.slotIdx);
        if (this.selectedTeam[idx]) {
          this.selectedTeam[idx].itemId = sel.value;
        }
      });
    });
  }

  renderSelectedEnemyTeamSlots() {
    const container = document.getElementById("selected-enemy-team-slots");
    const countLabel = document.getElementById("enemy-team-count-label");
    if (!container) return;

    if (countLabel) {
      countLabel.textContent = String(this.selectedEnemyTeam.length);
    }

    const allItems = Registry.getAllItems();

    if (this.selectedEnemyTeam.length === 0) {
      container.innerHTML = `<div class="empty-team-msg">No opponents selected. Click Boss cards below or click "+ Opponent" on any Champion/Boss in the pool to add up to 6 opponents.</div>`;
      return;
    }

    container.innerHTML = this.selectedEnemyTeam
      .map((slot, idx) => {
        const charDef = Registry.getCharacter(slot.characterId);
        if (!charDef) return "";
        const itemOptions = allItems
          .map(
            (it) =>
              `<option value="${it.id}" ${it.id === (slot.itemId || "none") ? "selected" : ""}>${
                it.tier ? `[${it.tier}] ` : ""
              }${it.name}</option>`
          )
          .join("");

        return `
          <div class="team-slot-card enemy-slot-card">
            <div class="slot-top">
              <span class="unit-code-badge ${charDef.isBoss ? "boss" : ""}">${charDef.avatar}</span>
              <div class="slot-info">
                <strong>${idx + 1}. ${charDef.name}</strong>
                <small>${charDef.types.join(" / ")} • HP ${charDef.stats.hp} • SPD ${charDef.stats.spd}</small>
              </div>
              <button type="button" class="slot-remove-btn" data-remove-enemy-idx="${idx}" title="Remove opponent">Remove</button>
            </div>
            <select class="slot-item-select" data-enemy-slot-idx="${idx}">
              ${itemOptions}
            </select>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll("[data-remove-enemy-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeEnemyIdx);
        this.selectedEnemyTeam.splice(idx, 1);
        this.renderHub();
      });
    });

    container.querySelectorAll("[data-enemy-slot-idx]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.enemySlotIdx);
        if (this.selectedEnemyTeam[idx]) {
          this.selectedEnemyTeam[idx].itemId = sel.value;
        }
      });
    });
  }

  canAddCharacterToTeam(charDef, team = this.selectedTeam, labelPrefix = "+ Team 1") {
    if (!charDef) return { allowed: false, reason: "Invalid character" };
    if (team.length >= 6) {
      return { allowed: false, reason: "Full (6/6)" };
    }
    return { allowed: true, reason: labelPrefix };
  }

  validateTeamRules(team, teamLabel = "your team") {
    if (!team || team.length === 0) {
      return { valid: false, error: `Please add at least 1 character or boss to ${teamLabel} before launching a battle.` };
    }
    return { valid: true };
  }

  renderCharacterPool() {
    const container = document.getElementById("character-pool-grid");
    if (!container) return;

    const playableChars = Registry.getAllCharacters()
      .filter((c) => !c.isMinion)
      .sort((a, b) => Number(Boolean(a.isBoss)) - Number(Boolean(b.isBoss)));

    container.innerHTML = playableChars
      .map((c) => {
        const abilities = (c.abilityIds || [])
          .map((id) => Registry.getAbility(id)?.name)
          .filter(Boolean)
          .join(", ");
        const checkTeam1 = this.canAddCharacterToTeam(c, this.selectedTeam, "+ Team 1");
        const checkTeam2 = this.canAddCharacterToTeam(c, this.selectedEnemyTeam, "+ Opponent");

        return `
          <div class="pool-char-card ${c.isBoss ? "pool-boss" : ""}">
            <div class="pool-card-head">
              <span class="unit-code-badge ${c.isBoss ? "boss" : ""}">${c.avatar}</span>
              <div>
                <h4>${c.name}</h4>
                <small>${c.role} • ${c.types.join("/")}</small>
              </div>
            </div>
            <div class="pool-stats">
              HP ${c.stats.hp} | EN ${c.stats.energy} | ATK ${c.stats.atk} | DEF ${c.stats.def}% | SPD ${c.stats.spd}
            </div>
            <div class="pool-abilities">Passive: ${abilities || "None"}</div>
            <div class="pool-btn-row">
              <button type="button" class="action-btn add-char-btn" data-char-id="${c.id}" ${!checkTeam1.allowed ? "disabled" : ""}>
                ${checkTeam1.reason}
              </button>
              <button type="button" class="action-btn add-enemy-char-btn" data-enemy-char-id="${c.id}" ${!checkTeam2.allowed ? "disabled" : ""}>
                ${checkTeam2.reason}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".add-char-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const charId = btn.dataset.charId;
        const def = Registry.getCharacter(charId);
        const check = this.canAddCharacterToTeam(def, this.selectedTeam, "+ Team 1");
        if (!check.allowed) return;
        this.selectedTeam.push({
          characterId: charId,
          itemId: def?.defaultItemId || "none",
        });
        this.renderHub();
      });
    });

    container.querySelectorAll(".add-enemy-char-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const charId = btn.dataset.enemyCharId;
        const def = Registry.getCharacter(charId);
        const check = this.canAddCharacterToTeam(def, this.selectedEnemyTeam, "+ Opponent");
        if (!check.allowed) return;
        this.selectedEnemyTeam.push({
          characterId: charId,
          itemId: def?.defaultItemId || "none",
        });
        this.renderHub();
      });
    });
  }

  renderBossSelectionGrid() {
    const container = document.getElementById("boss-selection-grid");
    if (!container) return;

    container.innerHTML = BOSS_ENCOUNTERS.map((enc) => {
      const bossDef = Registry.getCharacter(enc.bossId);
      const countInEnemyTeam = this.selectedEnemyTeam.filter(
        (s) => s.characterId === enc.bossId
      ).length;
      const isSelected = countInEnemyTeam > 0;
      return `
        <div class="boss-select-card ${isSelected ? "selected" : ""}" data-enc-id="${enc.id}">
          <div class="boss-select-top">
            <span class="unit-code-badge boss">${bossDef?.avatar || "BOSS"}</span>
            <div>
              <h4>${enc.name} ${isSelected ? `<span class="boss-selected-pill">Selected${countInEnemyTeam > 1 ? ` x${countInEnemyTeam}` : ""}</span>` : ""}</h4>
              <small>${enc.recommended} • HP ${bossDef?.stats.hp} • DEF ${bossDef?.stats.def}% • SPD ${bossDef?.stats.spd}</small>
            </div>
          </div>
          <p class="boss-select-desc">${enc.summary}</p>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".boss-select-card").forEach((card) => {
      card.addEventListener("click", () => {
        const encId = card.dataset.encId;
        this.selectedBossEncounterId = encId;
        const enc = BOSS_ENCOUNTERS.find((e) => e.id === encId);
        if (!enc) return;

        const existingIdx = this.selectedEnemyTeam.findIndex(
          (s) => s.characterId === enc.bossId
        );
        if (existingIdx >= 0) {
          this.selectedEnemyTeam.splice(existingIdx, 1);
        } else if (this.selectedEnemyTeam.length < 6) {
          const bossDef = Registry.getCharacter(enc.bossId);
          this.selectedEnemyTeam.push({
            characterId: enc.bossId,
            itemId: bossDef?.defaultItemId || "none",
          });
        }
        this.renderHub();
      });
    });
  }

  buildEnemyTeamForLaunch() {
    if (this.selectedEnemyTeam.length === 1) {
      const singleId = this.selectedEnemyTeam[0].characterId;
      const matchingEnc = BOSS_ENCOUNTERS.find((e) => e.bossId === singleId);
      if (matchingEnc && matchingEnc.enemyTeam.length > 1) {
        return [
          { ...this.selectedEnemyTeam[0] },
          ...matchingEnc.enemyTeam.slice(1).map((slot) => ({ ...slot })),
        ];
      }
    }
    return this.selectedEnemyTeam.map((slot) => ({ ...slot }));
  }

  launchBossRaidFromHub() {
    const check1 = this.validateTeamRules(this.selectedTeam, "Team 1");
    if (!check1.valid) {
      alert(check1.error);
      return;
    }
    const check2 = this.validateTeamRules(this.selectedEnemyTeam, "the Opposing Force");
    if (!check2.valid) {
      alert(check2.error);
      return;
    }

    this.startEncounter({
      mode: "custom_encounter",
      team1: [...this.selectedTeam],
      team2: this.buildEnemyTeamForLaunch(),
    });
  }

  launchPvpMatchFromHub() {
    const check1 = this.validateTeamRules(this.selectedTeam, "Team 1");
    if (!check1.valid) {
      alert(check1.error);
      return;
    }
    const enemySquad =
      this.selectedEnemyTeam.length > 0
        ? this.buildEnemyTeamForLaunch()
        : [
            { characterId: "karnage_the_anarch", itemId: "executioner_lens" },
            { characterId: "byun", itemId: "kawabunga_coffee" },
            { characterId: "marius_the_gallant", itemId: "shield_of_the_captain" },
            { characterId: "solanar_the_gleaming", itemId: "fire_ruby" },
            { characterId: "the_calamitus", itemId: "death_sickle" },
          ].slice(0, Math.max(1, this.selectedTeam.length));

    this.startEncounter({
      mode: "squad_pvp",
      team1: [...this.selectedTeam],
      team2: enemySquad,
    });
  }

  startEncounter({ mode, team1, team2 }) {
    this.lastEncounterConfig = { mode, team1, team2 };
    this.engine = new BattleEngine({
      mode,
      seed: Date.now(),
      team1Config: team1,
      team2Config: team2,
    });

    this.switchView("battle");
    this.ensureValidSelection({ syncInspectorToActive: true });
    this.renderAll();

    if (this.network.role === "host") {
      this.network.broadcastBattleState(this.engine.serializeState());
    }
    this.checkIfAiShouldAct();
  }

  ensureValidSelection({ syncInspectorToActive = false } = {}) {
    if (!this.engine) return;
    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (activeUnit) {
      if (syncInspectorToActive) {
        this.selectedMoveId = null;
        this.selectedTargetId = null;
      } else if (this.selectedMoveId) {
        const moves = this.engine.getAvailableMovesForUnit(activeUnit);
        const currentMove = moves.find((m) => m.id === this.selectedMoveId && m.usable);
        if (!currentMove) {
          this.selectedMoveId = null;
          this.selectedTargetId = null;
        }
      }
      if (
        syncInspectorToActive ||
        !this.inspectedUnitId ||
        !this.engine.getUnitById(this.inspectedUnitId)
      ) {
        this.inspectedUnitId = activeUnit.id;
      }
    }
  }

  isUnitValidTargetForMove(activeUnit, move, candidateUnit) {
    if (!activeUnit || !move || !candidateUnit) return false;
    if (move.targetType === "self") {
      return candidateUnit.id === activeUnit.id && candidateUnit.currentHp > 0;
    }
    if (move.targetType === "all_allies") {
      return candidateUnit.teamId === activeUnit.teamId && candidateUnit.currentHp > 0;
    }
    if (move.targetType === "any_unit") {
      return true;
    }
    // Default ("single_enemy", "all_enemies", etc.): living enemy
    return candidateUnit.teamId !== activeUnit.teamId && candidateUnit.currentHp > 0;
  }

  canLocalUserControlUnit(unit) {
    if (!unit) return false;
    if (this.autoBossAi && unit.teamId === 2) return false;
    if (this.network.role === "host") return unit.teamId === 1;
    if (this.network.role === "client") return unit.teamId === 2;
    if (this.network.role === "offline") {
      return this.autoBossAi ? unit.teamId === 1 : true;
    }
    return true;
  }

  handlePlayerAction(action, { fromRemotePeer = false } = {}) {
    if (!this.engine || this.engine.winnerTeam || this._isProcessingAction) return;
    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit || activeUnit.id !== action.actorId) {
      console.warn("Mismatched action actor:", action.actorId, "vs active:", activeUnit?.id);
      this.ensureValidSelection({ syncInspectorToActive: true });
      this.renderAll();
      return;
    }

    if (this.network.role === "client" && !fromRemotePeer) {
      this.network.sendActionIntent(action);
      return;
    }

    this._isProcessingAction = true;
    try {
      const executed = this.engine.executeAction(action);
      if (executed) {
        this.ensureValidSelection({ syncInspectorToActive: true });
        this.renderAll();

        if (this.network.role === "host") {
          this.network.broadcastBattleState(this.engine.serializeState());
        }
        this.checkIfAiShouldAct();
      } else {
        console.warn("Battle action was not executed:", action);
        this.ensureValidSelection({ syncInspectorToActive: true });
        this.renderAll();
      }
    } catch (err) {
      console.error("Error executing battle action:", err);
      this.ensureValidSelection({ syncInspectorToActive: true });
      this.renderAll();
    } finally {
      this._isProcessingAction = false;
    }
  }

  checkIfAiShouldAct() {
    if (!this.engine || this.engine.winnerTeam || this.currentView !== "battle") return;
    if (this.network.role === "client") return;

    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit) return;

    const isP2PClientConnected =
      this.network.role === "host" &&
      (this.network.connections.some((c) => c.open) ||
        this.network.rawChannel?.readyState === "open");

    if (activeUnit.teamId === 2 && this.autoBossAi && !isP2PClientConnected) {
      setTimeout(() => {
        if (!this.engine || this.engine.activeUnitId !== activeUnit.id) return;
        const aiAction = this.engine.computeAiAction(activeUnit);
        if (aiAction) {
          this.handlePlayerAction(aiAction);
        }
      }, 600);
    }
  }

  bindStaticEvents() {
    // Hub Team Preset Buttons
    document.getElementById("preset-5-heroes-btn")?.addEventListener("click", () => {
      this.selectedTeam = [
        { characterId: "karnage_the_anarch", itemId: "anarch_sigil" },
        { characterId: "byun", itemId: "kawabunga_coffee" },
        { characterId: "marius_the_gallant", itemId: "shield_of_the_captain" },
        { characterId: "solanar_the_gleaming", itemId: "fire_ruby" },
        { characterId: "debt_bearer_alnith", itemId: "sharp_claws" },
      ];
      this.renderHub();
    });

    document.getElementById("preset-6-heroes-btn")?.addEventListener("click", () => {
      this.selectedTeam = [
        { characterId: "karnage_the_anarch", itemId: "anarch_sigil" },
        { characterId: "byun", itemId: "kawabunga_coffee" },
        { characterId: "marius_the_gallant", itemId: "shield_of_the_captain" },
        { characterId: "solanar_the_gleaming", itemId: "fire_ruby" },
        { characterId: "debt_bearer_alnith", itemId: "sharp_claws" },
        { characterId: "tethren_dragonsoul", itemId: "dragonstone" },
      ];
      this.renderHub();
    });

    document.getElementById("clear-team-btn")?.addEventListener("click", () => {
      this.selectedTeam = [];
      this.renderHub();
    });

    // Hub Opposing Force Preset Buttons
    document.getElementById("enemy-preset-champions-btn")?.addEventListener("click", () => {
      this.selectedEnemyTeam = [
        { characterId: "john_117", itemId: "executioner_lens" },
        { characterId: "fred_104", itemId: "shield_of_the_captain" },
        { characterId: "kelly_087", itemId: "kawabunga_coffee" },
        { characterId: "linda_034", itemId: "sharp_claws" },
        { characterId: "the_calamitus", itemId: "death_sickle" },
      ];
      this.renderHub();
    });

    document.getElementById("enemy-preset-bosses-btn")?.addEventListener("click", () => {
      this.selectedEnemyTeam = [
        { characterId: "antikhonor_broken_god", itemId: "none" },
        { characterId: "theridine_great_septimus", itemId: "none" },
        { characterId: "ternax_hellfire", itemId: "none" },
      ];
      this.renderHub();
    });

    document.getElementById("clear-enemy-team-btn")?.addEventListener("click", () => {
      this.selectedEnemyTeam = [];
      this.renderHub();
    });

    // Launch Battle Buttons from Hub
    document.getElementById("launch-boss-raid-btn")?.addEventListener("click", () => {
      this.launchBossRaidFromHub();
    });

    document.getElementById("launch-pvp-match-btn")?.addEventListener("click", () => {
      this.launchPvpMatchFromHub();
    });

    document.getElementById("return-hub-btn")?.addEventListener("click", () => {
      this.switchView("hub");
    });

    document.getElementById("restart-battle-btn")?.addEventListener("click", () => {
      if (this.lastEncounterConfig) {
        this.startEncounter(this.lastEncounterConfig);
      }
    });

    const aiToggle = document.getElementById("toggle-ai-btn");
    if (aiToggle) {
      aiToggle.addEventListener("click", () => {
        this.autoBossAi = !this.autoBossAi;
        aiToggle.textContent = `Enemy AI: ${this.autoBossAi ? "ON" : "MANUAL"}`;
        aiToggle.classList.toggle("active", this.autoBossAi);
        if (this.currentView === "battle") {
          this.renderAll();
          this.checkIfAiShouldAct();
        }
      });
    }

    document.getElementById("open-webrtc-btn")?.addEventListener("click", () => {
      document.getElementById("webrtc-modal")?.classList.remove("hidden");
    });
    document.getElementById("hub-open-webrtc-btn")?.addEventListener("click", () => {
      document.getElementById("webrtc-modal")?.classList.remove("hidden");
    });
    document.getElementById("close-webrtc-btn")?.addEventListener("click", () => {
      document.getElementById("webrtc-modal")?.classList.add("hidden");
    });
    document.getElementById("open-codex-btn")?.addEventListener("click", () => {
      document.getElementById("codex-modal")?.classList.remove("hidden");
    });
    document.getElementById("close-codex-btn")?.addEventListener("click", () => {
      document.getElementById("codex-modal")?.classList.add("hidden");
    });

    document.getElementById("host-room-btn")?.addEventListener("click", () => {
      const codeInput = document.getElementById("room-code-input");
      this.network.hostRoomWithCode(codeInput?.value || "");
    });
    document.getElementById("join-room-btn")?.addEventListener("click", () => {
      const codeInput = document.getElementById("room-code-input");
      if (codeInput?.value) {
        this.network.joinRoomWithCode(codeInput.value);
      }
    });

    document.getElementById("create-sdp-offer-btn")?.addEventListener("click", async () => {
      const out = document.getElementById("sdp-token-box");
      if (out) {
        out.value = "Generating ICE candidates & SDP offer...";
        out.value = await this.network.createManualOffer();
      }
    });
    document.getElementById("accept-sdp-offer-btn")?.addEventListener("click", async () => {
      const out = document.getElementById("sdp-token-box");
      if (out && out.value.trim()) {
        out.value = await this.network.acceptManualOfferAndCreateAnswer(out.value);
      }
    });
    document.getElementById("complete-sdp-btn")?.addEventListener("click", async () => {
      const out = document.getElementById("sdp-token-box");
      if (out && out.value.trim()) {
        await this.network.completeManualHandshake(out.value);
      }
    });
  }

  updateNetworkStatusUI(text, state) {
    const badge = document.getElementById("network-status-badge");
    const modalStatus = document.getElementById("webrtc-modal-status");
    if (badge) {
      badge.textContent = `NET: ${text}`;
      badge.dataset.state = state;
    }
    if (modalStatus) {
      modalStatus.textContent = text;
    }
  }

  // =========================================================================
  // BATTLE ARENA RENDERING (EMOJI-FREE)
  // =========================================================================
  renderAll() {
    if (!this.engine || this.currentView !== "battle") return;
    this.renderTurnOrderBar();
    this.renderTeamsArena();
    this.renderActionCommandDeck();
    this.renderUnitInspector();
    this.renderCombatLogs();
  }

  renderTurnOrderBar() {
    const container = document.getElementById("turn-order-ribbon");
    if (!container) return;

    const combatants = this.engine.units
      .filter((u) => u.currentHp > 0 && !u.isActionlessTotem)
      .sort((a, b) => {
        if (a.id === this.engine.activeUnitId) return -1;
        if (b.id === this.engine.activeUnitId) return 1;
        return b.turnMeter - a.turnMeter;
      });

    container.innerHTML = combatants
      .map((u) => {
        const isActive = u.id === this.engine.activeUnitId;
        const tmPct = isActive
          ? 100
          : Math.min(100, Math.round((u.turnMeter / 1000) * 100));
        const spd = this.engine.getEffectiveStats(u).spd;
        return `
          <div class="tm-chip team-${u.teamId} ${isActive ? "active-turn" : ""}" data-unit-id="${u.id}">
            <span class="unit-code-badge small">${u.avatar}</span>
            <div class="tm-meta">
              <div class="tm-name">${u.name.split(",")[0]}</div>
              <div class="tm-bar-wrap">
                <div class="tm-bar-fill" style="width:${tmPct}%"></div>
              </div>
            </div>
            <span class="tm-spd">${isActive ? "NOW" : `${tmPct}% (${spd} SPD)`}</span>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".tm-chip").forEach((el) => {
      el.addEventListener("click", () => {
        this.inspectedUnitId = el.dataset.unitId;
        this.renderUnitInspector();
      });
    });
  }

  renderTeamsArena() {
    const team1El = document.getElementById("team-1-container");
    const team2El = document.getElementById("team-2-container");
    const team1ShieldEl = document.getElementById("team-1-communal-shield");
    const team2ShieldEl = document.getElementById("team-2-communal-shield");
    if (!team1El || !team2El) return;

    if (team1ShieldEl) {
      const s1 = this.engine.communalShields?.[1] || 0;
      team1ShieldEl.innerHTML =
        s1 > 0 ? `<span class="communal-shield-pill">Communal Shield: ${s1} HP</span>` : "";
    }
    if (team2ShieldEl) {
      const s2 = this.engine.communalShields?.[2] || 0;
      team2ShieldEl.innerHTML =
        s2 > 0 ? `<span class="communal-shield-pill">Communal Shield: ${s2} HP</span>` : "";
    }

    const team1Units = this.engine.units.filter((u) => u.teamId === 1);
    const team2Units = this.engine.units.filter((u) => u.teamId === 2);

    team1El.innerHTML = team1Units.map((u) => this.renderUnitCardHTML(u)).join("");
    team2El.innerHTML = team2Units.map((u) => this.renderUnitCardHTML(u)).join("");

    document.querySelectorAll(".unit-card").forEach((card) => {
      card.addEventListener("click", () => {
        const uid = card.dataset.unitId;
        const clickedUnit = this.engine.getUnitById(uid);
        const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);

        this.inspectedUnitId = uid;

        if (clickedUnit && activeUnit && this.selectedMoveId && this.canLocalUserControlUnit(activeUnit)) {
          const moves = this.engine.getAvailableMovesForUnit(activeUnit);
          const selectedMove = moves.find((m) => m.id === this.selectedMoveId && m.usable);
          if (selectedMove && this.isUnitValidTargetForMove(activeUnit, selectedMove, clickedUnit)) {
            this.selectedTargetId = uid;
            const moveIdToCast = this.selectedMoveId;
            this.selectedMoveId = null;
            this.handlePlayerAction({
              actorId: activeUnit.id,
              moveId: moveIdToCast,
              targetId: uid,
            });
            return;
          }
        }

        this.renderAll();
      });
    });
  }

  renderBossMechanicCounters(unit) {
    const badges = [];
    const c = unit.customCounters || {};

    if (unit.templateId === "ouroboros_the_swarm") {
      badges.push(
        `<span class="mechanic-badge">Evolution: ${c.evolutionCounter ?? 8}/8</span>`
      );
    }
    if (unit.templateId === "first_genius_zander") {
      if (unit.form === "base") {
        badges.push(
          `<span class="mechanic-badge">Transmutation: ${c.transmutation ?? 0}/600</span>`
        );
      } else {
        badges.push(
          `<span class="mechanic-badge">Termination: ${c.termination ?? 8}/8 (DMG Taken: ${c.evolutionDamageTaken ?? 0})</span>`
        );
      }
    }
    if (unit.templateId === "theridine_great_septimus") {
      badges.push(
        `<span class="mechanic-badge">Sacred Bars: ${c.hpBarsRemaining ?? 16}/16</span>`
      );
      if ((c.chargingBarsRemaining || 0) > 0) {
        badges.push(
          `<span class="mechanic-badge danger">Charging Bars: ${c.chargingBarsRemaining}/7 (${c.chargingReactionsLeft} turns left)</span>`
        );
      }
    }
    if (unit.templateId === "antikhonor_broken_god") {
      badges.push(
        `<span class="mechanic-badge">Skills Used: ${unit.skillsUsedCount || 0}/3</span>`
      );
    }
    if (unit.templateId === "predator") {
      const evadePct = Math.round(this.engine.getUnitEvasionChance(unit) * 100);
      badges.push(`<span class="mechanic-badge">Evasion: ${evadePct}%</span>`);
    }
    if (unit.templateId === "solanar_the_gleaming") {
      if (c.scholarOfSunRevived) {
        badges.push(`<span class="mechanic-badge">Scholar of Sun: Revived</span>`);
      } else if (unit.currentHp <= 0) {
        badges.push(
          `<span class="mechanic-badge danger">Scholar of Sun: Dormant (Revives on Last Ally Death)</span>`
        );
      } else {
        badges.push(
          `<span class="mechanic-badge">Scholar of Sun: Ready (75% Revive)</span>`
        );
      }
    }
    if (unit.templateId === "debt_bearer_alnith") {
      const totalDue = this.engine.getTotalEnemyBloodDue(unit);
      badges.push(
        `<span class="mechanic-badge">Enemy Blood Due: ${totalDue}/15</span>`
      );
    }
    if (unit.forcedNextSkillId) {
      const nextSk = Registry.getSkill(unit.forcedNextSkillId);
      badges.push(
        `<span class="mechanic-badge danger">Next: ${nextSk?.name || unit.forcedNextSkillId}</span>`
      );
    }
    if ((unit.shieldHp || 0) > 0) {
      badges.push(`<span class="mechanic-badge shield-badge">Shield: ${unit.shieldHp}</span>`);
    }
    if ((unit.magmaShieldHp || 0) > 0) {
      badges.push(`<span class="mechanic-badge magma-badge">Magma Shield: ${unit.magmaShieldHp}</span>`);
    }
    return badges.join("");
  }

  renderUnitCardHTML(unit) {
    const isActive = unit.id === this.engine.activeUnitId;
    const isInspected = unit.id === this.inspectedUnitId;
    const isDead = unit.currentHp <= 0;

    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    let isValidTarget = false;
    if (activeUnit && this.selectedMoveId && this.canLocalUserControlUnit(activeUnit)) {
      const moves = this.engine.getAvailableMovesForUnit(activeUnit);
      const selectedMove = moves.find((m) => m.id === this.selectedMoveId && m.usable);
      if (selectedMove) {
        isValidTarget = this.isUnitValidTargetForMove(activeUnit, selectedMove, unit);
      }
    }
    const isTarget = isValidTarget || unit.id === this.selectedTargetId;

    const shieldHp = Math.max(0, unit.shieldHp || 0);
    const magmaHp = Math.max(0, unit.magmaShieldHp || 0);
    const destroyedPctRaw = Math.max(0, unit.destroyedHpPct || 0);
    const destroyedHp = (destroyedPctRaw / 100) * (unit.baseMaxHp || 1);
    const totalBarPool = Math.max(
      unit.baseMaxHp || 1,
      Math.max(0, unit.currentHp) + shieldHp + magmaHp + destroyedHp
    );

    const currentHpPct = Math.max(0, (unit.currentHp / totalBarPool) * 100);
    const shieldPct = (shieldHp / totalBarPool) * 100;
    const magmaPct = (magmaHp / totalBarPool) * 100;
    const destroyedPct = (destroyedHp / totalBarPool) * 100;
    const energyPct =
      unit.maxEnergy > 0 ? (unit.currentEnergy / unit.maxEnergy) * 100 : 0;
    const tmPct = Math.min(100, Math.round((unit.turnMeter / 1000) * 100));
    const effStats = this.engine.getEffectiveStats(unit);

    const statusBadges = unit.statuses
      .map((st) => {
        const stackLabel = st.stacks > 1 ? `x${st.stacks}` : "";
        const durLabel = st.duration !== null ? `${st.duration}T` : "INF";
        const lockLabel = st.isProtected ? " [P]" : "";
        let valLabel = "";
        if (st.id === "shield" && (unit.shieldHp || 0) > 0) {
          valLabel = ` (${unit.shieldHp})`;
        } else if (st.id === "magma_shield" && (unit.magmaShieldHp || 0) > 0) {
          valLabel = ` (${unit.magmaShieldHp})`;
        }
        return `
          <span class="status-pill ${st.category}" title="${st.name}${valLabel} (${stackLabel} ${durLabel})">
            [${st.icon}] ${st.name}${valLabel} ${stackLabel ? `<b>${stackLabel}</b>` : ""} <small>${durLabel}${lockLabel}</small>
          </span>
        `;
      })
      .join("");

    const stanceBadge =
      unit.stance === "rest"
        ? `<span class="stance-tag rest">REST (50% DEF)</span>`
        : unit.stance === "wait"
        ? `<span class="stance-tag wait">WAIT (Full DEF)</span>`
        : "";

    const formBadge =
      Object.keys(unit.forms || {}).length > 1
        ? `<span class="form-tag">${unit.forms[unit.form]?.name || unit.form}</span>`
        : "";

    const mechanicBadges = this.renderBossMechanicCounters(unit);

    const isSeptimus = unit.templateId === "theridine_great_septimus";
    let septimusBarsHtml = "";
    if (isSeptimus) {
      const c = unit.customCounters || {};
      const chargingBarsRemaining = c.chargingBarsRemaining || 0;
      const maxChargingBars = c.maxChargingBars || 7;
      const chargingBarMaxHp = c.chargingBarMaxHp || unit.effectiveMaxHp || 100;
      const chargingCurrentHp = Math.max(0, c.chargingCurrentHp || 0);

      let chargingBlockHtml = "";
      if (chargingBarsRemaining > 0) {
        const chargingSegments = [];
        for (let i = 1; i <= maxChargingBars; i += 1) {
          let fillPct = 0;
          if (i < chargingBarsRemaining) {
            fillPct = 100;
          } else if (i === chargingBarsRemaining) {
            fillPct = Math.max(0, Math.min(100, (chargingCurrentHp / chargingBarMaxHp) * 100));
          }
          chargingSegments.push(`
            <div class="septimus-hp-segment charging" title="Charging Bar ${i}/${maxChargingBars}">
              <div class="septimus-segment-fill charging" style="width:${fillPct.toFixed(1)}%"></div>
            </div>
          `);
        }
        chargingBlockHtml = `
          <div class="bar-group septimus-charging-group">
            <div class="bar-label">
              <span class="charging-bar-title">Charging HP (Bar ${chargingBarsRemaining}/${maxChargingBars})</span>
              <span class="hp-values-wrap">
                <strong>${chargingCurrentHp}</strong> / ${chargingBarMaxHp} per bar (${(chargingBarsRemaining - 1) * chargingBarMaxHp + chargingCurrentHp} Charging HP)
              </span>
            </div>
            <div class="hp-bar-track septimus-charging-track">
              ${chargingSegments.join("")}
            </div>
          </div>
        `;
      }

      const hpBarsRemaining = c.hpBarsRemaining ?? 16;
      const totalSegments = 16;
      const barMaxHp = unit.effectiveMaxHp || 100;
      const hpSegments = [];
      for (let i = 1; i <= totalSegments; i += 1) {
        let fillPct = 0;
        if (i < hpBarsRemaining) {
          fillPct = 100;
        } else if (i === hpBarsRemaining && unit.currentHp > 0) {
          fillPct = Math.max(0, Math.min(100, (unit.currentHp / barMaxHp) * 100));
        }
        hpSegments.push(`
          <div class="septimus-hp-segment" title="Sacred HP Bar ${i}/${totalSegments}">
            <div class="septimus-segment-fill" style="width:${fillPct.toFixed(1)}%"></div>
          </div>
        `);
      }

      septimusBarsHtml = `
        ${chargingBlockHtml}
        <div class="bar-group">
          <div class="bar-label">
            <span>Sacred HP (Bar ${hpBarsRemaining}/16 • 16 Segments)</span>
            <span class="hp-values-wrap">
              <strong>${unit.currentHp}</strong> / ${barMaxHp}
              ${(unit.shieldHp || 0) > 0 ? `<span class="hp-shield-val">(+${unit.shieldHp} Shield)</span>` : ""}
              ${(unit.magmaShieldHp || 0) > 0 ? `<span class="hp-magma-val">(+${unit.magmaShieldHp} Magma)</span>` : ""}
            </span>
          </div>
          <div class="hp-bar-track septimus-segmented-track">
            ${hpSegments.join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="unit-card ${unit.isBoss ? "boss-card" : ""} ${unit.isSummon ? "summon-card" : ""} ${isActive ? "is-active" : ""} ${isTarget ? "is-target" : ""} ${isValidTarget ? "is-valid-target" : ""} ${isInspected ? "is-inspected" : ""} ${isDead ? "is-dead" : ""}" data-unit-id="${unit.id}">
        <div class="unit-card-header">
          <div class="unit-avatar-badge">
            <span class="unit-code-badge ${unit.isBoss ? "boss" : ""}">${unit.avatar}</span>
            ${isActive ? `<span class="turn-indicator">ACTING</span>` : ""}
            ${isValidTarget && !isDead ? `<span class="target-reticle">CLICK TO TARGET</span>` : ""}
          </div>
          <div class="unit-title-block">
            <div class="unit-name-row">
              <h4>${unit.name}</h4>
              ${formBadge}
              ${stanceBadge}
              ${mechanicBadges}
            </div>
            <div class="unit-sub-row">
              <span>${unit.types.join(" / ")}</span>
              <span>• ATK ${effStats.atk}</span>
              <span>• DEF ${effStats.def}%</span>
              <span>• SPD ${effStats.spd}</span>
              <span>• C.DMG ${effStats.critDmg}%</span>
            </div>
          </div>
        </div>

        ${
          isSeptimus
            ? septimusBarsHtml
            : `
        <div class="bar-group">
          <div class="bar-label">
            <span>HP</span>
            <span class="hp-values-wrap">
              <strong>${unit.currentHp}</strong> / ${unit.effectiveMaxHp}
              ${(unit.shieldHp || 0) > 0 ? `<span class="hp-shield-val">(+${unit.shieldHp} Shield)</span>` : ""}
              ${(unit.magmaShieldHp || 0) > 0 ? `<span class="hp-magma-val">(+${unit.magmaShieldHp} Magma)</span>` : ""}
              ${destroyedPctRaw > 0 ? `<small class="destroyed-label">(-${destroyedPctRaw}% Destroyed)</small>` : ""}
            </span>
          </div>
          <div class="hp-bar-track">
            <div class="hp-bar-fill" style="width:${currentHpPct.toFixed(2)}%"></div>
            ${shieldHp > 0 ? `<div class="hp-bar-shield" style="width:${shieldPct.toFixed(2)}%" title="Shield: ${shieldHp}"></div>` : ""}
            ${magmaHp > 0 ? `<div class="hp-bar-magma" style="width:${magmaPct.toFixed(2)}%" title="Magma Shield: ${magmaHp}"></div>` : ""}
            ${destroyedPctRaw > 0 ? `<div class="hp-bar-destroyed" style="width:${destroyedPct.toFixed(2)}%"></div>` : ""}
          </div>
        </div>
        `
        }

        ${
          !unit.isActionlessTotem
            ? `
          <div class="dual-bars">
            <div class="bar-group">
              <div class="bar-label"><span>Energy</span><span>${unit.currentEnergy}/${unit.maxEnergy}</span></div>
              <div class="energy-bar-track">
                <div class="energy-bar-fill" style="width:${energyPct}%"></div>
              </div>
            </div>
            <div class="bar-group">
              <div class="bar-label"><span>Turn Meter</span><span>${tmPct}%</span></div>
              <div class="tm-mini-track">
                <div class="tm-mini-fill" style="width:${tmPct}%"></div>
              </div>
            </div>
          </div>
        `
            : `<div class="totem-note">Tied Construct — Destroy to deal 5% MAX HP to Antikhonor (${unit.linkedTargetName} deals +100% DMG)</div>`
        }

        <div class="status-tray">
          ${statusBadges || `<span class="no-status">No active statuses</span>`}
        </div>
      </div>
    `;
  }

  renderActionCommandDeck() {
    const deckEl = document.getElementById("command-deck");
    const actorHeaderEl = document.getElementById("active-actor-banner");
    if (!deckEl || !actorHeaderEl) return;

    // Always clear previous turn's command buttons first so a stale move deck can never remain
    deckEl.innerHTML = "";

    if (this.engine.winnerTeam) {
      actorHeaderEl.innerHTML = `<div class="winner-banner">Battle Finished — ${
        this.engine.winnerTeam === 1 ? "Strike Force Triumphs" : "Opposing Force Triumphs"
      }</div>`;
      return;
    }

    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit) return;

    const moves = this.engine.getAvailableMovesForUnit(activeUnit);
    const selectedMove = moves.find((m) => m.id === this.selectedMoveId && m.usable);
    const canControl = this.canLocalUserControlUnit(activeUnit);
    const formName = activeUnit.forms?.[activeUnit.form]?.name || activeUnit.form;
    const lastSkillName = activeUnit.lastNonUniversalSkillId
      ? Registry.getSkill(activeUnit.lastNonUniversalSkillId)?.name
      : "None";

    actorHeaderEl.innerHTML = `
      <div class="actor-banner-left">
        <span class="unit-code-badge large">${activeUnit.avatar}</span>
        <div>
          <h3>${activeUnit.name}'s Turn <small>(${formName})</small></h3>
          <p>
            ${
              selectedMove
                ? `Selected Skill: <strong class="selected-skill-highlight">${selectedMove.name}</strong> — Click a highlighted target on the battlefield`
                : `Step 1: <strong>Select a skill below</strong>, then click a target on the battlefield`
            }
            • Skills Used: <strong>${activeUnit.skillsUsedCount || 0}</strong>
            • Last Skill: <strong>${lastSkillName}</strong>
          </p>
        </div>
      </div>
      <div class="actor-banner-right">
        ${
          canControl
            ? `<span class="your-move-pill">${selectedMove ? "Select Target" : "Select Skill"}</span>`
            : `<span class="waiting-turn-pill">${activeUnit.name} Acting...</span>`
        }
      </div>
    `;

    deckEl.dataset.activeActorId = activeUnit.id;

    if (!canControl) {
      deckEl.innerHTML = `
        <div class="waiting-turn-card">
          <div class="waiting-turn-title">${activeUnit.name} is taking action...</div>
          <div class="waiting-turn-sub">Opposing turn in progress. Commands will unlock when it is your move.</div>
        </div>
      `;
      return;
    }

    deckEl.innerHTML = moves
      .map((m) => {
        const disabledAttr = !m.usable || !canControl ? "disabled" : "";
        const universalClass = m.isUniversal ? "universal-move" : "character-move";
        const forcedClass = m.isForcedMove ? "forced-next-move" : "";
        const selectedClass = this.selectedMoveId === m.id ? "is-selected-move" : "";
        return `
          <button type="button" class="move-btn ${universalClass} ${forcedClass} ${selectedClass}" data-actor-id="${activeUnit.id}" data-move-id="${m.id}" ${disabledAttr}>
            <div class="move-btn-top">
              <span class="move-name">
                ${m.isForcedMove ? "[NEXT] " : ""}${m.name}
              </span>
              <span class="move-badges">
                ${m.element && m.element !== "None" ? `<span class="elem-tag">${m.element}${m.stab ? " STAB" : ""}</span>` : ""}
                <span class="cost-tag">EN ${m.energyCost || 0}</span>
              </span>
            </div>
            <div class="move-formula">${m.formulaText || m.category} ${m.accuracy ? `• ACC ${m.accuracy}%` : ""}</div>
            <div class="move-desc">${m.description}</div>
            ${
              this.selectedMoveId === m.id && m.usable
                ? `<div class="move-selected-prompt">SELECTED — Click a highlighted target on the battlefield</div>`
                : ""
            }
            ${
              m.isForcedMove && m.usable
                ? `<div class="move-queued-tag">REQUIRED FOLLOW-UP READY</div>`
                : ""
            }
            ${!m.usable ? `<div class="move-lock-reason">[LOCKED] ${m.lockReason}</div>` : ""}
          </button>
        `;
      })
      .join("");

    deckEl.querySelectorAll(".move-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const moveId = btn.dataset.moveId;
        const moveObj = moves.find((m) => m.id === moveId && m.usable);
        if (!moveObj) return;

        // If already selected and the move is self/AoE/universal, clicking again casts it immediately as a convenience
        if (
          this.selectedMoveId === moveId &&
          (moveObj.isUniversal ||
            moveObj.targetType === "self" ||
            moveObj.targetType === "all_allies" ||
            moveObj.targetType === "all_enemies")
        ) {
          const defaultTargetId =
            moveObj.targetType === "all_enemies"
              ? this.engine.getLivingEnemiesOf(activeUnit)[0]?.id || activeUnit.id
              : activeUnit.id;
          this.selectedMoveId = null;
          this.handlePlayerAction({
            actorId: activeUnit.id,
            moveId,
            targetId: defaultTargetId,
          });
          return;
        }

        this.selectedMoveId = moveId;
        this.renderAll();
      });
    });
  }

  renderUnitInspector() {
    const panel = document.getElementById("inspector-content");
    if (!panel || !this.engine) return;

    const unit =
      this.engine.getUnitById(this.inspectedUnitId) ||
      this.engine.getUnitById(this.engine.activeUnitId);
    if (!unit) return;

    const eff = this.engine.getEffectiveStats(unit);
    const species = Registry.getSpecies(unit.speciesId);
    const item = Registry.getItem(unit.itemId);
    const abilities = (unit.abilityIds || [])
      .map((id) => Registry.getAbility(id))
      .filter(Boolean);
    const moves = this.engine.getAvailableMovesForUnit(unit);

    panel.innerHTML = `
      <div class="inspector-header">
        <span class="unit-code-badge">${unit.avatar}</span>
        <div>
          <h4>${unit.name}</h4>
          <small>${unit.title || unit.role} • ${unit.types.join(", ")}</small>
        </div>
      </div>

      <div class="inspector-stats-grid">
        <div><span>HP:</span> <strong>${unit.currentHp}/${unit.effectiveMaxHp}</strong></div>
        <div><span>Energy:</span> <strong>${unit.currentEnergy}/${unit.maxEnergy}</strong></div>
        <div><span>ATK:</span> <strong>${eff.atk}</strong></div>
        <div><span>DEF:</span> <strong>${eff.def}%</strong></div>
        <div><span>SPD:</span> <strong>${eff.spd}</strong></div>
        <div><span>C.DMG:</span> <strong>${eff.critDmg}%</strong></div>
        ${(unit.shieldHp || 0) > 0 ? `<div><span>Shield:</span> <strong style="color:var(--shield-cyan, #38bdf8)">${unit.shieldHp}</strong></div>` : ""}
        ${(unit.magmaShieldHp || 0) > 0 ? `<div><span>Magma:</span> <strong style="color:var(--magma-orange, #f97316)">${unit.magmaShieldHp}</strong></div>` : ""}
      </div>

      ${
        species
          ? `<div class="inspector-block">
              <h5>Species: ${species.name}</h5>
              <p>${species.description}</p>
            </div>`
          : ""
      }

      ${abilities
        .map(
          (ab) => `
        <div class="inspector-block">
          <h5>Ability: ${ab.name}</h5>
          <p>${ab.description}</p>
        </div>
      `
        )
        .join("")}

      ${
        item && item.id !== "none"
          ? `<div class="inspector-block">
              <h5>Item: ${item.name}</h5>
              <p>${item.description}</p>
            </div>`
          : ""
      }

      ${
        moves.length > 0
          ? `<div class="inspector-block">
              <h5>Active Form Skills (${unit.forms?.[unit.form]?.name || unit.form}):</h5>
              <div class="inspector-skill-list">
                ${moves
                  .filter((m) => !m.isUniversal)
                  .map(
                    (m) => `
                    <div class="inspector-skill-item ${m.usable ? "ready" : "locked"}">
                      <div class="inspector-skill-head">
                        <strong>${m.name}</strong>
                        <span>EN ${m.energyCost} • ${m.usable ? "READY" : `LOCKED: ${m.lockReason}`}</span>
                      </div>
                      <small>${m.formulaText || ""} — ${m.description}</small>
                    </div>
                  `
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
    `;
  }

  renderCombatLogs() {
    const logContainer = document.getElementById("combat-log-list");
    if (!logContainer || !this.engine) return;

    // Group logs by turn so the newest turn stays at the top of the panel,
    // while within each turn entries are ordered chronologically (Cause -> Effect).
    const turnGroups = [];
    let currentGroup = null;
    for (const entry of this.engine.logs) {
      if (!currentGroup || currentGroup.turn !== entry.turn) {
        currentGroup = { turn: entry.turn, entries: [] };
        turnGroups.push(currentGroup);
      }
      currentGroup.entries.push(entry);
    }

    const orderedEntries = turnGroups
      .reverse()
      .flatMap((group) => group.entries)
      .slice(0, 60);

    logContainer.innerHTML = orderedEntries
      .map(
        (entry) => `
        <div class="log-line ${entry.isSkill ? "log-skill-entry" : "log-effect-entry"} log-${entry.type}">
          <span class="log-turn">[T${entry.turn}]</span>
          <span>${entry.message}</span>
        </div>
      `
      )
      .join("");
  }

  renderCodexModal() {
    const container = document.getElementById("codex-body");
    if (!container) return;

    const chars = Registry.getAllCharacters();
    container.innerHTML = chars
      .map((c) => {
        const abilities = (c.abilityIds || [])
          .map((id) => Registry.getAbility(id))
          .filter(Boolean);
        const species = Registry.getSpecies(c.speciesId);
        return `
          <div class="codex-card">
            <h3>[${c.avatar}] ${c.name} <small>(${c.role})</small></h3>
            <p><strong>Base Stats:</strong> HP ${c.stats.hp} | Energy ${c.stats.energy} | SPD ${c.stats.spd} | DEF ${c.stats.def}% | ATK ${c.stats.atk}</p>
            <p><strong>Species (${species?.name || "None"}):</strong> ${species?.description || ""}</p>
            ${abilities
              .map((a) => `<p><strong>Ability — ${a.name}:</strong> ${a.description}</p>`)
              .join("")}
          </div>
        `;
      })
      .join("");
  }

  // =========================================================================
  // STATUS DEFINITIONS DRAWER (BUFFS, DEBUFFS, INSTANT EFFECTS)
  // =========================================================================
  initStatusDrawer() {
    const overlay = document.getElementById("status-drawer-overlay");
    const backdrop = document.getElementById("drawer-backdrop");
    const closeBtn = document.getElementById("close-drawer-btn");
    const buffsTabBtn = document.getElementById("side-tab-buffs-btn");
    const debuffsTabBtn = document.getElementById("side-tab-debuffs-btn");
    const searchInput = document.getElementById("drawer-search-input");
    const searchClear = document.getElementById("drawer-search-clear-btn");
    const categoryBtns = document.querySelectorAll(".drawer-category-btn");

    buffsTabBtn?.addEventListener("click", () => {
      this.toggleStatusDrawer("buff");
    });

    debuffsTabBtn?.addEventListener("click", () => {
      this.toggleStatusDrawer("debuff");
    });

    closeBtn?.addEventListener("click", () => {
      this.closeStatusDrawer();
    });

    backdrop?.addEventListener("click", () => {
      this.closeStatusDrawer();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay && !overlay.classList.contains("hidden")) {
        this.closeStatusDrawer();
      }
    });

    categoryBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        this.statusDrawerFilter = filter;
        categoryBtns.forEach((b) => b.classList.toggle("active", b === btn));
        this.renderStatusDrawer();
      });
    });

    searchInput?.addEventListener("input", (e) => {
      this.statusDrawerSearch = e.target.value.trim().toLowerCase();
      searchClear?.classList.toggle("hidden", !this.statusDrawerSearch);
      this.renderStatusDrawer();
    });

    searchClear?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      this.statusDrawerSearch = "";
      searchClear.classList.add("hidden");
      this.renderStatusDrawer();
    });

    this.renderStatusDrawer();
  }

  openStatusDrawer(filter = null) {
    const overlay = document.getElementById("status-drawer-overlay");
    if (!overlay) return;

    if (filter) {
      this.statusDrawerFilter = filter;
      const categoryBtns = document.querySelectorAll(".drawer-category-btn");
      categoryBtns.forEach((b) => b.classList.toggle("active", b.dataset.filter === filter));
    }

    overlay.classList.remove("hidden");
    this.renderStatusDrawer();
  }

  closeStatusDrawer() {
    const overlay = document.getElementById("status-drawer-overlay");
    overlay?.classList.add("hidden");
  }

  toggleStatusDrawer(filter) {
    const overlay = document.getElementById("status-drawer-overlay");
    if (!overlay) return;

    const isCurrentlyOpen = !overlay.classList.contains("hidden");
    if (isCurrentlyOpen && this.statusDrawerFilter === filter) {
      this.closeStatusDrawer();
    } else {
      this.openStatusDrawer(filter);
    }
  }

  renderStatusDrawer() {
    const cardList = document.getElementById("drawer-card-list");
    if (!cardList) return;

    const statuses = Registry.getAllStatuses ? Registry.getAllStatuses() : [];
    const instantEffects = Registry.getAllInstantEffects ? Registry.getAllInstantEffects() : [];

    // Update tallies
    const buffCount = statuses.filter((s) => s.category === "buff" || s.category === "special").length;
    const debuffCount = statuses.filter((s) => s.category === "debuff").length;
    const instantCount = instantEffects.length;
    const allCount = statuses.length + instantCount;

    const countAllEl = document.getElementById("count-all");
    const countBuffsEl = document.getElementById("count-buffs");
    const countDebuffsEl = document.getElementById("count-debuffs");
    const countInstantEl = document.getElementById("count-instant");

    if (countAllEl) countAllEl.textContent = allCount;
    if (countBuffsEl) countBuffsEl.textContent = buffCount;
    if (countDebuffsEl) countDebuffsEl.textContent = debuffCount;
    if (countInstantEl) countInstantEl.textContent = instantCount;

    // Filter items
    let items = [];
    if (this.statusDrawerFilter === "buff") {
      items = statuses.filter((s) => s.category === "buff" || s.category === "special");
    } else if (this.statusDrawerFilter === "debuff") {
      items = statuses.filter((s) => s.category === "debuff");
    } else if (this.statusDrawerFilter === "instant") {
      items = instantEffects;
    } else {
      items = [...statuses, ...instantEffects];
    }

    // Search query filter
    const query = this.statusDrawerSearch;
    if (query) {
      items = items.filter((item) => {
        const nameMatch = item.name?.toLowerCase().includes(query);
        const iconMatch = item.icon?.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        const summaryMatch = item.summary?.toLowerCase().includes(query);
        const tagsMatch = item.tags?.some((t) => t.toLowerCase().includes(query));
        return nameMatch || iconMatch || descMatch || summaryMatch || tagsMatch;
      });
    }

    if (items.length === 0) {
      cardList.innerHTML = `
        <div class="drawer-empty-msg">
          No matching definitions found for "${this.statusDrawerSearch}".
        </div>
      `;
      return;
    }

    cardList.innerHTML = items
      .map((item) => {
        const isInstant = item.category === "instant";
        const catClass = `cat-${item.category || "debuff"}`;
        const badgeClass = `badge-${item.category || "debuff"}`;
        const catLabel = isInstant ? "Instant Effect" : (item.category || "Debuff").toUpperCase();

        if (isInstant) {
          const tagsHtml = (item.tags || [])
            .map((t) => `<span class="def-pill">${t}</span>`)
            .join("");
          return `
            <article class="definition-card ${catClass}">
              <div class="def-card-top">
                <div class="def-title-wrap">
                  <span class="def-icon-tag">[${item.icon || "FX"}]</span>
                  <span class="def-name">${item.name}</span>
                </div>
                <span class="def-cat-badge ${badgeClass}">${catLabel}</span>
              </div>
              ${item.summary ? `<div class="def-summary">${item.summary}</div>` : ""}
              <p class="def-desc">${item.description}</p>
              ${tagsHtml ? `<div class="def-tags-row">${tagsHtml}</div>` : ""}
            </article>
          `;
        }

        // Standard Status Effect
        const flagsList = [];
        if (item.flags?.skipTurn) flagsList.push("Skips Turn");
        if (item.flags?.blockPassives) flagsList.push("Blocks Passives");
        if (item.flags?.sealItems) flagsList.push("Seals Items & Meter");
        if (item.flags?.blockRevive) flagsList.push("Blocks Revives");
        if (item.flags?.removeOnDamage) flagsList.push("Breaks On Direct Damage");
        if (item.isProtectedByDefault) flagsList.push("Protected / Irremovable");

        if (item.statModifiers) {
          const m = item.statModifiers;
          if (m.defPercent != null) flagsList.push(`DEF ${m.defPercent > 0 ? "+" : ""}${m.defPercent}%`);
          if (m.atkPercent != null) flagsList.push(`ATK ${m.atkPercent > 0 ? "+" : ""}${m.atkPercent}%`);
          if (m.spdPercent != null) flagsList.push(`SPD ${m.spdPercent > 0 ? "+" : ""}${m.spdPercent}%`);
          if (m.critRateBuff != null) flagsList.push(`Crit Rate +${m.critRateBuff}%`);
          if (m.critDmgBuff != null) flagsList.push(`Crit DMG +${m.critDmgBuff}%`);
          if (m.incomingDamageMultiplier != null) flagsList.push(`DMG Taken x${m.incomingDamageMultiplier}`);
          if (m.blockDamage) flagsList.push("Damage Immune");
          if (m.unkillable) flagsList.push("Cannot Drop Below 1 HP");
          if (m.taunt) flagsList.push("Forces Focus (Taunt)");
          if (m.counterattack) flagsList.push("Retaliates When Hit");
          if (m.reflectDamagePercent) flagsList.push(`Reflects ${m.reflectDamagePercent}% DMG`);
        }

        const pillsHtml = flagsList.map((f) => `<span class="def-pill">${f}</span>`).join("");

        const metaBar = `
          <div class="def-meta-bar">
            <span class="def-meta-item">Stacking: <strong>${item.stackBehavior || "none"}</strong></span>
            <span class="def-meta-item">Max: <strong>${item.maxStacks || 1}</strong></span>
            <span class="def-meta-item">Ticks: <strong>${item.tickTiming || "N/A"}</strong></span>
          </div>
        `;

        return `
          <article class="definition-card ${catClass}">
            <div class="def-card-top">
              <div class="def-title-wrap">
                <span class="def-icon-tag">[${item.icon || "STATUS"}]</span>
                <span class="def-name">${item.name}</span>
              </div>
              <span class="def-cat-badge ${badgeClass}">${catLabel}</span>
            </div>
            ${metaBar}
            <p class="def-desc">${item.description}</p>
            ${pillsHtml ? `<div class="def-tags-row">${pillsHtml}</div>` : ""}
          </article>
        `;
      })
      .join("");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.gameApp = new GameApp();
});
