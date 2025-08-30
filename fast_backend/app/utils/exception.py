from fastapi import status
from fastapi.exceptions import HTTPException
from functools import wraps
def validate(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return  await func(*args, **kwargs)
        except HTTPException as e:
            print("error is here",e)
            raise
        except Exception as e:
            print("error is here",e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )
    return wrapper