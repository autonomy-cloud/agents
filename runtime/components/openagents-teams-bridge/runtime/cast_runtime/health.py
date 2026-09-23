"""Private dependency readiness without leaking connection details."""
import os

from django.db import connection
from django.http import JsonResponse
import redis


def readiness(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM django_migrations LIMIT 1")
        with redis.Redis.from_url(os.environ["REDIS_URL"], socket_connect_timeout=2, socket_timeout=2) as broker:
            broker.ping()
    except Exception:
        return JsonResponse({"service": "cast-meeting", "status": "not-ready"}, status=503)
    return JsonResponse({"service": "cast-meeting", "status": "ready"})
