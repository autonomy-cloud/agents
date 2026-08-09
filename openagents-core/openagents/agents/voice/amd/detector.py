from __future__ import annotations

import asyncio
from types import TracebackType
from typing import TYPE_CHECKING, Literal, TypedDict

from opentelemetry import trace

from openagents import rtc

from ...job import get_job_context
from ...llm import LLM as _LLM
from ...log import logger
from ...stt import STT as _STT
from ...telemetry import trace_types, tracer
from ...types import NOT_GIVEN, NotGivenOr
from ...utils import EventEmitter, aio, is_given
from ...utils.participant import (
    wait_for_participant_attribute,
    wait_for_track_publication,
)
from .classifier import (
    AMD_PROMPT,
    HUMAN_SILENCE_THRESHOLD,
    HUMAN_SPEECH_THRESHOLD,
    MACHINE_SILENCE_THRESHOLD,
    MAX_ENDPOINTING_DELAY,
    NO_SPEECH_THRESHOLD,
    TIMEOUT,
    AMDCategory,
    AMDPredictionEvent,
    _AMDClassifier,
)

if TYPE_CHECKING:
    from ...llm import LLM
    from ...stt import STT
    from ..agent_session import AgentSession
    from ..audio_recognition import _EndOfTurnInfo

_SIP_CALL_STATUS_ATTR = "sip.callStatus"
_SIP_CALL_STATUS_ACTIVE = "active"
_TRACK_PUBLICATION_TIMEOUT = 5.0


class DetectionOptions(TypedDict, total=False):
    human_speech_threshold: float
    human_silence_threshold: float
    machine_silence_threshold: float
    no_speech_threshold: float
    timeout: float
    max_endpointing_delay: float
    prompt: str


_DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
    "human_speech_threshold": HUMAN_SPEECH_THRESHOLD,
    "human_silence_threshold": HUMAN_SILENCE_THRESHOLD,
    "machine_silence_threshold": MACHINE_SILENCE_THRESHOLD,
    "no_speech_threshold": NO_SPEECH_THRESHOLD,
    "timeout": TIMEOUT,
    "max_endpointing_delay": MAX_ENDPOINTING_DELAY,
    "prompt": AMD_PROMPT,
}


class AMD(EventEmitter[Literal["amd_prediction"]]):
    """Answering Machine Detection (AMD).

    Detects whether an outbound call is answered by a human or a machine.

    Listens to the call greeting and uses an LLM to classify it into one of
    the following categories:

    - ``human``: a real person answered.
    - ``machine-ivr``: an IVR / DTMF menu prompt was detected.
    - ``machine-vm``: a voicemail greeting where leaving a message is possible.
    - ``machine-unavailable``: the mailbox is full or not set up; leaving a message is not possible.
    - ``uncertain``: the transcript is ambiguous and could not be classified.

    Start AMD before creating the SIP participant so no audio is missed. Its
    detection timeout begins only after listening starts; SIP settings bound
    the pre-answer phase. If the call ends before audio arrives, AMD settles
    immediately with an ``uncertain`` verdict (``reason="participant_missing"``).

    For SIP participants, the no-speech timer and
    audio/transcript processing are deferred until ``sip.callStatus ==
    "active"`` so pre-answer audio (ringback, carrier early media, dialtone)
    does not poison the classifier or burn the no-speech budget.

    The recommended pattern is the async context manager::

        async with AMD(session, llm=local_llm) as detector:
            await ctx.api.sip.create_sip_participant(...)  # wait_until_answered=True
            result = await detector.execute()

    Args:
        session: The :class:`AgentSession` to wire AMD to.
        llm: Explicit local :class:`LLM` used for greeting classification.
            When omitted, AMD reuses the session's LLM.
        interrupt_on_machine: If ``True`` (default), interrupt any pending
            agent speech immediately when a machine is detected.
        ivr_detection: If ``True`` (default), automatically start IVR
            navigation when a ``machine-ivr`` result is returned.
        participant_identity: If set, AMD listens only to this participant's
            audio track, and settles immediately if that participant
            disconnects before publishing audio. If omitted, the first remote
            audio track wins and the publisher is resolved from the track sid.
        stt: Optional explicit local :class:`STT` used for transcript
            generation. When omitted, AMD reuses session transcripts.
        suppress_compatibility_warning: Retained as a no-op for API compatibility.
        detection_options: Optional overrides for timing thresholds and the AMD
            classification prompt (see :class:`DetectionOptions`). When
            omitted, library defaults apply. ``max_endpointing_delay`` can be
            set here to override the session activity's endpointing backstop
            for AMD.
        wait_until_finished: If ``True``, once any speech has been heard the
            ``detection_timeout`` no longer forces emission — AMD will keep
            waiting for post-speech silence and either a session end-of-turn
            signal or the session's max endpointing delay before emitting.
            Useful for outbound voicemail flows where leaving a message early
            would overlap the greeting. ``no_speech_timeout`` (uncertain)
            still fires normally (no audio at all means there is nothing to
            wait for). Continuous audio without a speech-end or end-of-turn can
            therefore extend detection beyond ``timeout``; set this to
            ``False`` when ``timeout`` should remain a hard cap after speech
            starts. Defaults to ``True``.
    """

    def __init__(
        self,
        session: AgentSession,
        *,
        llm: NotGivenOr[LLM] = NOT_GIVEN,
        stt: NotGivenOr[STT] = NOT_GIVEN,
        interrupt_on_machine: bool = True,
        ivr_detection: bool = True,
        participant_identity: NotGivenOr[str] = NOT_GIVEN,
        suppress_compatibility_warning: bool = False,
        detection_options: NotGivenOr[DetectionOptions] = NOT_GIVEN,
        wait_until_finished: bool = True,
    ) -> None:
        super().__init__()

        self._llm_config: NotGivenOr[LLM] = llm
        self._session: AgentSession = session
        self._interrupt_on_machine = interrupt_on_machine
        self._ivr_detection = ivr_detection
        self._wait_until_finished = wait_until_finished
        self._participant_identity: NotGivenOr[str] = participant_identity
        self._stt: NotGivenOr[_STT] = stt

        self._classifier: _AMDClassifier | None = None
        self._result: AMDPredictionEvent | None = None
        self._closed = False
        self._span: trace.Span | None = None

        self._provided_detection_options: DetectionOptions = (
            detection_options if is_given(detection_options) else {}
        )
        self._opts: DetectionOptions = {
            **_DEFAULT_DETECTION_OPTIONS,
            **self._provided_detection_options,
        }

        self._setup_task: asyncio.Task[None] | None = None
        self._sip_answer_task: asyncio.Task[None] | None = None
        self._audio_ch: aio.Chan[rtc.AudioFrame] | None = None

    @property
    def enabled(self) -> bool:
        return self._classifier is not None

    @property
    def pending(self) -> bool:
        return self._classifier is not None and self._result is None

    @property
    def started(self) -> bool:
        return self._classifier is not None and self._classifier.listening

    async def execute(self) -> AMDPredictionEvent:
        """Run AMD and return the result.

        While executing, speech playout authorization is locked. Once the
        result is available, authorization is resumed and automatic actions
        (interrupt on machine, ivr detection) are applied based on the
        configured options.
        """
        if self._classifier:
            await self._classifier._verdict_ready.wait()

        if not self._result:
            raise RuntimeError("amd closed before a result was available")

        result = self._result

        if result.is_machine and self._interrupt_on_machine:
            await self._session.interrupt(force=True)

        if result.category == AMDCategory.MACHINE_IVR and self._ivr_detection:
            await self._session._start_ivr_detection(
                transcript=result.transcript,
            )

        # eagerly resume so agent can speak immediately to a human
        if self._session._activity:
            self._session._activity._resume_authorization()

        return result

    def _on_end_of_turn(self, info: _EndOfTurnInfo) -> bool:
        """Forward EOT to the classifier and signal whether AMD is consuming
        this turn so the agent activity should skip the normal reply pipeline.

        Returns ``True`` when AMD has decided this is a machine and the caller
        asked us to take over via ``interrupt_on_machine``; the caller is
        expected to drive its own ``generate_reply`` (e.g. leaving a voicemail)
        and the auto-reply triggered by user-turn completion would otherwise
        race with it.
        """
        if self._closed or not self._classifier:
            return False
        self._classifier.on_end_of_turn()
        if not (
            self._interrupt_on_machine and self._result is not None and self._result.is_machine
        ):
            return False
        logger.debug(
            "skipping auto reply: AMD already returned a machine verdict",
            extra={
                "category": self._result.category.value,
                "transcript": info.new_transcript,
            },
        )
        return True

    async def __aenter__(self) -> AMD:
        await self._run(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    # region: lifecycle hooks (called by AudioRecognition)

    def push_audio(self, frame: rtc.AudioFrame) -> None:
        if not (self._classifier and self._classifier.listening):
            return
        if self._audio_ch and not self._audio_ch.closed:
            self._audio_ch.send_nowait(frame)

    def _on_user_speech_started(self) -> None:
        if self._classifier:
            self._classifier.on_user_speech_started()

    def _on_user_speech_ended(self, silence_duration: float) -> None:
        if self._classifier:
            self._classifier.on_user_speech_ended(silence_duration)

    def _on_transcript(self, text: str) -> None:
        if self._classifier:
            self._classifier.push_text(text)

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True

        pending = [t for t in (self._sip_answer_task, self._setup_task) if t is not None]
        if pending:
            await aio.cancel_and_wait(*pending)
        self._sip_answer_task = None
        self._setup_task = None

        if self._audio_ch and not self._audio_ch.closed:
            self._audio_ch.close()

        if self._classifier:
            self._classifier.off("amd_prediction", self._on_amd_prediction)
            await self._classifier.close()
            self._classifier = None

        self._end_span()

        if self._session._activity:
            self._session._activity._resume_authorization()

        self._session._amd = None

    # endregion

    # region: internal methods

    async def _run(self, session: AgentSession) -> None:
        if self._classifier:
            logger.warning("AMD already running, skipping")
            return

        self._session = session
        self._classifier = self._resolve_classifier(session)
        if not self._classifier:
            raise ValueError(
                "AMD classifier could not be resolved, please provide a compatible model"
            )
        self._classifier.on("amd_prediction", self._on_amd_prediction)
        self._closed = False
        self._result = None

        if session.options.ivr_detection:
            logger.warning("session level ivr_detection will be disabled when AMD is used")
            session.options.ivr_detection = False

        if session._ivr_activity:
            logger.warning(
                "session-level IVR detection was already started, "
                "closing it so AMD can manage the IVR lifecycle"
            )
            await session._ivr_activity.aclose()
            session._ivr_activity = None

        session._amd = self

        # classifier is dormant until start_detection_timer / start_listening;
        # the listening gate stays closed so pre-setup audio is dropped.
        self._start_span()
        if session._activity:
            session._activity._pause_authorization()

        self._setup_task = asyncio.create_task(self._setup(session), name="amd_setup")

    async def _setup(self, session: AgentSession) -> None:
        if self._closed:
            return
        if not session._room_io:
            logger.warning(
                "session room_io unavailable, starting amd timers immediately as fallback"
            )
            self._start_listening()
        else:
            room = session._room_io.room
            try:
                publication = await asyncio.wait_for(
                    wait_for_track_publication(
                        room=room,
                        identity=self._participant_identity or None,
                        kind=rtc.TrackKind.KIND_AUDIO,
                        wait_for_subscription=True,
                    ),
                    timeout=_TRACK_PUBLICATION_TIMEOUT,
                )
            except asyncio.TimeoutError:
                self._settle_participant_missing("timed out waiting for participant audio track")
                return
            except RuntimeError as e:
                self._settle_participant_missing(str(e))
                return
            if self._closed or not self._classifier:
                return

            if self._participant_identity:
                publisher = room.remote_participants.get(self._participant_identity)
            else:
                publisher = next(
                    (
                        p
                        for p in room.remote_participants.values()
                        if publication.sid in p.track_publications
                    ),
                    None,
                )
            if publisher is None:
                self._settle_participant_missing("participant disappeared after track subscription")
                return

            if publisher.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
                self._sip_answer_task = asyncio.create_task(
                    self._wait_for_sip_answer(room, publisher.identity),
                    name="amd_sip_answer",
                )
            else:
                self._start_listening()

        if is_given(self._stt) and not self._closed:
            logger.debug("starting amd stt pipeline")
            await self._run_stt()

    def _start_listening(self) -> None:
        if self._closed or not self._classifier:
            return
        self._classifier.start_detection_timer()
        self._classifier.start_listening()
        logger.debug("AMD starts listening")

    def _settle_participant_missing(self, error: str) -> None:
        if self._closed or not self._classifier:
            return
        logger.debug(
            "AMD: call ended before detection could run, settling",
            extra={"error": error},
        )
        self._classifier.settle(AMDCategory.UNCERTAIN, reason="participant_missing")

    async def _wait_for_sip_answer(self, room: rtc.Room, identity: str) -> None:
        try:
            await wait_for_participant_attribute(
                room,
                identity=identity,
                attribute=_SIP_CALL_STATUS_ATTR,
                value=_SIP_CALL_STATUS_ACTIVE,
            )
        except RuntimeError as e:
            self._settle_participant_missing(str(e))
            return

        if not self._closed:
            self._start_listening()

    async def _run_stt(self) -> None:
        assert is_given(self._stt)
        assert self._classifier

        self._audio_ch = aio.Chan[rtc.AudioFrame]()

        async with self._stt.stream() as stt_stream:

            async def _send(chan: aio.Chan[rtc.AudioFrame]) -> None:
                async for frame in chan:
                    stt_stream.push_frame(frame)

                stt_stream.end_input()

            async def _receive() -> None:
                from ...stt import SpeechEventType

                async for event in stt_stream:
                    if (
                        event.type == SpeechEventType.FINAL_TRANSCRIPT
                        and event.alternatives
                        and self._classifier
                        and (text := event.alternatives[0].text)
                    ):
                        self._classifier.push_text(text, source="amd_stt")

            tasks = [
                asyncio.create_task(_send(self._audio_ch), name="amd_stt_send"),
                asyncio.create_task(_receive(), name="amd_stt_receive"),
            ]
            try:
                await asyncio.gather(*tasks)
            finally:
                await aio.cancel_and_wait(*tasks)

    def _on_amd_prediction(self, result: AMDPredictionEvent) -> None:
        self._result = result
        logger.info(
            "amd prediction",
            extra={
                "category": result.category.value,
                "reason": result.reason,
                "speech_duration": result.speech_duration,
                "delay": result.delay,
                "transcript": result.transcript,
            },
        )
        if self._classifier:
            self._classifier.end_input()
        if self._audio_ch:
            self._audio_ch.close()

        if self._span:
            self._span.set_attributes(
                {
                    trace_types.ATTR_AMD_CATEGORY: result.category.value,
                    trace_types.ATTR_AMD_REASON: result.reason,
                    trace_types.ATTR_AMD_SPEECH_DURATION: result.speech_duration,
                    trace_types.ATTR_AMD_DELAY: result.delay,
                    trace_types.ATTR_AMD_TRANSCRIPT: result.transcript,
                }
            )

        self._end_span()

        try:
            ctx = get_job_context()
            ctx.tagger.add(
                f"lk.amd:{result.category.value}",
                metadata={
                    "category": result.category.value,
                    "speech_duration": result.speech_duration,
                    "reason": result.reason,
                    "transcript": result.transcript,
                    "delay": result.delay,
                },
            )
        except RuntimeError:
            pass

        if (host := self._session._session_host) is not None:
            host._on_amd_prediction(result)

        self.emit("amd_prediction", result)

    def _start_span(self) -> None:
        if self._span:
            return
        self._span = tracer.start_span("amd", context=self._session._root_span_context)

    def _end_span(self) -> None:
        if not self._span:
            return
        self._span.end()
        self._span = None

    def _resolve_classifier(
        self,
        session: AgentSession,
    ) -> _AMDClassifier | None:
        _llm: _LLM | None = None
        if isinstance(self._llm_config, _LLM):
            _llm = self._llm_config
        elif (candidate := session.llm) and isinstance(candidate, _LLM):
            _llm = candidate

        if _llm:
            max_endpointing_delay = (
                self._provided_detection_options["max_endpointing_delay"]
                if "max_endpointing_delay" in self._provided_detection_options
                else (
                    session._activity.max_endpointing_delay
                    if session._activity
                    else self._opts["max_endpointing_delay"]
                )
            )
            return _AMDClassifier(
                _llm,
                human_speech_threshold=self._opts["human_speech_threshold"],
                human_silence_threshold=self._opts["human_silence_threshold"],
                machine_silence_threshold=self._opts["machine_silence_threshold"],
                no_speech_threshold=self._opts["no_speech_threshold"],
                timeout=self._opts["timeout"],
                prompt=self._opts["prompt"],
                source="amd_stt" if is_given(self._stt) else "stt",
                wait_until_finished=self._wait_until_finished,
                max_endpointing_delay=max_endpointing_delay,
            )

        return None

    # endregion
