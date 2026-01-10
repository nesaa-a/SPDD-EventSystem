"""
Redis Caching Module
Implements write-through and write-behind caching strategies
"""
import os
import json
import asyncio
import logging
from typing import Optional, Any, Callable
from functools import wraps
from datetime import timedelta
import redis
from redis import Redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Redis connection pool
redis_client: Optional[Redis] = None

def get_redis() -> Redis:
    """Get Redis client with connection pooling"""
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True
        )
    return redis_client

def check_redis_health() -> bool:
    """Check if Redis is available"""
    try:
        client = get_redis()
        return client.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False

class CacheManager:
    """
    Cache manager with multiple caching strategies:
    - Write-through: Write to cache and DB simultaneously
    - Write-behind: Write to cache immediately, DB asynchronously
    - Read-through: Check cache first, then DB
    """
    
    def __init__(self, prefix: str = "spdd"):
        self.prefix = prefix
        self.default_ttl = 3600  # 1 hour
    
    def _make_key(self, key: str) -> str:
        return f"{self.prefix}:{key}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            client = get_redis()
            data = client.get(self._make_key(key))
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache"""
        try:
            client = get_redis()
            ttl = ttl or self.default_ttl
            return client.setex(
                self._make_key(key),
                ttl,
                json.dumps(value, default=str)
            )
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            client = get_redis()
            return bool(client.delete(self._make_key(key)))
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        try:
            client = get_redis()
            keys = client.keys(self._make_key(pattern))
            if keys:
                return client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache invalidate error: {e}")
            return 0

# Global cache manager instance
cache = CacheManager()

class CacheManagerWithClient(CacheManager):
    """Extended cache manager that exposes the Redis client"""
    
    @property
    def client(self) -> Redis:
        return get_redis()

# Export as cache_manager for API usage
cache_manager = CacheManagerWithClient()

def cached(key_pattern: str, ttl: int = 3600):
    """
    Decorator for caching function results (Read-through caching)
    
    Usage:
        @cached("events:{event_id}", ttl=300)
        def get_event(event_id: int):
            return db.query(Event).get(event_id)
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from pattern and arguments
            cache_key = key_pattern.format(*args, **kwargs)
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {cache_key}")
            
            # Get from source
            result = func(*args, **kwargs)
            
            # Store in cache
            if result is not None:
                cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

def cache_invalidate(key_pattern: str):
    """
    Decorator to invalidate cache after function execution
    
    Usage:
        @cache_invalidate("events:*")
        def create_event(event_data):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            cache.invalidate_pattern(key_pattern)
            return result
        return wrapper
    return decorator

# Write-behind queue for async DB writes
class WriteBehindQueue:
    """Async write-behind queue for deferred database writes"""
    
    def __init__(self):
        self.queue_key = "spdd:write_behind_queue"
    
    def enqueue(self, operation: dict):
        """Add operation to write-behind queue"""
        try:
            client = get_redis()
            client.rpush(self.queue_key, json.dumps(operation, default=str))
        except Exception as e:
            logger.error(f"Write-behind enqueue error: {e}")
    
    def process_queue(self, handler: Callable):
        """Process pending write operations"""
        try:
            client = get_redis()
            while True:
                item = client.lpop(self.queue_key)
                if not item:
                    break
                operation = json.loads(item)
                handler(operation)
        except Exception as e:
            logger.error(f"Write-behind process error: {e}")

write_behind = WriteBehindQueue()
