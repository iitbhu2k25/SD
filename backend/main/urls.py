
from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("django/basics/", include("Basic.urls")),
    path("django/drain-water-quality/", include("dashboard.urls")),

]
