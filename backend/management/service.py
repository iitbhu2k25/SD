##################------For Admin---------#####################
# backend/management/service.py
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Q
from .models import PersonalAdmin, PersonalEmployee
import jwt
from datetime import datetime, timedelta
from .serializers import EmployeeRegisterSerializer, EmployeeLoginSerializer
import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail

from .models import OTPVerification

def register_admin(data):
    from .serializers import RegisterSerializer

    if PersonalAdmin.objects.filter(email=data.get('email')).exists():
        return False, "Email already registered"

    if PersonalAdmin.objects.filter(username=data.get('username')).exists():
        return False, "Username already taken"

    serializer = RegisterSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()
        token = jwt.encode({"user_id": user.id}, settings.SECRET_KEY, algorithm="HS256")
        return True, {"user": user, "token": token}
    else:
        return False, serializer.errors


def login_admin(email, password):
    try:
        admin = PersonalAdmin.objects.get(email=email)
    except PersonalAdmin.DoesNotExist:
        return False, "Invalid email or password"

    if not check_password(password, admin.password):
        return False, "Invalid email or password"

    if not admin.is_active:
        admin.is_active = True
        admin.save()

    token = jwt.encode({"user_id": admin.id}, settings.SECRET_KEY, algorithm="HS256")
    return True, {"user": admin, "token": token}


def logout_admin(token):
    if not token:
        return False, "Token missing"

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        admin = PersonalAdmin.objects.get(id=user_id)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, PersonalAdmin.DoesNotExist):
        return False, "Invalid token"

    admin.is_active = False
    admin.save()
    return True, "Logout successful"


def get_all_admins():
    return PersonalAdmin.objects.all()


##################------For Employee---------#####################


def register_employee(data):
    if PersonalEmployee.objects.filter(email=data.get('email', '').lower()).exists():
        return False, "Email already registered"

    if PersonalEmployee.objects.filter(username=data.get('username', '').lower()).exists():
        return False, "Username already taken"

    serializer = EmployeeRegisterSerializer(data=data)

    if serializer.is_valid():
        employee = serializer.save()
        token = generate_employee_token(employee.id)

        return True, {
            "employee": employee,
            "token": token
        }
    else:
        errors = serializer.errors
        error_message = "; ".join([f"{k}: {', '.join(v)}" for k, v in errors.items()])
        return False, error_message


def login_employee(email, password):
    try:
        employee = PersonalEmployee.objects.get(email=email.lower())

        if not check_password(password, employee.password):
            return False, "Invalid email or password"

        employee.is_active = True
        employee.save(update_fields=['is_active'])

        token = generate_employee_token(employee.id)

        return True, {
            "employee": employee,
            "token": token
        }

    except PersonalEmployee.DoesNotExist:
        return False, "Invalid email or password"

    except Exception as e:
        return False, f"Login error: {str(e)}"



def logout_employee(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        employee_id = payload.get('employee_id')
        
        if not employee_id:
            return False, "Invalid token"
        
        employee = PersonalEmployee.objects.get(id=employee_id)
        employee.is_active = False
        employee.save(update_fields=['is_active'])
        
        return True, "Logout successful"
        
    except jwt.ExpiredSignatureError:
        return False, "Token has expired"
    except jwt.InvalidTokenError:
        return False, "Invalid token"
    except PersonalEmployee.DoesNotExist:
        return False, "Employee not found"
    except Exception as e:
        return False, f"Logout error: {str(e)}"


def get_employee_status(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        employee_id = payload.get('employee_id')
        
        if not employee_id:
            return False, "Invalid token"
        
        employee = PersonalEmployee.objects.get(id=employee_id)
        
        return True, {
            "employee": employee,
            "is_active": employee.is_active
        }
        
    except jwt.ExpiredSignatureError:
        return False, "Token has expired"
    except jwt.InvalidTokenError:
        return False, "Invalid token"
    except PersonalEmployee.DoesNotExist:
        return False, "Employee not found"
    except Exception as e:
        return False, str(e)


def generate_employee_token(employee_id, expiry_days=30):
    payload = {
        'employee_id': employee_id,
        'exp': datetime.utcnow() + timedelta(days=expiry_days),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    return token


def verify_employee_token(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        employee_id = payload.get('employee_id')
        
        employee = PersonalEmployee.objects.get(id=employee_id, is_active=True)
        return True, employee
        
    except jwt.ExpiredSignatureError:
        return False, "Token has expired"
    except jwt.InvalidTokenError:
        return False, "Invalid token"
    except PersonalEmployee.DoesNotExist:
        return False, "Employee not found or inactive"
    except Exception as e:
        return False, str(e)


##################------Employee Filtering by Projects---------#####################


# Update your filter function

def filter_employees_by_projects(projects):
    """
    Filter employees by project names
    Returns all employees matching any of the provided projects
    """
    try:
        employees = PersonalEmployee.objects.filter(
            project_name__in=projects
        ).select_related('supervisor_email')  # Optimize FK query
        
        return True, employees

    except Exception as e:
        return False, f"Error filtering employees: {str(e)}"





def generate_otp():
    """Generate 6-digit OTP"""
    return str(random.randint(100000, 999999))


def send_otp_email(email, otp, user_type):
    """Send OTP via email"""
    subject = "Password Reset OTP - LEMS"
    message = f"""
    Hello,

    Your OTP for password reset is: {otp}

    This OTP is valid for 2 minutes only.
    User Type: {user_type.capitalize()}

    If you did not request this, please ignore this email.

    Regards,
    LEMS Team
    """
    
    try:
        send_mail(
            subject,
            message,
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Email sending failed: {str(e)}")
        return False


def send_otp_service(email, user_type):
    """Generate and send OTP"""
    try:
        # Check if user exists
        if user_type == 'admin':
            if not PersonalAdmin.objects.filter(email=email).exists():
                return False, "Admin email not found"
        elif user_type == 'employee':
            if not PersonalEmployee.objects.filter(email=email).exists():
                return False, "Employee email not found"
        
        # Invalidate old OTPs for this email
        OTPVerification.objects.filter(email=email, user_type=user_type).delete()
        
        # Generate new OTP
        otp = generate_otp()
        expires_at = timezone.now() + timedelta(minutes=2)
        
        # Save OTP
        otp_record = OTPVerification.objects.create(
            email=email,
            otp=otp,
            user_type=user_type,
            expires_at=expires_at
        )
        
        # Send email
        email_sent = send_otp_email(email, otp, user_type)
        
        if email_sent:
            return True, "OTP sent successfully to your email"
        else:
            return False, "Failed to send OTP email"
            
    except Exception as e:
        return False, f"Error: {str(e)}"


def verify_otp_service(email, otp, user_type):
    """Verify OTP"""
    try:
        otp_record = OTPVerification.objects.filter(
            email=email,
            otp=otp,
            user_type=user_type,
            is_verified=False
        ).order_by('-created_at').first()
        
        if not otp_record:
            return False, "Invalid OTP"
        
        if otp_record.is_expired():
            return False, "OTP has expired"
        
        # Mark as verified
        otp_record.is_verified = True
        otp_record.save()
        
        return True, "OTP verified successfully"
        
    except Exception as e:
        return False, f"Error: {str(e)}"


def reset_password_service(email, user_type, new_password, otp):
    """Reset password after OTP verification"""
    try:
        # Check if OTP is verified
        otp_record = OTPVerification.objects.filter(
            email=email,
            otp=otp,
            user_type=user_type,
            is_verified=True
        ).order_by('-created_at').first()
        
        if not otp_record:
            return False, "OTP not verified. Please verify OTP first"
        
        if otp_record.is_expired():
            return False, "OTP has expired"
        
        # Hash new password
        hashed_password = make_password(new_password)
        
        # Update password based on user type
        if user_type == 'admin':
            admin = PersonalAdmin.objects.filter(email=email).first()
            if not admin:
                return False, "Admin not found"
            admin.password = hashed_password
            admin.save()
            
        elif user_type == 'employee':
            employee = PersonalEmployee.objects.filter(email=email).first()
            if not employee:
                return False, "Employee not found"
            employee.password = hashed_password
            employee.save()
        
        # Delete OTP record after successful reset
        OTPVerification.objects.filter(email=email, user_type=user_type).delete()
        
        return True, "Password reset successfully"
        
    except Exception as e:
        return False, f"Error: {str(e)}"