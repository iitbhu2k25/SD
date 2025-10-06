
from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("django/", include("Basic.urls")),
    path("django/gwa/", include("gwa.urls")),
    path("django/drain-water-quality/", include("dashboard.urls")),
    path("django/wqa/", include("wqa.urls")),

]
