from app.database.config.session import email_server
import time
import pyotp
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
# now till i use the pytopt but i need
# to move the random+ redis TTL
class EmailService:
    def __init__(self):
        self.email_service=email_server
        self.topt=pyotp.TOTP(s='base32secret3232',digits=6,interval=1000)

    def send_otp(self):
        return self.topt.now()
    
    def verify_otp(self,otp:str):
        return (self.topt.verify(otp))
    
    async def _send_email(self,email:EmailStr):
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
        await fm.send_message(message)
        return opts
    
    

    
    