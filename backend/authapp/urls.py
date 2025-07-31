from django.urls import path
from .views import home, login_view, logout_view

urlpatterns = [
    path('home', home, name='home'),
    path('login', login_view),
    path('logout', logout_view),
]
