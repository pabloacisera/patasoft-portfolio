import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_pool = None

def get_redis_pool():
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(REDIS_URL, decode_responses=True)
    return _pool

def get_redis_client():
    return redis.Redis(connection_pool=get_redis_pool())
