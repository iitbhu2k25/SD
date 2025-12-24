# management/permissions.py
from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """
    Permission class to check if user is an Admin
    """
    def has_permission(self, request, view):
        return hasattr(request, 'user_type') and request.user_type == 'admin'


class IsEmployeeUser(permissions.BasePermission):
    """
    Permission class to check if user is an Employee
    """
    def has_permission(self, request, view):
        return hasattr(request, 'user_type') and request.user_type == 'employee'


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission to allow users to access only their own data, or admin to access all
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if hasattr(request, 'user_type') and request.user_type == 'admin':
            return True
        
        # Employee can only access their own data
        if hasattr(request, 'user_type') and request.user_type == 'employee':
            return obj.id == request.user.id
        
        return False