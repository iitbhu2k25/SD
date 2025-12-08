import time
from threading import Lock
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import (
  BaseHTTPMiddleware,
  RequestResponseEndpoint
)


class SlidingWindowCounter:
    def __init__(self, limit: int, window_size: int):
        self.limit = limit  # e.g., 100 requests
        self.window_size = window_size  # e.g., 60 seconds
        self.current_count = 0
        self.previous_count = 0
        self.window_start = int(time.time())
        self.lock = Lock()  # For thread safety
    
    def allow_request(self) -> bool:
        now = int(time.time())
        # Check if we've moves to a new window
        if now >= self.window_start + self.window_size:
            self.previous_count = self.current_count
            self.current_count = 0
            self.window_start = now  # Or align to fixed boundaries for consistenncy
        # Calculate elapsed time and weight
        elapsed = now - self.window_start
        weight = (
            (self.window_size - elapsed) / self.window_size
            if elapsed < self.window_size
            else 0.0
        )
        estimated = (self.previous_count + weight) + self.current_count
        if estimated >= self.limit:
            return False  # Reject
        self.current_count += 1
        return True  # Allow

# RateLimiterMiddleware is a Starlette middleware that enforces the sliding window counter.
class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: SlidingWindowCounter):
        super().__init__(app)
        self.limiter = limiter
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        if not self.limiter.allow_request():
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded"},
            )
        return await call_next(request)


# Create the FastAPI app
app = FastAPI()

# Initialize the rate limiter: 5 requests per 60 seconds
limiter = SlidingWindowCounter(limit=5, window_size=60)

# Apply the rate limiter middleware globally
app.add_middleware(RateLimiterMiddleware, limiter=limiter)

# Sample Route
@app.get("/")
async def root():
    return {"message": "Hello, Bro!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0")