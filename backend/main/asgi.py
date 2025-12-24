
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import rwm.routing  # ✅ Import routing from rwm app

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            rwm.routing.websocket_urlpatterns  # ✅ Use rwm routing
        )
    ),
})