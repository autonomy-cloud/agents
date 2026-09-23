import jwt
from django.test import SimpleTestCase

from bots.bot_controller.livekit_room_sync_client import LivekitRoomSyncClient


class LivekitRoomSyncIdentityTest(SimpleTestCase):
    def setUp(self):
        self.client = object.__new__(LivekitRoomSyncClient)
        self.client.api_key = 'test-key'
        self.client.api_secret = 'test-signing-secret-at-least-32-bytes'
        self.client.room_name = 'test-room'

    def decode(self, token):
        return jwt.decode(token, self.client.api_secret, algorithms=['HS256'])

    def test_external_human_has_signed_identity_and_readonly_attributes(self):
        claims = self.decode(self.client._build_participant_token('member-1', 'Meeting participant'))
        self.assertEqual(claims['sub'], 'human-external-member-1')
        self.assertEqual(claims['attributes'], {
            'cast.participant_type': 'HUMAN',
            'cast.participant_source': 'EXTERNAL_MEETING',
            'cast.external_participant_id': 'member-1',
        })
        self.assertFalse(claims['video']['canUpdateOwnMetadata'])
        self.assertTrue(claims['video']['canPublish'])
        other = self.decode(self.client._build_participant_token('member-2', 'Other participant'))
        self.assertNotEqual(claims['sub'], other['sub'])

    def test_hidden_media_subscriber_is_not_a_human(self):
        claims = self.decode(self.client._build_source_subscriber_token('subscriber'))
        self.assertNotIn('attributes', claims)
        self.assertTrue(claims['video']['hidden'])
        self.assertFalse(claims['video']['canPublish'])
