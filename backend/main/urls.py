
from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("django/", include("Basic.urls")),
    path("django/gwa/", include("gwa.urls")),
    # path("django/drain-water-quality/", include("dashboard.urls")),
    path("django/swa/", include("swa.urls")),
    path("django/rwm/", include("rwm.urls")),
    path("django/datahub/", include("datahub.urls")),
    path("django/extract/",include("extract.urls")),
    path("django/rsq/",include("rsq.urls")),
    path("django/mapplot/",include("mapplot.urls")),
    
]
