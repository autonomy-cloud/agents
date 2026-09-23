from django.test import SimpleTestCase


class PrivateSurfaceTests(SimpleTestCase):
    def test_health_is_cast_owned(self):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['service'], 'cast-meeting')

    def test_dashboard_and_account_routes_are_not_exposed(self):
        for path in ['/', '/admin/', '/accounts/login/', '/projects/', '/schema/', '/api/v1/bots']:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_bot_routes_require_service_authentication(self):
        self.assertEqual(self.client.post('/internal/meetings/v1/bots', {}, content_type='application/json').status_code, 401)
        self.assertEqual(self.client.get('/internal/meetings/v1/bots/bot_unknown').status_code, 401)
        self.assertEqual(self.client.post('/internal/meetings/v1/bots/bot_unknown/leave').status_code, 401)
