# Copyright 2023 LiveKit, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""LiveKit Server APIs for Python

`pip install livekit-api`

Manage rooms, participants, egress, ingress, SIP, and Agent dispatch.

Primary entry point is `OpenAgentsAPI`.

See https://docs.openagents.io/reference/server/server-apis for more information.
"""

# flake8: noqa
# re-export packages from protocol
from openagents.protocol.agent_dispatch import *
from openagents.protocol.agent import *
from openagents.protocol.egress import *
from openagents.protocol.ingress import *
from openagents.protocol.models import *
from openagents.protocol.room import *
from openagents.protocol.webhook import *
from openagents.protocol.sip import *
from openagents.protocol.connector_whatsapp import *
from openagents.protocol.connector_twilio import *

from .twirp_client import (
    ServerError,
    ServerErrorCode,
    SipCallError,
    TwirpError,
    TwirpErrorCode,
)
from .openagents_api import OpenAgentsAPI
from .access_token import (
    InferenceGrants,
    ObservabilityGrants,
    VideoGrants,
    SIPGrants,
    AccessToken,
    TokenVerifier,
)
from .webhook import WebhookReceiver
from .version import __version__

__all__ = [
    "OpenAgentsAPI",
    "room_service",
    "egress_service",
    "ingress_service",
    "sip_service",
    "agent_dispatch_service",
    "connector_service",
    "InferenceGrants",
    "ObservabilityGrants",
    "VideoGrants",
    "SIPGrants",
    "AccessToken",
    "TokenVerifier",
    "WebhookReceiver",
    "ServerError",
    "ServerErrorCode",
    "TwirpError",
    "TwirpErrorCode",
    "SipCallError",
]
