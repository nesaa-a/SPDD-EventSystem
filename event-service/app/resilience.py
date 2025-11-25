import json
import pathlib
import logging
import time
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from functools import wraps
from typing import Callable, Any, Optional, TypeVar, Type, Dict, List
from tenacity import (
    retry, 
    wait_exponential, 
    stop_after_attempt,
    retry_if_exception_type,
    RetryCallState,
    before_sleep_log
)
import pybreaker
from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

# Metrics
CIRCUIT_STATE = Gauge('circuit_breaker_state', 'Current state of the circuit breaker (0=closed, 1=open, 2=half-open)')
REQUEST_COUNTER = Counter('resilience_requests_total', 'Total requests', ['method', 'status'])
REQUEST_LATENCY = Histogram('request_latency_seconds', 'Request latency in seconds', ['method'])

# Circuit breaker with monitoring
class MonitoredCircuitBreaker(pybreaker.CircuitBreaker):
    def __call__(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            CIRCUIT_STATE.set(0 if self.closed else 1)
            return super().__call__(func, *args, **kwargs)
        return wrapper

# Initialize circuit breaker with monitoring
breaker = MonitoredCircuitBreaker(
    fail_max=5, 
    reset_timeout=30,
    listeners=[
        lambda cb: logger.info(f"Circuit state changed to: {'open' if cb.opened else 'closed'}")
    ]
)

# Bulkhead pattern
class Bulkhead:
    def __init__(self, max_workers: int = 10, max_queue: int = 100):
        self.semaphore = threading.Semaphore(max_workers)
        self.queue_size = 0
        self.max_queue = max_queue
        self.lock = threading.Lock()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    def execute(self, func: Callable, *args, **kwargs):
        with self.lock:
            if self.queue_size >= self.max_queue:
                raise Exception("Bulkhead queue full")
            self.queue_size += 1

        def task():
            try:
                return func(*args, **kwargs)
            finally:
                with self.lock:
                    self.queue_size -= 1
                self.semaphore.release()

        self.semaphore.acquire()
        return self.executor.submit(task)

# Initialize bulkhead for Kafka operations
kafka_bulkhead = Bulkhead(max_workers=5, max_queue=50)

# Fallback directory for failed messages
FALLBACK_DIR = pathlib.Path('/tmp/event_fallback')
FALLBACK_DIR.mkdir(parents=True, exist_ok=True)

def log_retry_attempt(retry_state: RetryCallState) -> None:
    """Log the retry attempt details."""
    if retry_state.attempt_number > 1:
        logger.warning(
            f"Retrying {retry_state.fn.__name__} (attempt {retry_state.attempt_number}): "
            f"{str(retry_state.outcome.exception())}"
        )

@retry(
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((Exception,)),
    before_sleep=log_retry_attempt
)
@breaker
def publish_with_resilience(producer, topic: str, message: Dict[str, Any]) -> Any:
    """Publish message to Kafka with retry and circuit breaker."""
    start_time = time.time()
    try:
        future = kafka_bulkhead.execute(producer.send, topic, value=message)
        result = future.result(timeout=10)
        REQUEST_COUNTER.labels(method='publish', status='success').inc()
        REQUEST_LATENCY.labels(method='publish').observe(time.time() - start_time)
        return result
    except Exception as e:
        REQUEST_COUNTER.labels(method='publish', status='error').inc()
        logger.error(f"Failed to publish message to {topic}: {str(e)}")
        raise

def safe_publish_to_dlq(producer, topic: str, message: Dict[str, Any], reason: Optional[str] = None) -> None:
    """Safely publish to Dead Letter Queue with fallback to local storage."""
    dlq_topic = f"dlq.{topic}"
    try:
        publish_with_resilience(producer, dlq_topic, {"original": message, "reason": reason})
    except Exception as e:
        logger.error(f"Failed to publish to DLQ {dlq_topic}: {str(e)}")
        _save_to_fallback(message, reason, str(e))

def _save_to_fallback(message: Dict[str, Any], reason: Optional[str], error: str) -> None:
    """Save failed message to local filesystem as a last resort."""
    try:
        message_id = message.get('event_id', str(time.time()))
        path = FALLBACK_DIR / f"{message_id}.json"
        
        fallback_data = {
            'timestamp': time.time(),
            'original': message,
            'reason': reason,
            'error': error
        }
        
        with open(path, 'w') as f:
            json.dump(fallback_data, f, indent=2)
        
        logger.warning(f"Saved message to fallback: {path}")
    except Exception as e:
        logger.exception(f"Failed to save message to fallback: {str(e)}")

def publish_safe(producer, topic: str, message: Dict[str, Any]) -> bool:
    """Publish message with comprehensive error handling and fallbacks."""
    try:
        publish_with_resilience(producer, topic, message)
        return True
    except pybreaker.CircuitBreakerError as e:
        logger.error(f"Circuit breaker is open: {str(e)}")
        safe_publish_to_dlq(producer, topic, message, "circuit_breaker_open")
    except Exception as e:
        logger.error(f"Failed to publish message: {str(e)}")
        safe_publish_to_dlq(producer, topic, message, str(e))
    return False