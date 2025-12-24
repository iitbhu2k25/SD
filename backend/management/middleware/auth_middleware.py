# management/middleware/auth_middleware.py
import jwt
from django.conf import settings
from django.http import JsonResponse
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from management.models import PersonalAdmin, PersonalEmployee

class JWTAuthentication(BaseAuthentication):
    """
    Custom JWT Authentication for both Admin and Employee
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            # Try to decode token
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            
            # Check if it's an admin token
            if 'user_id' in payload:
                try:
                    admin = PersonalAdmin.objects.get(id=payload['user_id'], is_active=True)
                    return (admin, token)
                except PersonalAdmin.DoesNotExist:
                    raise AuthenticationFailed('Admin not found or inactive')
            
            # Check if it's an employee token
            elif 'employee_id' in payload:
                try:
                    employee = PersonalEmployee.objects.get(id=payload['employee_id'], is_active=True)
                    return (employee, token)
                except PersonalEmployee.DoesNotExist:
                    raise AuthenticationFailed('Employee not found or inactive')
            
            else:
                raise AuthenticationFailed('Invalid token payload')
                
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')
        except Exception as e:
            raise AuthenticationFailed(f'Authentication error: {str(e)}')
    
    def authenticate_header(self, request):
        return 'Bearer'


# management/middleware/auth_middleware.py
class TokenAuthenticationMiddleware:
    # Public endpoints that do NOT require auth (exact paths only)
    PUBLIC_ENDPOINTS = {
        '/django/management/register',
        '/django/management/login',
        '/django/management/register/employee',
        '/django/management/login/employee',
        '/django/management/admindata',
        '/django/management/leave-update-status',
        # ⚠️ remove this, it will never match because of <path:email>:
        # '/django/management/leave-employee-email-get/<path:email>'
    }

    # Prefix-based public endpoints (for dynamic segments)
    PUBLIC_PREFIXES = (
        '/django/management/leave-employee-email-get/',  # note trailing slash
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.rstrip('/')

        # Skip if NOT a management URL
        if not path.startswith('/django/management'):
            return self.get_response(request)

        # Skip public endpoints (exact)
        if path in self.PUBLIC_ENDPOINTS:
            return self.get_response(request)

        # Skip public endpoints by prefix (for dynamic URL parts like email)
        for prefix in self.PUBLIC_PREFIXES:
            if path.startswith(prefix.rstrip('/')):
                return self.get_response(request)

        # Skip OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return self.get_response(request)

        # Check Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'message': 'Auth6259665entication required'
            }, status=401)

        token = auth_header.split(' ')[1]

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

            # Admin login
            if 'user_id' in payload:
                request.user = PersonalAdmin.objects.get(id=payload['user_id'], is_active=True)
                request.user_type = 'admin'

            # Employee login
            elif 'employee_id' in payload:
                request.user = PersonalEmployee.objects.get(id=payload['employee_id'], is_active=True)
                request.user_type = 'employee'

            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Invalid token payload'
                }, status=401)

        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Authentication error: {str(e)}'
            }, status=401)

        return self.get_response(request)
