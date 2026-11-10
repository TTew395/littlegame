/**
 * WebRTC Peer-to-Peer Networking Manager for GitHub Pages
 *
 * Supports two zero-backend P2P connection modes:
 * 1. Room Code Signaling via PeerJS (Free public broker + Google STUN servers)
 * 2. Serverless Manual SDP Offer/Answer Copy-Paste (Works with zero external signaling servers)
 */

export class P2PNetworkManager {
  constructor({ onStatusChange, onPeerConnected, onBattleStateReceived, onActionSubmitted }) {
    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnected = onPeerConnected || (() => {});
    this.onBattleStateReceived = onBattleStateReceived || (() => {});
    this.onActionSubmitted = onActionSubmitted || (() => {});

    this.role = "offline"; // "offline" | "host" | "client"
    this.peer = null;
    this.connections = [];
    this.hostConnection = null;
    this.roomId = null;

    // Raw WebRTC fallback for manual copy-paste SDP signaling
    this.rawPc = null;
    this.rawChannel = null;
  }

  async ensurePeerJsLoaded() {
    if (window.Peer) return window.Peer;
    const mod = await import("https://esm.sh/peerjs@1.5.4");
    return mod.Peer || mod.default;
  }

  async hostRoomWithCode(customCode = "") {
    try {
      const PeerClass = await this.ensurePeerJsLoaded();
      this.disconnect();
      this.role = "host";
      const cleanId =
        customCode.trim() ||
        "ANARCH-" + Math.random().toString(36).substring(2, 6).toUpperCase();

      this.onStatusChange(`Creating P2P Room (${cleanId})...`, "connecting");
      this.peer = new PeerClass(cleanId, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      this.peer.on("open", (id) => {
        this.roomId = id;
        this.onStatusChange(`Hosting Room: ${id} (Waiting for peer...)`, "hosting");
      });

      this.peer.on("connection", (conn) => {
        this.connections.push(conn);
        conn.on("open", () => {
          this.onStatusChange(`Peer Connected (${conn.peer})! WebRTC Active.`, "connected");
          this.onPeerConnected({ role: "host", peerId: conn.peer });
        });
        conn.on("data", (data) => this.handleIncomingMessage(data));
        conn.on("close", () => {
          this.onStatusChange("Peer disconnected.", "disconnected");
        });
      });

      this.peer.on("error", (err) => {
        this.onStatusChange(`WebRTC Error: ${err.type || err.message}`, "error");
      });
    } catch (err) {
      this.onStatusChange(`Failed to load PeerJS: ${err.message}`, "error");
    }
  }

  async joinRoomWithCode(hostCode) {
    if (!hostCode || !hostCode.trim()) return;
    try {
      const PeerClass = await this.ensurePeerJsLoaded();
      this.disconnect();
      this.role = "client";
      const targetId = hostCode.trim().toUpperCase();

      this.onStatusChange(`Connecting to Room ${targetId}...`, "connecting");
      this.peer = new PeerClass({
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      this.peer.on("open", () => {
        const conn = this.peer.connect(targetId, { reliable: true });
        this.hostConnection = conn;

        conn.on("open", () => {
          this.roomId = targetId;
          this.onStatusChange(`Connected to Host (${targetId})!`, "connected");
          this.onPeerConnected({ role: "client", peerId: targetId });
        });

        conn.on("data", (data) => this.handleIncomingMessage(data));
        conn.on("close", () => {
          this.onStatusChange("Disconnected from Host.", "disconnected");
        });
      });

      this.peer.on("error", (err) => {
        this.onStatusChange(`Connection Error: ${err.type || err.message}`, "error");
      });
    } catch (err) {
      this.onStatusChange(`Failed to connect: ${err.message}`, "error");
    }
  }

  // =========================================================================
  // SERVERLESS COPY-PASTE SDP MODE (Zero External Broker Required)
  // =========================================================================
  async createManualOffer() {
    this.disconnect();
    this.role = "host";
    this.rawPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.rawChannel = this.rawPc.createDataChannel("battle-channel");
    this.bindRawDataChannel(this.rawChannel);

    const offer = await this.rawPc.createOffer();
    await this.rawPc.setLocalDescription(offer);
    await this.waitForIceGathering(this.rawPc);

    const token = btoa(JSON.stringify(this.rawPc.localDescription));
    this.onStatusChange("Offer generated. Send token to Player 2.", "hosting");
    return token;
  }

  async acceptManualOfferAndCreateAnswer(offerToken) {
    this.disconnect();
    this.role = "client";
    this.rawPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.rawPc.ondatachannel = (event) => {
      this.rawChannel = event.channel;
      this.bindRawDataChannel(this.rawChannel);
    };

    const offerDesc = JSON.parse(atob(offerToken.trim()));
    await this.rawPc.setRemoteDescription(offerDesc);
    const answer = await this.rawPc.createAnswer();
    await this.rawPc.setLocalDescription(answer);
    await this.waitForIceGathering(this.rawPc);

    const answerToken = btoa(JSON.stringify(this.rawPc.localDescription));
    this.onStatusChange("Answer generated. Send token back to Host.", "connecting");
    return answerToken;
  }

  async completeManualHandshake(answerToken) {
    if (!this.rawPc) return;
    const answerDesc = JSON.parse(atob(answerToken.trim()));
    await this.rawPc.setRemoteDescription(answerDesc);
  }

  bindRawDataChannel(channel) {
    channel.onopen = () => {
      this.onStatusChange("Direct WebRTC DataChannel Open!", "connected");
      this.onPeerConnected({ role: this.role, peerId: "Direct-P2P" });
    };
    channel.onmessage = (e) => {
      try {
        this.handleIncomingMessage(JSON.parse(e.data));
      } catch (err) {
        console.error("Failed to parse P2P message:", err);
      }
    };
    channel.onclose = () => {
      this.onStatusChange("WebRTC DataChannel closed.", "disconnected");
    };
  }

  waitForIceGathering(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      const checkState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", checkState);
      setTimeout(resolve, 2500);
    });
  }

  handleIncomingMessage(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "BATTLE_STATE_SYNC") {
      this.onBattleStateReceived(msg.payload);
    } else if (msg.type === "ACTION_INTENT" && this.role === "host") {
      this.onActionSubmitted(msg.payload);
    }
  }

  broadcastBattleState(serializedState) {
    if (this.role !== "host") return;
    const packet = { type: "BATTLE_STATE_SYNC", payload: serializedState };

    this.connections.forEach((conn) => {
      if (conn.open) conn.send(packet);
    });
    if (this.rawChannel && this.rawChannel.readyState === "open") {
      this.rawChannel.send(JSON.stringify(packet));
    }
  }

  sendActionIntent(action) {
    const packet = { type: "ACTION_INTENT", payload: action };
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(packet);
    } else if (this.rawChannel && this.rawChannel.readyState === "open") {
      this.rawChannel.send(JSON.stringify(packet));
    }
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.rawPc) {
      this.rawPc.close();
      this.rawPc = null;
    }
    this.connections = [];
    this.hostConnection = null;
    this.rawChannel = null;
    this.role = "offline";
  }
}
