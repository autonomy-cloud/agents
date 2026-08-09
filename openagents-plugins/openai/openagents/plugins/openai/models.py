from typing import TypeAlias

# Internal OpenAI-compatible servers choose their own model and voice names.
# Avoid coupling the runtime to any public provider's periodically changing catalog.
ChatModels: TypeAlias = str
STTModels: TypeAlias = str
TTSModels: TypeAlias = str
TTSVoices: TypeAlias = str


def _supports_reasoning_effort(_model: str) -> bool:
    return False
