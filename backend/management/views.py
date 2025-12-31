# backend/management/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from .service import register_admin, login_admin, logout_admin, get_all_admins
from .serializers import LoginSerializer, PersonalAdminSerializer
from .service import register_employee, login_employee, logout_employee, get_employee_status, filter_employees_by_projects
from .serializers import EmployeeLoginSerializer, EmployeeRegisterSerializer, EmployeeSerializer, ProjectFilterSerializer
from management.middleware.permissions import IsAdminUser

from management.middleware.permissions import IsEmployeeUser

class RegisterAdminView(APIView):
    permission_classes = [AllowAny]  # Public - anyone can register

    def post(self, request):
        success, result = register_admin(request.data)
        if success:
            user = result['user']
            token = result['token']
            return Response({
                "success": True,
                "message": "Registration successful",
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "username": user.username,
                    "department": user.department,
                    "projects": user.projects
                },
                "token": token
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_400_BAD_REQUEST)


class LoginAdminView(APIView):
    permission_classes = [AllowAny]  # Public - anyone can login

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        success, result = login_admin(email, password)
        if success:
            admin = result['user']
            token = result['token']
            return Response({
                "success": True,
                "message": "Login successful",
                "user": {
                    "id": admin.id,
                    "name": admin.name,
                    "email": admin.email,
                    "username": admin.username,
                    "department": admin.department,
                    "projects": admin.projects
                },
                "token": token
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_401_UNAUTHORIZED)


class LogoutAdminView(APIView):
    permission_classes = [IsAuthenticated]  # ✅ Require authentication

    def post(self, request):
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None

        success, message = logout_admin(token)
        if success:
            return Response({"success": True, "message": message}, status=status.HTTP_200_OK)
        else:
            return Response({"success": False, "message": message}, status=status.HTTP_401_UNAUTHORIZED)


class PersonalAdminListView(APIView):
    permission_classes = [AllowAny]  # ✅ Only authenticated users

    def get(self, request):
        admins = get_all_admins()
        serializer = PersonalAdminSerializer(admins, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class RegisterEmployeeView(APIView):
    permission_classes = [AllowAny]  # Public registration

    def post(self, request):
        from .service import register_employee
        success, result = register_employee(request.data)

        if success:
            employee = result['employee']
            token = result['token']

            return Response({
                "success": True,
                "message": "Employee registration successful",
                "employee": {
                    "id": employee.id,
                    "name": employee.name,
                    "email": employee.email,
                    "username": employee.username,
                    "department": employee.department,
                    "supervisor_name": employee.supervisor_name,
                    "supervisor_email": employee.supervisor_email.email if employee.supervisor_email else None,
                    "projectName": employee.project_name,
                    "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
                    "position": employee.position,
                    "resign_date": employee.resign_date.isoformat() if employee.resign_date else None,
                    "is_active": employee.is_active
                },
                "token": token
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_400_BAD_REQUEST)


class LoginEmployeeView(APIView):
    permission_classes = [AllowAny]  # Public login

    def post(self, request):
        from .serializers import EmployeeLoginSerializer
        from .service import login_employee
        
        serializer = EmployeeLoginSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid input data",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        success, result = login_employee(email, password)

        if success:
            employee = result['employee']
            token = result['token']

            return Response({
                "success": True,
                "message": "Login successful",
                "user": {
                    "id": employee.id,
                    "name": employee.name,
                    "email": employee.email,
                    "username": employee.username,
                    "department": employee.department,
                    "supervisor_name": employee.supervisor_name,
                    "supervisor_email": employee.supervisor_email.email if employee.supervisor_email else None,
                    "projectName": employee.project_name,
                    "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
                    "position": employee.position,
                    "resign_date": employee.resign_date.isoformat() if employee.resign_date else None,
                    "is_active": employee.is_active,
                    "last_login": employee.created_at.isoformat() if employee.created_at else None
                },
                "token": token
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_401_UNAUTHORIZED)


class LogoutEmployeeView(APIView):
    permission_classes = [IsAuthenticated]  # ✅ Require authentication

    def post(self, request):
        from .service import logout_employee
        
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None

        if not token:
            return Response({
                "success": False,
                "message": "No token provided"
            }, status=status.HTTP_400_BAD_REQUEST)

        success, message = logout_employee(token)
        
        if success:
            return Response({
                "success": True,
                "message": message
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": message
            }, status=status.HTTP_400_BAD_REQUEST)


class EmployeeStatusView(APIView):
    permission_classes = [IsAuthenticated, IsEmployeeUser]  # ✅ Only authenticated employees

    def get(self, request):
        from .service import get_employee_status
        
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None

        if not token:
            return Response({
                "success": False,
                "message": "No token provided"
            }, status=status.HTTP_400_BAD_REQUEST)

        success, result = get_employee_status(token)
        
        if success:
            employee = result['employee']
            return Response({
                "success": True,
                "is_active": result['is_active'],
                "user": {
                    "id": employee.id,
                    "name": employee.name,
                    "email": employee.email,
                    "username": employee.username,
                    "department": employee.department,
                    "supervisor_name": employee.supervisor_name,
                    "supervisor_email": employee.supervisor_email.email if employee.supervisor_email else None,
                    "projectName": employee.project_name,
                    "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
                    "position": employee.position,
                    "resign_date": employee.resign_date.isoformat() if employee.resign_date else None
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_401_UNAUTHORIZED)


class FilterEmployeesByProjectView(APIView):
    permission_classes = [IsAuthenticated]  # ✅ Only authenticated users

    def post(self, request):
        from .serializers import ProjectFilterSerializer, EmployeeSerializer
        from .service import filter_employees_by_projects
        
        serializer = ProjectFilterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid data",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        projects = serializer.validated_data['projects']
        success, result = filter_employees_by_projects(projects)

        if success:
            employee_serializer = EmployeeSerializer(result, many=True)

            return Response({
                "success": True,
                "count": result.count(),
                "projects": projects,
                "employees": employee_serializer.data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": result
            }, status=status.HTTP_400_BAD_REQUEST)


class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import SendOTPSerializer
        from .service import send_otp_service
        
        serializer = SendOTPSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid data",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        user_type = serializer.validated_data['user_type']
        
        success, message = send_otp_service(email, user_type)
        
        if success:
            return Response({
                "success": True,
                "message": message
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": message
            }, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import VerifyOTPSerializer
        from .service import verify_otp_service
        
        serializer = VerifyOTPSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid data",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        user_type = serializer.validated_data['user_type']
        
        success, message = verify_otp_service(email, otp, user_type)
        
        if success:
            return Response({
                "success": True,
                "message": message
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": message
            }, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import ResetPasswordSerializer
        from .service import reset_password_service
        
        serializer = ResetPasswordSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid data",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        user_type = serializer.validated_data['user_type']
        new_password = serializer.validated_data['new_password']
        otp = serializer.validated_data['otp']
        
        success, message = reset_password_service(email, user_type, new_password, otp)
        
        if success:
            return Response({
                "success": True,
                "message": message
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": message
            }, status=status.HTTP_400_BAD_REQUEST)
