# backend/management/leave_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .models import LeaveEmployee, PersonalEmployee
from urllib.parse import quote
from django.core.mail import EmailMultiAlternatives
from .utils.approval_token import generate_approval_token
from django.conf import settings

from django.core.mail import EmailMessage

def send_leave_email_to_admins(admin_emails, subject, message):
    try:
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=None,            # Uses EMAIL_HOST_USER
            to=admin_emails             # ✅ LIST of admins
        )
        email.send()
        return True
    except Exception as e:
        print("EMAIL ERROR:", e)
        return False


def apply_leave_service(data):
    try:
        employee = PersonalEmployee.objects.get(email=data['employee_email'])

        leave = LeaveEmployee.objects.create(
            employee_email=employee,
            employee_name=data['employee_name'],
            supervisor_email=data['supervisor_email'],
            from_date=data['from_date'],
            to_date=data['to_date'],
            total_days=data['total_days'],
            reason=data['reason'],
            leave_type=data['leave_type'],
        )

        admin_emails = [leave.supervisor_email, "hr@company.com", "admin@company.com"]

        # URL SAFE EMAIL
        encoded_email = quote(employee.email)

        # ✅ Generate approval token specific to this leave + supervisor
        approval_token = generate_approval_token(leave.id, leave.supervisor_email)

        # ✅ Build frontend base URL from settings
        frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "https://lems-two.vercel.app")
        approval_link = f"{frontend_base_url}/dss/management/approve/{encoded_email}?token={approval_token}"

        subject = "✅ New Leave Request Approval"

        html_message = f"""
        <div style="font-family:Arial;background:#f4f6f8;padding:30px;">
          <div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:10px;text-align:center;box-shadow:0px 4px 10px rgba(0,0,0,0.1)">

            <h2 style="color:#2c3e50;">Leave Approval Required</h2>

            <p><strong>Employee:</strong> {leave.employee_name}</p>
            <p><strong>Email:</strong> {employee.email}</p>

            <p><strong>From:</strong> {leave.from_date}</p>
            <p><strong>To:</strong> {leave.to_date}</p>
            <p><strong>Total Days:</strong> {leave.total_days}</p>

            <p style="margin-top:15px;"><strong>Reason:</strong></p>
            <p>{leave.reason}</p>

            <br/>

            <a href="{approval_link}">
              <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png"
                   width="180"
                   style="margin-top:20px;cursor:pointer;"
                   alt="Approve Leave"/>
            </a>

            <p style="margin-top:10px;color:#16a34a;font-weight:bold;">
              Click the button above to approve or reject
            </p>

            <hr style="margin:25px 0;"/>

            <p style="font-size:12px;color:gray;">
              Auto-generated Leave Approval System
            </p>

          </div>
        </div>
        """

        msg = EmailMultiAlternatives(
            subject,
            "Click the approve button from the HTML email",
            None,
            admin_emails
        )
        msg.attach_alternative(html_message, "text/html")
        msg.send()

        return True, leave, True

    except PersonalEmployee.DoesNotExist:
        return False, "Employee email not registered", False

    except Exception as e:
        return False, str(e), False





def get_leaves_by_employee_email(employee_email):
    leave_data = LeaveEmployee.objects.filter(
        employee_email__email=employee_email
    ).order_by('-created_at')

    return leave_data



def update_leave_approval_status(leave_id, approval_status):
    try:
        leave = LeaveEmployee.objects.get(id=leave_id)
        leave.approval_status = approval_status
        leave.save()
        return True, leave
    except LeaveEmployee.DoesNotExist:
        return False, None
