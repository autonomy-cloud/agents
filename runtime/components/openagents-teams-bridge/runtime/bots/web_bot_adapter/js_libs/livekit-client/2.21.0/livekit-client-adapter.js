(() => {
    if (window.LiveKitMediaStreamReceiver) {
      return;
    }
  
    const livekit = window.LivekitClient;
  
    if (!livekit?.Room || !livekit?.RoomEvent) {
      throw new Error(
        "LiveKit SDK is not loaded. Paste livekit-client.umd.min.js before this script."
      );
    }
  
    const { Room, RoomEvent } = livekit;
  
    const sendJson = (payload) => window.ws?.sendJson(payload);
  
    const describeParticipant = (participant) => ({
      identity: participant.identity,
      sid: participant.sid,
      name: participant.name,
      metadata: participant.metadata,
      attributes: participant.attributes ?? null,
      isLocal: participant.isLocal === true,
      publications: Array.from(participant.trackPublications.values()).map(
        (publication) => ({
          sid: publication.trackSid ?? publication.sid,
          kind: publication.kind,
          source: publication.source,
          muted: publication.isMuted,
          subscribed: publication.isSubscribed,
        })
      ),
    });
  
    /*
     * Wraps one LiveKit room connection and exposes the remote participant's
     * camera/voice and screen video as separate MediaStreams. Track arrival is observed through
     * an internal EventTarget so that waiting code can be written as a plain
     * async loop instead of subscription callbacks.
     */
    class LiveKitConnection {
      constructor(room, matchParticipantOnPublishOnBehalf) {
        this.room = room;
        this.stream = new MediaStream();
        this.screenShareStream = new MediaStream();
        this.closed = false;
        this.selectedParticipantIdentity = null;
        this.matchParticipantOnPublishOnBehalf = matchParticipantOnPublishOnBehalf;
  
        // Camera/microphone and presentation have independent output slots.
        this.outputTrackByKind = new Map();
        this.outputPublisherByKind = new Map();
        this.outputPublicationByKind = new Map();
  
        this.trackEvents = new EventTarget();
  
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) =>
          this.addRemoteTrack(track, publication, participant)
        );
  
        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) =>
          this.removeRemoteTrack(track, publication, participant)
        );
        room.on(RoomEvent.TrackUnpublished, (publication, participant) =>
          this.removeRemoteTrack(null, publication, participant)
        );
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          for (const [key, identity] of this.outputPublisherByKind) {
            if (identity !== participant.identity) continue;
            this.streamForKey(key).removeTrack(this.outputTrackByKind.get(key));
            this.outputTrackByKind.delete(key);
            this.outputPublisherByKind.delete(key);
            this.outputPublicationByKind.delete(key);
            this.disableOutput(key);
          }
          this.notifyTrackChange();
        });
  
      room.on(RoomEvent.TrackMuted, (publication, participant) =>
        this.handleRemoteMuteChange(publication, participant, true)
      );

      room.on(RoomEvent.TrackUnmuted, (publication, participant) =>
        this.handleRemoteMuteChange(publication, participant, false)
      );

      room.on(RoomEvent.ParticipantAttributesChanged, (_changes, participant) =>
        this.handleParticipantAttributesChanged(participant)
      );

      room.on(RoomEvent.Disconnected, () => {
        console.info("[LiveKit receiver] Room disconnected");
        this.closed = true;
        this.clearOutputs();
      });
    }

    streamForKey(key) {
      return key === "screen_share" ? this.screenShareStream : this.stream;
    }

    outputKey(publication, kind) {
      // System audio needs a separate mix policy; never replace agent speech.
      if (publication.source === "screen_share_audio") return null;
      if (publication.source === "screen_share") return kind === "video" ? "screen_share" : null;
      return kind;
    }

    disableOutput(key) {
      if (key === "audio") window.botOutputManager?.disableMic();
      if (key === "video") window.botOutputManager?.webcamVideoOutputStream.ensureInputOff();
      if (key === "screen_share") window.botOutputManager?.screenShareVideoOutputStream.ensureInputOff();
    }

    handleParticipantAttributesChanged(participant) {
      if (this.closed) return;
      if (!this.matchParticipantOnPublishOnBehalf) return;
      if (this.acceptsParticipant(participant)) {
        // The ownership attribute may arrive after TrackSubscribed. Recover
        // already-subscribed tracks without accepting any unrelated publisher.
        for (const publication of participant.trackPublications.values()) {
          if (publication.track) this.addRemoteTrack(publication.track, publication, participant);
        }
        return;
      }
      let changed = false;
      for (const [kind, publisher] of this.outputPublisherByKind) {
        if (publisher !== participant.identity) continue;
        this.streamForKey(kind).removeTrack(this.outputTrackByKind.get(kind));
        this.outputTrackByKind.delete(kind);
        this.outputPublisherByKind.delete(kind);
        this.outputPublicationByKind.delete(kind);
        this.disableOutput(kind);
        changed = true;
      }
      if (changed) this.notifyTrackChange();
    }

    /*
     * The participant's audio reaches the meeting through the bot's
     * microphone, so their mute state has to be mirrored onto it.
     */
    handleRemoteMuteChange(publication, participant, muted) {
      if (this.closed) return;
      if (this.outputKey(publication, publication.kind) === "screen_share") {
        const track = publication.track?.mediaStreamTrack;
        if (!track || this.outputTrackByKind.get("screen_share") !== track ||
            this.outputPublisherByKind.get("screen_share") !== participant.identity) return;
        if (muted) {
          this.screenShareStream.removeTrack(track);
          this.disableOutput("screen_share");
        } else if (this.acceptsParticipant(participant)) {
          this.screenShareStream.addTrack(track);
        }
        this.notifyTrackChange();
        return;
      }
      if (this.closed || this.outputKey(publication, publication.kind) !== "audio" || !this.acceptsParticipant(participant)) {
        return;
      }

      if (muted) {
        window.botOutputManager?.disableMic();
      } else {
        window.botOutputManager?.ensureMicOn();
      }
    }
  
      /*
       * A LiveKit agent publishing for someone else carries that person's
       * identity in "lk.publish_on_behalf" rather than in its own identity,
       * so which field identifies the participant depends on the room setup.
       */
      participantMatchKey(participant) {
        if (this.matchParticipantOnPublishOnBehalf) {
          return participant.attributes?.["lk.publish_on_behalf"] ?? null;
        }

        return participant.identity ?? null;
      }

      acceptsParticipant(participant) {
        const matchKey = this.participantMatchKey(participant);

        if (matchKey === null) {
          return false;
        }

        // When no identity was requested, latch onto the first publisher seen.
        if (this.selectedParticipantIdentity === null) {
          this.selectedParticipantIdentity = matchKey;
        }

        return matchKey === this.selectedParticipantIdentity;
      }
  
      addRemoteTrack(remoteTrack, publication, participant) {
        if (this.closed) return;
        const mediaTrack = remoteTrack.mediaStreamTrack;
        const key = this.outputKey(publication, mediaTrack?.kind);
  
        const isUsableKind =
          mediaTrack?.kind === "audio" || mediaTrack?.kind === "video";
  
        if (!isUsableKind || !key || !this.acceptsParticipant(participant)) {
          sendJson({
            type: "LiveKitTrackNotAccepted",
            participantIdentity: participant.identity,
            publicationSid: publication.trackSid ?? publication.sid,
            kind: mediaTrack?.kind ?? null,
            id: mediaTrack?.id ?? null,
          });
          return;
        }
  
        const previousTrack = this.outputTrackByKind.get(key);
  
        if (previousTrack === mediaTrack) {
          return;
        }
  
        // Replace the previous track of the same kind.
        if (previousTrack) {
          this.streamForKey(key).removeTrack(previousTrack);
        }
  
        this.outputTrackByKind.set(key, mediaTrack);
        this.outputPublisherByKind.set(key, participant.identity);
        this.outputPublicationByKind.set(key, publication.trackSid ?? publication.sid);
        if (key !== "screen_share" || !publication.isMuted) this.streamForKey(key).addTrack(mediaTrack);
  
        console.info("[LiveKit receiver] Added track", {
          participantIdentity: participant.identity,
          publicationSid: publication.trackSid ?? publication.sid,
          kind: mediaTrack.kind,
          id: mediaTrack.id,
        });
  
        sendJson({
          type: "LiveKitTrackAdded",
          participantIdentity: participant.identity,
          publicationSid: publication.trackSid ?? publication.sid,
          kind: mediaTrack.kind,
          id: mediaTrack.id,
        });
  
        this.notifyTrackChange();
      }
  
      removeRemoteTrack(remoteTrack, publication, participant) {
        if (this.closed) return;
        const mediaTrack = remoteTrack?.mediaStreamTrack;
        const key = this.outputKey(publication, mediaTrack?.kind ?? publication.kind);
        const sid = publication.trackSid ?? publication.sid;
        const currentTrack = this.outputTrackByKind.get(key);
        // SDKs may clear mediaStreamTrack before emitting TrackUnsubscribed.
        // Publication identity still allows teardown, without removing a replacement.
        const matches = sid ? this.outputPublicationByKind.get(key) === sid :
          mediaTrack && currentTrack === mediaTrack;
        if (!matches || this.outputPublisherByKind.get(key) !== participant.identity) return;
        this.outputTrackByKind.delete(key);
        this.outputPublisherByKind.delete(key);
        this.outputPublicationByKind.delete(key);
        if (currentTrack) this.streamForKey(key).removeTrack(currentTrack);
        this.disableOutput(key);
        this.notifyTrackChange();

        console.info("[LiveKit receiver] Removed track", {
          participantIdentity: participant.identity,
          publicationSid: publication.trackSid ?? publication.sid,
          kind: mediaTrack?.kind ?? publication.kind,
          id: mediaTrack?.id ?? null,
        });
      }
  
      notifyTrackChange() {
        this.trackEvents.dispatchEvent(new Event("trackchange"));
        this.stream.dispatchEvent(new Event("casttrackchange"));
        this.screenShareStream.dispatchEvent(new Event("casttrackchange"));
      }
  
      hasLiveTracks(requiredKinds) {
        return requiredKinds.every((kind) =>
          this.stream
            .getTracks()
            .some((track) => track.kind === kind && track.readyState === "live")
        );
      }
  
      /*
       * Resolves on the next track change, or after timeoutMs — whichever
       * comes first. Never rejects; the caller re-checks the deadline.
       * MediaStream's own addtrack/removetrack events cannot be used here:
       * they only fire for user-agent-initiated changes, not for our own
       * addTrack()/removeTrack() calls.
       */
      nextTrackChangeOrTimeout(timeoutMs) {
        return new Promise((resolve) => {
          const settle = () => {
            this.trackEvents.removeEventListener("trackchange", settle);
            clearTimeout(timer);
            resolve();
          };
  
          const timer = setTimeout(settle, timeoutMs);
          this.trackEvents.addEventListener("trackchange", settle);
        });
      }
  
      async waitForTrackKinds(requiredKinds, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
  
        while (!this.hasLiveTracks(requiredKinds)) {
          const remainingMs = deadline - Date.now();
  
          if (remainingMs <= 0) {
            const presentKinds =
              this.stream.getTracks().map((track) => track.kind).join(", ") ||
              "none";
  
            const message =
              `Timed out waiting for LiveKit tracks: ` +
              `${requiredKinds.join(", ")}. Present: ${presentKinds}`;
  
            sendJson({
              type: "LiveKitTrackWaitTimedOut",
              error: message,
              requiredKinds: requiredKinds,
              presentKinds: presentKinds,
              timeoutMs: timeoutMs,
            });
  
            throw new Error(message);
          }
  
          await this.nextTrackChangeOrTimeout(remainingMs);
        }
      }
  
      reportParticipants() {
        sendJson({
          type: "LiveKitRoomParticipants",
          roomName: this.room.name,
          localParticipant: this.room.localParticipant
            ? describeParticipant(this.room.localParticipant)
            : null,
          remoteParticipants: Array.from(
            this.room.remoteParticipants.values()
          ).map(describeParticipant),
        });
      }
  
      /*
       * Usually TrackSubscribed handles everything. Scan existing publications
       * too, in case subscription completed around the same time as
       * room.connect().
       */
      collectExistingTracks() {
        for (const participant of this.room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track) {
              this.addRemoteTrack(publication.track, publication, participant);
            }
          }
        }
      }
  
      clearOutputs() {
        for (const key of this.outputTrackByKind.keys()) this.disableOutput(key);
        this.outputTrackByKind.clear();
        this.outputPublisherByKind.clear();
        this.outputPublicationByKind.clear();
        // Remote tracks belong to LiveKit; remove them without stopping them.
        for (const stream of [this.stream, this.screenShareStream]) {
          for (const track of stream.getTracks()) stream.removeTrack(track);
        }
        this.notifyTrackChange();
      }

      async close() {
        this.closed = true;
        this.clearOutputs();

        try {
          await this.room.disconnect();
        } catch (error) {
          console.warn("[LiveKit receiver] Disconnect failed", error);
        }
      }
    }
  
    let activeConnection = null;
  
    async function disconnect() {
      const connection = activeConnection;
      activeConnection = null;
  
      window.__liveKitRoom = null;
      window.__liveKitMediaStream = null;
  
      if (connection) {
        await connection.close();
      }
    }
  
    async function connect({
      url,
      token,
  
      // Strongly recommended when the room can contain multiple publishers.
      // When omitted, the first remote publisher received is selected.
      participantIdentity = null,

      // Match participantIdentity against the publisher's
      // "lk.publish_on_behalf" attribute instead of its own identity.
      matchParticipantOnPublishOnBehalf = true,

      waitForAudio = true,
      waitForVideo = true,
      timeoutMs = 20_000,
    }) {
      if (typeof url !== "string" || !url) {
        throw new TypeError("url must be a non-empty LiveKit WebSocket URL");
      }
  
      if (typeof token !== "string" || !token) {
        throw new TypeError("token must be a non-empty participant token");
      }
  
      await disconnect();
  
      const room = new Room({
        /*
         * We consume RemoteTrack.mediaStreamTrack directly instead of
         * attaching video to an HTMLVideoElement. Adaptive stream is
         * therefore deliberately disabled.
         */
        adaptiveStream: false,
      });
  
      const connection = new LiveKitConnection(
        room,
        matchParticipantOnPublishOnBehalf
      );
      connection.selectedParticipantIdentity = participantIdentity;
  
      activeConnection = connection;
  
      // Expose these immediately for debugging and downstream use.
      window.__liveKitRoom = room;
      window.__liveKitMediaStream = connection.stream;
  
      try {
        await room.connect(url, token, { autoSubscribe: true });
  
        connection.reportParticipants();
        connection.collectExistingTracks();
  
        const requiredKinds = [
          ...(waitForAudio ? ["audio"] : []),
          ...(waitForVideo ? ["video"] : []),
        ];
  
        if (requiredKinds.length > 0) {
          await connection.waitForTrackKinds(requiredKinds, timeoutMs);
        }
  
        console.info("[LiveKit receiver] MediaStream ready", {
          roomName: room.name,
          selectedParticipantIdentity: connection.selectedParticipantIdentity,
          tracks: connection.stream.getTracks().map((track) => ({
            kind: track.kind,
            id: track.id,
            readyState: track.readyState,
            muted: track.muted,
          })),
        });
  
        return connection.stream;
      } catch (error) {
        console.error("[LiveKit receiver] Connection failed", error);
  
        sendJson({
          type: "LiveKitConnectionFailed",
          error: error.message,
        });
  
        await disconnect();
        throw error;
      }
    }
  
    window.LiveKitMediaStreamReceiver = Object.freeze({
      connect,
      disconnect,
  
      get room() {
        return activeConnection?.room ?? null;
      },
  
      get stream() {
        return activeConnection?.stream ?? null;
      },
  
      get screenShareStream() {
        return activeConnection?.screenShareStream ?? null;
      },

      get selectedParticipantIdentity() {
        return activeConnection?.selectedParticipantIdentity ?? null;
      },
    });
  })();


  async function streamRoomSyncSourceParticipant() {
    const livekitConfig =
      window.initialData.roomSyncSourceParticipantConfiguration.livekit;

    // The source participant is identified by exactly one of `identity` or
    // `publish_on_behalf`. When `publish_on_behalf` is set we match against the
    // publisher's "lk.publish_on_behalf" attribute rather than its own identity.
    const matchParticipantOnPublishOnBehalf =
      livekitConfig.publish_on_behalf != null;
    const participantIdentity = matchParticipantOnPublishOnBehalf
      ? livekitConfig.publish_on_behalf
      : livekitConfig.identity;

    const mediaStream = await window.LiveKitMediaStreamReceiver.connect({
        url: `ws://localhost:${window.initialData.websocketPort}`,
        token: livekitConfig.token,
        participantIdentity: participantIdentity,
        matchParticipantOnPublishOnBehalf: matchParticipantOnPublishOnBehalf,
        // Audio-only participants are allowed; we handle video ourselves below.
        waitForAudio: false,
        waitForVideo: false,
        });
    
    // Start audio immediately. A video track may arrive later (or never for
    // voice-only agents); it must not delay the microphone path.
    window.botOutputManager.setBotOutputMediaStream(mediaStream);
    let videoTrack = mediaStream.getVideoTracks()[0] ?? null;
    let audioTrack = mediaStream.getAudioTracks()[0] ?? null;
    let routing = Promise.resolve();
    const routeStream = () => {
      routing = routing.then(async () => {
        if (window.LiveKitMediaStreamReceiver.stream !== mediaStream) return;
        await window.botOutputManager.playBotOutputMediaStream("webcam");
      }).catch((error) => {
        window.ws?.sendJson({ type: "LiveKitOutputRoutingFailed", error: error.message });
      });
      return routing;
    };
    // MediaStream.addTrack does not emit the native addtrack event. The
    // receiver explicitly notifies us after changing its selected tracks.
    mediaStream.addEventListener("casttrackchange", () => {
      const nextVideoTrack = mediaStream.getVideoTracks()[0] ?? null;
      const nextAudioTrack = mediaStream.getAudioTracks()[0] ?? null;
      if (nextVideoTrack === videoTrack && nextAudioTrack === audioTrack) return;
      videoTrack = nextVideoTrack;
      audioTrack = nextAudioTrack;
      if (nextAudioTrack || nextVideoTrack) void routeStream();
    });
    if (audioTrack || videoTrack) await routeStream();

    // Keep presentation routing independent: starting/stopping a screen must
    // never replace the avatar stream or rewire its microphone audio.
    const screenStream = window.LiveKitMediaStreamReceiver.screenShareStream;
    let screenTrack = null;
    let screenRouting = Promise.resolve();
    const routeScreen = () => {
      const next = screenStream.getVideoTracks()[0] ?? null;
      if (next === screenTrack) return screenRouting;
      screenTrack = next;
      screenRouting = screenRouting.then(async () => {
        if (window.LiveKitMediaStreamReceiver.screenShareStream !== screenStream) return;
        const output = window.botOutputManager.screenShareVideoOutputStream;
        if (screenStream.getVideoTracks().length) {
          await output.playMediaStream(screenStream);
          // Revocation may happen while play() is awaiting browser readiness.
          if (window.LiveKitMediaStreamReceiver.screenShareStream !== screenStream ||
              !screenStream.getVideoTracks().length) await output.stopMediaStream();
        } else {
          await output.stopMediaStream();
        }
      }).catch((error) => {
        window.ws?.sendJson({type: "LiveKitScreenRoutingFailed", error: error.message});
      });
      return screenRouting;
    };
    screenStream.addEventListener("casttrackchange", routeScreen);
    await routeScreen();
  }

  window.streamRoomSyncSourceParticipant = streamRoomSyncSourceParticipant;