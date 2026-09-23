"""Idempotent internal service provisioning. Never prints credentials."""
import hashlib
import os

import django

django.setup()
from django.db import transaction
from accounts.models import Organization
from bots.models import ApiKey, Credentials, Project


def required(name):
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing {name}")
    return value


def main():
    token = required("TEAMS_BRIDGE_API_TOKEN")
    if len(token) < 32:
        raise RuntimeError("TEAMS_BRIDGE_API_TOKEN must have at least 32 characters")
    livekit = {"url": required("LIVEKIT_URL"), "api_key": required("LIVEKIT_API_KEY"), "api_secret": required("LIVEKIT_API_SECRET")}
    with transaction.atomic():
        organization, _ = Organization.objects.get_or_create(name="OpenAgents Teams bridge")
        project, _ = Project.objects.get_or_create(organization=organization, name="OpenAgents")
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        ApiKey.objects.filter(project=project, name="OpenAgents service").exclude(key_hash=key_hash).delete()
        ApiKey.objects.update_or_create(key_hash=key_hash, defaults={"project": project, "name": "OpenAgents service", "disabled_at": None})
        credentials, _ = Credentials.objects.get_or_create(project=project, credential_type=Credentials.CredentialTypes.LIVEKIT)
        credentials.set_credentials(livekit)
    print("openagents-teams-bridge provisioned")


if __name__ == "__main__":
    main()
