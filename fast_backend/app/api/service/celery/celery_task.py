from app.conf.celery import app
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

# from app.api.service.stp_svc.spt_document import StpDocument
from app.database.config.session import email_server
from app.api.service.stp_svc.stp_document import document_gen
import asyncio

# @app.task(bind=True,pydantic=True)
# def send_email_message(self,payload:str,email:EmailStr,file_path:str):
#         html = f"""
#                 <html>
#                 <body>
#                     <p>Hi,</p>
#                     <p>This is your {payload} <strong></strong></p>
#                 </body>
#                 </html>
#                 """
#         message = MessageSchema(
#             subject="Email verification",
#             recipients=[email],
#             body=html,
#             subtype=MessageType.html)

#         fm = FastMail(email_server)
#         asyncio.run(fm.send_message(message))

# @app.task(bind=True,pydantic=True)
# def priority_pdf_report(self,payload: StpReportInput):
#     file_path = StpDocument().report_generator(
#             layer_name=payload.raster,
#             csv_data=payload.table,
#             clip=payload.clip,
#             dpi=700
#         )
#     if file_path:
#         # send the email
        
#         pass
    