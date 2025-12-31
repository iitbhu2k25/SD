import csv
import os
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import PersonalAdmin, PersonalEmployee, LeaveEmployee
from .models import OTPVerification

# Base directory for CSV exports
BASE_DIR = os.path.join(settings.MEDIA_ROOT, "management")
os.makedirs(BASE_DIR, exist_ok=True)


# ==========================
# COMMON CSV WRITER
# ==========================
def write_csv(file_name, headers, rows):
    file_path = os.path.join(BASE_DIR, file_name)
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)


# ==========================
# PERSONAL ADMIN
# ==========================
def export_personal_admin():
    admins = PersonalAdmin.objects.all()
    write_csv(
        "personal_admin.csv",
        [
            "name", "email", "username", "password",
            "department", "projects", "is_active", "created_at"
        ],
        [
            [
                a.name,
                a.email,
                a.username,
                a.password,
                a.department,
                a.projects,
                a.is_active,
                a.created_at,
            ]
            for a in admins
        ],
    )


@receiver(post_save, sender=PersonalAdmin)
@receiver(post_delete, sender=PersonalAdmin)
def sync_personal_admin(sender, **kwargs):
    export_personal_admin()


# ==========================
# PERSONAL EMPLOYEE
# ==========================
def export_personal_employee():
    employees = PersonalEmployee.objects.all()
    write_csv(
        "personal_employee.csv",
        [
            "name", "email", "username", "password",
            "department", "supervisor_name", "supervisor_email",
            "project_name", "joining_date", "position",
            "resign_date", "is_active", "created_at", "updated_at"
        ],
        [
            [
                e.name,
                e.email,
                e.username,
                e.password,
                e.department,
                e.supervisor_name,
                e.supervisor_email.email if e.supervisor_email else None,
                e.project_name,
                e.joining_date.strftime("%Y-%m-%d") if e.joining_date else None,
                e.position,
                e.resign_date,
                e.is_active,
                e.created_at,
                e.updated_at,
            ]
            for e in employees
        ],
    )


@receiver(post_save, sender=PersonalEmployee)
@receiver(post_delete, sender=PersonalEmployee)
def sync_personal_employee(sender, **kwargs):
    export_personal_employee()


# ==========================
# LEAVE EMPLOYEE
# ==========================
def export_leave_employee():
    leaves = LeaveEmployee.objects.all()
    write_csv(
        "leave_employee.csv",
        [
            "employee_email", "employee_name",
            "supervisor_email", "from_date", "to_date",
            "total_days", "reason", "leave_type",
            "approval_status", "created_at", "updated_at"
        ],
        [
            [
                l.employee_email.email,
                l.employee_name,
                l.supervisor_email,
                l.from_date.strftime("%Y-%m-%d") if l.from_date else None,
                l.to_date.strftime("%Y-%m-%d") if l.to_date else None,
                l.total_days,
                l.reason,
                l.leave_type,
                l.approval_status,
                l.created_at,
                l.updated_at,
            ]
            for l in leaves
        ],
    )


@receiver(post_save, sender=LeaveEmployee)
@receiver(post_delete, sender=LeaveEmployee)
def sync_leave_employee(sender, **kwargs):
    export_leave_employee()


# ==========================
# OTP VERIFICATION
# ==========================
def export_otp_verification():
    otps = OTPVerification.objects.all()
    write_csv(
        "otp_verification.csv",
        [
            "email", "otp", "user_type",
            "is_verified", "created_at", "expires_at"
        ],
        [
            [
                o.email,
                o.otp,
                o.user_type,
                o.is_verified,
                o.created_at,
                o.expires_at,
            ]
            for o in otps
        ],
    )


@receiver(post_save, sender=OTPVerification)
@receiver(post_delete, sender=OTPVerification)
def sync_otp_verification(sender, **kwargs):
    export_otp_verification()
