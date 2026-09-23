"""Private Cast meeting transport; no upstream dashboard or account routes."""
import os

# Prevent optional external telemetry from being initialized by base settings.
os.environ.pop("SENTRY_DSN", None)
os.environ["DISABLE_EMAIL"] = "true"
from attendee.settings.production import *  # noqa: F403,E402

ROOT_URLCONF = "cast_runtime.urls"
CHARGE_CREDITS_FOR_BOTS = False
DEBUG = False
DEFAULT_FROM_EMAIL = "meetings@localhost"
SERVER_EMAIL = DEFAULT_FROM_EMAIL

SITE_DOMAIN = "localhost"
