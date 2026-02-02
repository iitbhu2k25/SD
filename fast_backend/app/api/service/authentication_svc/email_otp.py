from app.database.config.session import email_server
import time
from app.api.schema.auth_schema import signup_input
import pyotp
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.conf.settings import Settings

SECRET_KEY = Settings().SECRET_KEY


from fastapi import BackgroundTasks

BASE_URL="https://slcrdss.in/api/authentication"
ADMIN_EMAIL="saxenarajat499@gmail.com"
serializer = URLSafeTimedSerializer(SECRET_KEY)
class EmailService:
    def __init__(self):
        self.email_service=email_server
        self.topt=pyotp.TOTP(s='base32secret3232',digits=6,interval=320)

    def send_otp(self):
        return self.topt.now()
    
    def verify_otp(self,otp:str):
        return (self.topt.verify(otp))
    
    def _send_email(self,backgroud:BackgroundTasks,email:EmailStr):
        opts=self.send_otp()
        html = f"""
                <html>
                <body>
                    <p>Hi,</p>
                    <p>This is your email verification code: <strong>{opts}</strong></p>
                </body>
                </html>
                """
        message = MessageSchema(
            subject="Email verification",
            recipients=[email],
            body=html,
            subtype=MessageType.html)

        fm = FastMail(email_server)
        backgroud.add_task(fm.send_message,message=message)
        return opts
    def _generate_approval_token(self,email: str, action: str):
        data = {
        "email": email,
        "action": action
        }
        return serializer.dumps(data, salt="user-approval")

    def verify_approval_token(self,token: str, max_age: int = 864000):
        try:
            data = serializer.loads(
                token,
                salt="user-approval",
                max_age=max_age
            )
            return data 
        except SignatureExpired:
            return "expired"
        except BadSignature:
            return "invalid"
    def approval(self,backgroud:BackgroundTasks,payload:signup_input):
        approve_token = self._generate_approval_token(payload.email, "approve")
        reject_token  = self._generate_approval_token(payload.email, "reject")
        approve_url = f"{BASE_URL}/admin/approve?token={approve_token}"
        reject_url  = f"{BASE_URL}/admin/reject?token={reject_token}"

        subject = "New User Signup Approval Required"
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8" />
        <title>User Approval</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
            <td align="center" style="padding:40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                
                <!-- Header -->
                <tr>
                    <td style="padding:24px 32px; border-bottom:1px solid #eeeeee;">
                    <h2 style="margin:0; color:#333333;">New User Signup Approval</h2>
                    </td>
                </tr>

                <!-- Content -->
                <tr>
                    <td style="padding:32px;">
                    <p style="margin-top:0; color:#555555;">
                        Hi Admin,
                    </p>

                    <p style="color:#555555;">
                        A new user has signed up and requires your approval.
                    </p>

                    <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
                        <tr>
                        <td style="padding:6px 0; color:#888;">Full Name:</td>
                        <td style="padding:6px 12px; color:#333;"><strong>{payload.fullname}</strong></td>
                        </tr>
                        <tr>
                        <td style="padding:6px 0; color:#888;">Email:</td>
                        <td style="padding:6px 12px; color:#333;"><strong>{payload.email}</strong></td>
                        </tr>
                    </table>

                    <!-- Buttons -->
                    <table cellpadding="0" cellspacing="0" style="margin-top:30px;">
                        <tr>
                        <td>
                            <a href="{approve_url}"
                            style="display:inline-block; padding:12px 22px; background:#28a745; color:#ffffff; text-decoration:none; border-radius:4px; font-weight:bold;">
                            ✅ Approve
                            </a>
                        </td>
                        <td style="width:12px;"></td>
                        <td>
                            <a href="{reject_url}"
                            style="display:inline-block; padding:12px 22px; background:#dc3545; color:#ffffff; text-decoration:none; border-radius:4px; font-weight:bold;">
                            ❌ Reject
                            </a>
                        </td>
                        </tr>
                    </table>

                    <p style="margin-top:30px; font-size:13px; color:#999;">
                        If you did not expect this request, you can safely ignore this email.
                    </p>
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="padding:16px 32px; background:#fafafa; border-top:1px solid #eeeeee; font-size:12px; color:#999999;">
                    © {2026} DSS IIT-BHU · Admin Panel
                    </td>
                </tr>

                </table>
            </td>
            </tr>
        </table>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=subject,
            recipients=[ADMIN_EMAIL],
            body=html,
            subtype=MessageType.html)

        fm = FastMail(email_server)
        backgroud.add_task(fm.send_message,message=message)

    
    