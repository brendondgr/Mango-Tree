"""Read-only API over the agent tool-group catalogue.

Feeds the frontend tool-toggle UI (see docs/tool-groups.md). The toggle state
itself lives client-side and is sent per turn on ``/api/agent/.../agent_turn/``;
this endpoint only describes the available groups and their defaults.
"""

from django.urls import path
from rest_framework.decorators import api_view
from rest_framework.response import Response

from utils.agents.tools.groups import group_metadata


@api_view(["GET"])
def list_tool_groups(request):
    """Return the toggleable tool groups and their metadata."""
    return Response({"groups": group_metadata()})


urlpatterns = [
    path("groups/", list_tool_groups, name="tool-groups"),
]
