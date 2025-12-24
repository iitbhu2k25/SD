import csv
import os
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import PersonalAdmin, PersonalEmployee, LeaveEmployee


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
        for row in rows:
            writer.writerow(row)


# ==========================
# PERSONAL ADMIN
# ==========================
def export_personal_admin():
    admins = PersonalAdmin.objects.all()
    write_csv(
        "personal_admin.csv",
        [
            "id", "name", "email", "username", "password",
            "department", "projects", "is_active", "created_at"
        ],
        [
            [
                a.id,
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
            "id", "name", "email", "username", "password",
            "department", "supervisor_name", "supervisor_email",
            "project_name", "joining_date", "position",
            "resign_date", "is_active", "created_at", "updated_at"
        ],
        [
            [
                e.id,
                e.name,
                e.email,
                e.username,
                e.password,          
                e.department,
                e.supervisor_name,
                e.supervisor_email.email if e.supervisor_email else None,
                e.project_name,
                e.joining_date,
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
            "id", "employee_email", "employee_name",
            "supervisor_email", "from_date", "to_date",
            "total_days", "reason", "leave_type",
            "approval_status", "created_at", "updated_at"
        ],
        [
            [
                l.id,
                l.employee_email.email,
                l.employee_name,
                l.supervisor_email,
                l.from_date,
                l.to_date,
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
