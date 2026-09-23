from django.http import JsonResponse
from cast_runtime.health import readiness
from django.urls import path
from bots.bots_api_views import BotListCreateView, BotDetailView, BotLeaveView

urlpatterns = [
    path("readyz", readiness),
    path("healthz", lambda request: JsonResponse({"service": "openagents-teams-bridge", "status": "ok"})),
    path("internal/meetings/v1/bots", BotListCreateView.as_view()),
    path("internal/meetings/v1/bots/<str:object_id>", BotDetailView.as_view()),
    path("internal/meetings/v1/bots/<str:object_id>/leave", BotLeaveView.as_view()),
]
