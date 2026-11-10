/**
 * Main Application & UI Controller
 * Connects the Registry, BattleEngine, and P2PNetworkManager to the interactive UI:
 * - Preset Battle Modes (5-Hero Raid vs Antikhonor, 1v1 Duel, Custom Squad Builder)
 * - WebRTC Multiplayer Lobby (PeerJS Room Code + Zero-Server Copy-Paste SDP Handshake)
 * - Turn Order Ribbon, Destroyed Max HP Visualization, Status Stack Badges, Character Codex
 */

import { initializeGameContent } from "./data/index.js";
import { Registry } from "./engine/Registry.js";
import { BattleEngine } from "./engine/BattleEngine.js";
import { P2PNetworkManager } from "./network/P2PNetworkManager.js";

initializeGameContent();

class GameApp {
  constructor() {
    this.engine = null;
    this.selectedTargetId = null;
    this.inspectedUnitId = null;
    this.autoBossAi = true;
    this.battlePreset = "raid_5v1"; // "raid_5v1" | "duel_1v1" | "squad_pvp"

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
        this.ensureValidSelection();
        this.renderAll();
      },
      onActionSubmitted: (action) => {
        if (this.network.role === "host" && this.engine) {
          this.handlePlayerAction(action, { fromRemotePeer: true });
        }
      },
    });

    this.bindStaticEvents();
    this.startNewBattle(this.battlePreset);
    this.renderCodexModal();
  }

  getPresetTeams(preset) {
    if (preset === "duel_1v1") {
      return {
        mode: "duel_1v1",
        team1: [{ characterId: "karnage_the_anarch", itemId: "anarch_sigil" }],
        team2: [{ characterId: "antikhonor_broken_god", itemId: "none" }],
      };
    }
    if (preset === "squad_pvp") {
      return {
        mode: "squad_pvp",
        team1: [
          { characterId: "karnage_the_anarch", itemId: "anarch_sigil" },
          { characterId: "valkyria_chronos", itemId: "chronos_hourglass" },
          { characterId: "seraphina_dawn", itemId: "aegis_core" },
        ],
        team2: [
          { characterId: "karnage_the_anarch", itemId: "executioner_lens" },
          { characterId: "ignis_drake", itemId: "vampiric_chalice" },
          { characterId: "vexor_nightblade", itemId: "chronos_hourglass" },
        ],
      };
    }
    // Default: "raid_5v1" (5 Characters Recommended vs Antikhonor, Broken God)
    return {
      mode: "raid_5v1",
      team1: [
        { characterId: "karnage_the_anarch", itemId: "anarch_sigil" },
        { characterId: "valkyria_chronos", itemId: "chronos_hourglass" },
        { characterId: "seraphina_dawn", itemId: "aegis_core" },
        { characterId: "ignis_drake", itemId: "executioner_lens" },
        { characterId: "vexor_nightblade", itemId: "vampiric_chalice" },
      ],
      team2: [{ characterId: "antikhonor_broken_god", itemId: "none" }],
    };
  }

  startNewBattle(preset = this.battlePreset) {
    this.battlePreset = preset;
    const cfg = this.getPresetTeams(preset);
    this.engine = new BattleEngine({
      mode: cfg.mode,
      seed: Date.now(),
      team1Config: cfg.team1,
      team2Config: cfg.team2,
    });

    this.ensureValidSelection();
    this.renderAll();

    if (this.network.role === "host") {
      this.network.broadcastBattleState(this.engine.serializeState());
    }
    this.checkIfAiShouldAct();
  }

  ensureValidSelection() {
    if (!this.engine) return;
    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (activeUnit) {
      const enemies = this.engine.getLivingEnemiesOf(activeUnit);
      const currentTarget = this.engine.getUnitById(this.selectedTargetId);
      if (
        !currentTarget ||
        currentTarget.currentHp <= 0 ||
        currentTarget.teamId === activeUnit.teamId
      ) {
        this.selectedTargetId = enemies[0]?.id || null;
      }
      if (!this.inspectedUnitId || !this.engine.getUnitById(this.inspectedUnitId)) {
        this.inspectedUnitId = activeUnit.id;
      }
    }
  }

  canLocalUserControlUnit(unit) {
    if (!unit) return false;
    if (this.network.role === "offline") return true;
    if (this.network.role === "host") return unit.teamId === 1;
    if (this.network.role === "client") return unit.teamId === 2;
    return true;
  }

  handlePlayerAction(action, { fromRemotePeer = false } = {}) {
    if (!this.engine || this.engine.winnerTeam) return;
    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit || activeUnit.id !== action.actorId) return;

    // If connected as WebRTC Client, send intent to Host
    if (this.network.role === "client" && !fromRemotePeer) {
      this.network.sendActionIntent(action);
      return;
    }

    const executed = this.engine.executeAction(action);
    if (executed) {
      this.ensureValidSelection();
      this.renderAll();

      if (this.network.role === "host") {
        this.network.broadcastBattleState(this.engine.serializeState());
      }
      this.checkIfAiShouldAct();
    }
  }

  checkIfAiShouldAct() {
    if (!this.engine || this.engine.winnerTeam) return;
    if (this.network.role === "client") return; // Host runs AI

    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit) return;

    // Trigger AI if Team 2 is active and Auto-Boss AI is enabled (and no P2P client is controlling Team 2)
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
      }, 650);
    }
  }

  bindStaticEvents() {
    // Mode selector buttons
    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-preset]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.startNewBattle(btn.dataset.preset);
      });
    });

    // AI Toggle
    const aiToggle = document.getElementById("toggle-ai-btn");
    if (aiToggle) {
      aiToggle.addEventListener("click", () => {
        this.autoBossAi = !this.autoBossAi;
        aiToggle.textContent = `🤖 Enemy AI: ${this.autoBossAi ? "ON" : "MANUAL"}`;
        aiToggle.classList.toggle("active", this.autoBossAi);
        this.checkIfAiShouldAct();
      });
    }

    // Restart Battle
    document.getElementById("restart-battle-btn")?.addEventListener("click", () => {
      this.startNewBattle(this.battlePreset);
    });

    // Modals (WebRTC P2P Lobby & Character/Skill Codex)
    document.getElementById("open-webrtc-btn")?.addEventListener("click", () => {
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

    // PeerJS Room Code Buttons
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

    // Manual SDP Offer/Answer Copy-Paste Buttons
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
        const answer = await this.network.acceptManualOfferAndCreateAnswer(out.value);
        out.value = answer;
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
      badge.textContent = `📡 ${text}`;
      badge.dataset.state = state;
    }
    if (modalStatus) {
      modalStatus.textContent = text;
    }
  }

  renderAll() {
    if (!this.engine) return;
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
        const tmPct = isActive ? 100 : Math.min(100, Math.round((u.turnMeter / 1000) * 100));
        const spd = this.engine.getEffectiveStats(u).spd;
        return `
          <div class="tm-chip team-${u.teamId} ${isActive ? "active-turn" : ""}" data-unit-id="${u.id}">
            <span class="tm-avatar">${u.avatar}</span>
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
    if (!team1El || !team2El) return;

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
        if (
          clickedUnit &&
          activeUnit &&
          clickedUnit.teamId !== activeUnit.teamId &&
          clickedUnit.currentHp > 0
        ) {
          this.selectedTargetId = uid;
        }
        this.renderAll();
      });
    });
  }

  renderUnitCardHTML(unit) {
    const isActive = unit.id === this.engine.activeUnitId;
    const isTarget = unit.id === this.selectedTargetId;
    const isInspected = unit.id === this.inspectedUnitId;
    const isDead = unit.currentHp <= 0;

    const currentHpPct = Math.max(0, (unit.currentHp / unit.baseMaxHp) * 100);
    const destroyedPct = unit.destroyedHpPct || 0;
    const energyPct = unit.maxEnergy > 0 ? (unit.currentEnergy / unit.maxEnergy) * 100 : 0;
    const tmPct = Math.min(100, Math.round((unit.turnMeter / 1000) * 100));
    const effStats = this.engine.getEffectiveStats(unit);

    const statusBadges = unit.statuses
      .map((st) => {
        const stackLabel = st.stacks > 1 ? `x${st.stacks}` : "";
        const durLabel = st.duration !== null ? `${st.duration}T` : "∞";
        const lockIcon = st.isProtected ? "🔒" : "";
        return `
          <span class="status-pill ${st.category}" title="${st.name} (${stackLabel} ${durLabel})">
            ${st.icon} ${st.name} ${stackLabel ? `<b>${stackLabel}</b>` : ""} <small>${durLabel}${lockIcon}</small>
          </span>
        `;
      })
      .join("");

    const stanceBadge =
      unit.stance === "rest"
        ? `<span class="stance-tag rest">💤 REST (50% DEF)</span>`
        : unit.stance === "wait"
        ? `<span class="stance-tag wait">🛡️ WAIT (Full DEF)</span>`
        : "";

    const formBadge =
      Object.keys(unit.forms).length > 1
        ? `<span class="form-tag">${unit.forms[unit.form]?.name || unit.form}</span>`
        : "";

    return `
      <div class="unit-card ${unit.isBoss ? "boss-card" : ""} ${unit.isSummon ? "summon-card" : ""} ${isActive ? "is-active" : ""} ${isTarget ? "is-target" : ""} ${isInspected ? "is-inspected" : ""} ${isDead ? "is-dead" : ""}" data-unit-id="${unit.id}">
        <div class="unit-card-header">
          <div class="unit-avatar-badge">
            <span class="avatar-emoji">${unit.avatar}</span>
            ${isActive ? `<span class="turn-indicator">ACTING</span>` : ""}
            ${isTarget && !isDead ? `<span class="target-reticle">🎯 TARGET</span>` : ""}
          </div>
          <div class="unit-title-block">
            <div class="unit-name-row">
              <h4>${unit.name}</h4>
              ${formBadge}
              ${stanceBadge}
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

        <!-- HP Bar with Destroyed Max HP Visualization -->
        <div class="bar-group">
          <div class="bar-label">
            <span>HP</span>
            <span>
              ${unit.currentHp} / ${unit.effectiveMaxHp}
              ${destroyedPct > 0 ? `<small class="destroyed-label">(-${destroyedPct}% Destroyed)</small>` : ""}
            </span>
          </div>
          <div class="hp-bar-track">
            <div class="hp-bar-fill" style="width:${currentHpPct}%"></div>
            ${destroyedPct > 0 ? `<div class="hp-bar-destroyed" style="width:${destroyedPct}%"></div>` : ""}
          </div>
        </div>

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
            : `<div class="totem-note">🔗 Tied Construct — Destroy to deal 5% MAX HP to Antikhonor (${unit.linkedTargetName} deals +100% DMG)</div>`
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

    if (this.engine.winnerTeam) {
      actorHeaderEl.innerHTML = `<div class="winner-banner">🏆 Battle Finished — ${
        this.engine.winnerTeam === 1 ? "Heroes Triumph!" : "Antikhonor Reigns Supreme!"
      }</div>`;
      deckEl.innerHTML = "";
      return;
    }

    const activeUnit = this.engine.getUnitById(this.engine.activeUnitId);
    if (!activeUnit) return;

    const targetUnit = this.engine.getUnitById(this.selectedTargetId);
    const canControl = this.canLocalUserControlUnit(activeUnit);

    actorHeaderEl.innerHTML = `
      <div class="actor-banner-left">
        <span class="actor-big-avatar">${activeUnit.avatar}</span>
        <div>
          <h3>${activeUnit.name}'s Turn <small>(${activeUnit.forms[activeUnit.form]?.name || "Base"})</small></h3>
          <p>Selected Target: <strong>${targetUnit ? `${targetUnit.avatar} ${targetUnit.name} (${targetUnit.currentHp} HP)` : "Click an enemy unit"}</strong>
          ${activeUnit.templateId?.includes("antikhonor") ? ` • Skills Used: ${activeUnit.skillsUsedCount}` : ""}</p>
        </div>
      </div>
      <div class="actor-banner-right">
        <span class="your-move-pill">Your Move</span>
      </div>
    `;

    const moves = this.engine.getAvailableMovesForUnit(activeUnit);
    deckEl.innerHTML = moves
      .map((m) => {
        const disabledAttr = !m.usable || !canControl ? "disabled" : "";
        const universalClass = m.isUniversal ? "universal-move" : "character-move";
        return `
          <button class="move-btn ${universalClass}" data-move-id="${m.id}" ${disabledAttr}>
            <div class="move-btn-top">
              <span class="move-name">${m.name}</span>
              <span class="move-badges">
                ${m.element && m.element !== "None" ? `<span class="elem-tag">${m.element}${m.stab ? " ★STAB" : ""}</span>` : ""}
                <span class="cost-tag">⚡ ${m.energyCost || 0}</span>
              </span>
            </div>
            <div class="move-formula">${m.formulaText || m.category} ${m.accuracy ? `• 🎯 ${m.accuracy}%` : ""}</div>
            <div class="move-desc">${m.description}</div>
            ${!m.usable ? `<div class="move-lock-reason">🔒 ${m.lockReason}</div>` : ""}
          </button>
        `;
      })
      .join("");

    deckEl.querySelectorAll(".move-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const moveId = btn.dataset.moveId;
        this.handlePlayerAction({
          actorId: activeUnit.id,
          moveId,
          targetId: this.selectedTargetId,
        });
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

    panel.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-avatar">${unit.avatar}</span>
        <div>
          <h4>${unit.name}</h4>
          <small>Lv.${unit.level || 1} • ${unit.types.join(", ")} • ${species?.name || "Construct"}</small>
        </div>
      </div>

      <div class="inspector-stats-grid">
        <div><span>HP:</span> <strong>${unit.currentHp}/${unit.effectiveMaxHp}</strong></div>
        <div><span>Energy:</span> <strong>${unit.currentEnergy}/${unit.maxEnergy}</strong></div>
        <div><span>ATK:</span> <strong>${eff.atk}</strong></div>
        <div><span>DEF:</span> <strong>${eff.def}%</strong></div>
        <div><span>SPD:</span> <strong>${eff.spd}</strong></div>
        <div><span>C.DMG:</span> <strong>${eff.critDmg}%</strong></div>
      </div>

      ${
        species
          ? `<div class="inspector-block">
              <h5>🧬 Species: ${species.name}</h5>
              <p>${species.description}</p>
            </div>`
          : ""
      }

      ${abilities
        .map(
          (ab) => `
        <div class="inspector-block">
          <h5>✨ Ability: ${ab.name}</h5>
          <p>${ab.description}</p>
        </div>
      `
        )
        .join("")}

      ${
        item && item.id !== "none"
          ? `<div class="inspector-block">
              <h5>🔮 Item: ${item.name}</h5>
              <p>${item.description}</p>
            </div>`
          : ""
      }
    `;
  }

  renderCombatLogs() {
    const logContainer = document.getElementById("combat-log-list");
    if (!logContainer || !this.engine) return;

    logContainer.innerHTML = [...this.engine.logs]
      .reverse()
      .slice(0, 45)
      .map(
        (entry) => `
        <div class="log-line log-${entry.type}">
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
            <h3>${c.avatar} ${c.name} <small>(${c.role})</small></h3>
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
}

window.addEventListener("DOMContentLoaded", () => {
  window.gameApp = new GameApp();
});
