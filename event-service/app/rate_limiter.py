"""
Rate Limiter Module
Implements token bucket and sliding window rate limiting
"""

import time
import asyncio
from typing import Dict, Optional, Callable
from functools import wraps
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    requests: int  # Number of requests allowed
    window: int  # Time window in seconds
    burst: int = None  # Allow burst above limit
    
    def __post_init__(self):
        if self.burst is None:
            self.burst = self.requests


class TokenBucket:
    """Token bucket rate limiter"""
    
    def __init__(self, rate: float, capacity: int):
        """
        Initialize token bucket
        
        Args:
            rate: Tokens added per second
            capacity: Maximum bucket capacity
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
    
    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_update = now
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if tokens consumed, False if rate limited
        """
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def get_wait_time(self, tokens: int = 1) -> float:
        """Get time to wait until tokens are available"""
        self._refill()
        if self.tokens >= tokens:
            return 0
        return (tokens - self.tokens) / self.rate


class SlidingWindowRateLimiter:
    """Sliding window rate limiter with sub-window precision"""
    
    def __init__(self, limit: int, window: int, precision: int = 10):
        """
        Initialize sliding window rate limiter
        
        Args:
            limit: Maximum requests per window
            window: Window size in seconds
            precision: Number of sub-windows for precision
        """
        self.limit = limit
        self.window = window
        self.precision = precision
        self.sub_window = window / precision
        self.counters: Dict[str, Dict[int, int]] = {}
    
    def _get_window_key(self) -> int:
        """Get current sub-window key"""
        return int(time.time() / self.sub_window)
    
    def _cleanup_old_windows(self, key: str):
        """Remove expired sub-windows"""
        if key not in self.counters:
            return
        
        current = self._get_window_key()
        expired = current - self.precision
        
        self.counters[key] = {
            k: v for k, v in self.counters[key].items()
            if k > expired
        }
    
    def is_allowed(self, key: str) -> bool:
        """
        Check if request is allowed
        
        Args:
            key: Unique identifier (e.g., IP address, user ID)
            
        Returns:
            True if allowed, False if rate limited
        """
        self._cleanup_old_windows(key)
        
        if key not in self.counters:
            self.counters[key] = {}
        
        # Calculate total requests in window
        total = sum(self.counters[key].values())
        
        if total >= self.limit:
            return False
        
        # Increment counter for current sub-window
        window_key = self._get_window_key()
        self.counters[key][window_key] = self.counters[key].get(window_key, 0) + 1
        
        return True
    
    def get_remaining(self, key: str) -> int:
        """Get remaining requests in current window"""
        self._cleanup_old_windows(key)
        
        if key not in self.counters:
            return self.limit
        
        total = sum(self.counters[key].values())
        return max(0, self.limit - total)
    
    def get_reset_time(self, key: str) -> int:
        """Get seconds until rate limit resets"""
        return int(self.sub_window - (time.time() % self.sub_window))


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    
    def __init__(self, message: str, retry_after: int = None):
        super().__init__(message)
        self.retry_after = retry_after


# Global rate limiters
_rate_limiters: Dict[str, SlidingWindowRateLimiter] = {}


def get_rate_limiter(
    name: str,
    limit: int = 100,
    window: int = 60
) -> SlidingWindowRateLimiter:
    """Get or create a named rate limiter"""
    if name not in _rate_limiters:
        _rate_limiters[name] = SlidingWindowRateLimiter(limit, window)
    return _rate_limiters[name]


def rate_limit(
    limit: int = 100,
    window: int = 60,
    key_func: Callable = None,
    limiter_name: str = "default"
):
    """
    Rate limiting decorator
    
    Args:
        limit: Maximum requests per window
        window: Window size in seconds
        key_func: Function to extract rate limit key from request
        limiter_name: Name of the rate limiter
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Extract key from request (default to "global")
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = "global"
            
            limiter = get_rate_limiter(limiter_name, limit, window)
            
            if not limiter.is_allowed(key):
                retry_after = limiter.get_reset_time(key)
                raise RateLimitExceeded(
                    f"Rate limit exceeded. Try again in {retry_after} seconds",
                    retry_after=retry_after
                )
            
            return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = "global"
            
            limiter = get_rate_limiter(limiter_name, limit, window)
            
            if not limiter.is_allowed(key):
                retry_after = limiter.get_reset_time(key)
                raise RateLimitExceeded(
                    f"Rate limit exceeded. Try again in {retry_after} seconds",
                    retry_after=retry_after
                )
            
            return func(*args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# FastAPI middleware for rate limiting
class RateLimitMiddleware:
    """ASGI middleware for rate limiting"""
    
    def __init__(
        self,
        app,
        limit: int = 100,
        window: int = 60,
        key_func: Callable = None
    ):
        self.app = app
        self.limiter = SlidingWindowRateLimiter(limit, window)
        self.key_func = key_func or self._default_key
    
    def _default_key(self, scope) -> str:
        """Extract client IP as default key"""
        # Get client IP from scope
        client = scope.get("client")
        if client:
            return client[0]
        
        # Check for X-Forwarded-For header
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"x-forwarded-for":
                return header_value.decode().split(",")[0].strip()
        
        return "unknown"
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        key = self.key_func(scope)
        
        if not self.limiter.is_allowed(key):
            # Return 429 Too Many Requests
            response = {
                "detail": "Rate limit exceeded",
                "retry_after": self.limiter.get_reset_time(key)
            }
            
            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    [b"content-type", b"application/json"],
                    [b"retry-after", str(self.limiter.get_reset_time(key)).encode()],
                    [b"x-ratelimit-limit", str(self.limiter.limit).encode()],
                    [b"x-ratelimit-remaining", b"0"],
                ],
            })
            
            import json
            await send({
                "type": "http.response.body",
                "body": json.dumps(response).encode(),
            })
            return
        
        # Add rate limit headers to response
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend([
                    [b"x-ratelimit-limit", str(self.limiter.limit).encode()],
                    [b"x-ratelimit-remaining", str(self.limiter.get_remaining(key)).encode()],
                    [b"x-ratelimit-reset", str(self.limiter.get_reset_time(key)).encode()],
                ])
                message["headers"] = headers
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


# Distributed rate limiter using Redis
class RedisRateLimiter:
    """Distributed rate limiter using Redis"""
    
    def __init__(self, redis_client, prefix: str = "ratelimit"):
        self.redis = redis_client
        self.prefix = prefix
    
    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int
    ) -> tuple[bool, int, int]:
        """
        Check if request is allowed (distributed)
        
        Returns:
            Tuple of (allowed, remaining, reset_time)
        """
        redis_key = f"{self.prefix}:{key}"
        
        pipe = self.redis.pipeline()
        now = time.time()
        window_start = now - window
        
        # Remove old entries
        pipe.zremrangebyscore(redis_key, 0, window_start)
        # Count current entries
        pipe.zcard(redis_key)
        # Add new entry if allowed
        pipe.zadd(redis_key, {str(now): now})
        # Set expiry
        pipe.expire(redis_key, window)
        
        results = await pipe.execute()
        current_count = results[1]
        
        allowed = current_count < limit
        remaining = max(0, limit - current_count - (1 if allowed else 0))
        
        # Calculate reset time
        if not allowed:
            # Get oldest entry
            oldest = await self.redis.zrange(redis_key, 0, 0, withscores=True)
            if oldest:
                reset_time = int(oldest[0][1] + window - now)
            else:
                reset_time = window
        else:
            reset_time = window
        
        return allowed, remaining, reset_time
