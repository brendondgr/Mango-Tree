from django.urls import include, path

from config.django.views import favicon, health, root_redirect

urlpatterns = [
    path("", root_redirect, name="root"),
    path("favicon.ico", favicon, name="favicon"),
    path("api/health/", health, name="health"),
    path("api/auth/", include("utils.api.routes.auth")),
    path("api/media-viewer/", include("utils.api.routes.media_viewer")),
    path("api/mailbox/", include("utils.api.routes.mailbox")),
    path("api/exercise/", include("utils.api.routes.exercise")),
    path("api/projectmanager/", include("utils.api.routes.projectmanager")),
    path("api/calendar/", include("utils.api.routes.calendar")),
    path("api/imdbspy/", include("utils.api.routes.imdbspy")),
    path("api/timekeeper/", include("utils.api.routes.timekeeper")),
    path("api/recipes/", include("utils.api.routes.recipes")),
    path("api/agent/", include("utils.api.routes.agent")),
    path("api/tools/", include("utils.api.routes.tools")),
    path("api/llm/", include("utils.api.routes.llm")),
]
