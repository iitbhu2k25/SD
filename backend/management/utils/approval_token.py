# management/utils/approval_token.py
import jwt
from datetime import datetime, timedelta
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed

APPROVAL_TOKEN_SECRET = settings.SECRET_KEY  # or a separate secret
APPROVAL_TOKEN_ALG = "HS256"
APPROVAL_TOKEN_EXP_MINUTES = 30  # token valid for 30 minutes

def generate_approval_token(leave_id, supervisor_email):
    """
    Generate a short-lived JWT token specific to a leave + supervisor.
    """
    now = datetime.utcnow()
    payload = {
        "leave_id": leave_id,
        "supervisor_email": supervisor_email,
        "type": "leave_approval",
        "iat": now,
        "exp": now + timedelta(minutes=APPROVAL_TOKEN_EXP_MINUTES),
    }
    token = jwt.encode(payload, APPROVAL_TOKEN_SECRET, algorithm=APPROVAL_TOKEN_ALG)
    # PyJWT >= 2 returns str; if bytes, decode.
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token

def verify_approval_token(token):
    """
    Verify the approval token and return its payload, or raise AuthenticationFailed.
    """
    try:
        payload = jwt.decode(
            token,
            APPROVAL_TOKEN_SECRET,
            algorithms=[APPROVAL_TOKEN_ALG],
        )
        if payload.get("type") != "leave_approval":
            raise AuthenticationFailed("Invalid approval token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed("Approval token has expired")
    except jwt.InvalidTokenError:
        raise AuthenticationFailed("Invalid approval token")
