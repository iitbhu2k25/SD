import time
import asyncio
from fastapi import  Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

class AsyncSlidingWindowCounter:
    def __init__(self, limit: int, window_size: int):
        self.limit = limit                
        self.window_size = window_size      
        self.current_count = 0
        self.prev_count = 0
        self.window_start = time.monotonic()
        self.lock = asyncio.Lock()

    async def allow_request(self) -> bool:
        async with self.lock:
            now = time.monotonic()

            if now >= self.window_start + self.window_size:
                self.prev_count = self.current_count
                self.current_count = 0
                self.window_start = now

           
            elapsed = now - self.window_start
            weight = max((self.window_size - elapsed) / self.window_size, 0.0)
            estimated = self.prev_count * weight + self.current_count

            if estimated >= self.limit:
                return False

            self.current_count += 1
            return True

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: AsyncSlidingWindowCounter):
        super().__init__(app)
        self.limiter = limiter

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        allowed = await self.limiter.allow_request()
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests"},
            )
        return await call_next(request)


