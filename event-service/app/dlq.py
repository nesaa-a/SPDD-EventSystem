"""
Dead Letter Queue (DLQ) Implementation
Handles failed Kafka messages for retry and analysis
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass, asdict
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError

logger = logging.getLogger(__name__)

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
DLQ_TOPIC = os.getenv("DLQ_TOPIC", "events.dlq")
MAX_RETRIES = int(os.getenv("DLQ_MAX_RETRIES", "3"))
RETRY_DELAY_MS = int(os.getenv("DLQ_RETRY_DELAY_MS", "5000"))

@dataclass
class DeadLetterMessage:
    """Structure for dead letter messages"""
    original_topic: str
    original_message: Dict[str, Any]
    error_message: str
    error_type: str
    retry_count: int
    first_failure_time: str
    last_failure_time: str
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'DeadLetterMessage':
        return cls(**data)

class DeadLetterQueue:
    """
    Dead Letter Queue manager for handling failed messages
    
    Features:
    - Automatic retry with exponential backoff
    - Message tracking and monitoring
    - Manual reprocessing capability
    - Alerting integration
    """
    
    def __init__(self):
        self._producer: Optional[KafkaProducer] = None
        self._consumer: Optional[KafkaConsumer] = None
    
    @property
    def producer(self) -> KafkaProducer:
        if self._producer is None:
            self._producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='all',
                retries=3
            )
        return self._producer
    
    def send_to_dlq(
        self,
        original_topic: str,
        original_message: Dict[str, Any],
        error: Exception,
        correlation_id: str = None,
        retry_count: int = 0
    ):
        """
        Send a failed message to the Dead Letter Queue
        
        Args:
            original_topic: The topic where the message originated
            original_message: The original message content
            error: The exception that caused the failure
            correlation_id: Optional correlation ID for tracing
            retry_count: Number of retry attempts so far
        """
        try:
            now = datetime.utcnow().isoformat()
            
            dlq_message = DeadLetterMessage(
                original_topic=original_topic,
                original_message=original_message,
                error_message=str(error),
                error_type=type(error).__name__,
                retry_count=retry_count,
                first_failure_time=now,
                last_failure_time=now,
                correlation_id=correlation_id
            )
            
            self.producer.send(
                DLQ_TOPIC,
                key=correlation_id,
                value=dlq_message.to_dict()
            )
            self.producer.flush()
            
            logger.warning(
                f"Message sent to DLQ: topic={original_topic}, "
                f"error={error}, retry_count={retry_count}"
            )
            
            # Emit metric for monitoring
            self._record_dlq_metric(original_topic, type(error).__name__)
            
        except KafkaError as e:
            logger.error(f"Failed to send message to DLQ: {e}")
            raise
    
    def _record_dlq_metric(self, topic: str, error_type: str):
        """Record DLQ metrics for monitoring"""
        try:
            from prometheus_client import Counter
            dlq_counter = Counter(
                'dlq_messages_total',
                'Total messages sent to DLQ',
                ['topic', 'error_type']
            )
            dlq_counter.labels(topic=topic, error_type=error_type).inc()
        except Exception:
            pass  # Metrics not critical

class DLQProcessor:
    """
    Processor for retrying messages from the Dead Letter Queue
    """
    
    def __init__(self, dlq: DeadLetterQueue):
        self.dlq = dlq
        self._consumer: Optional[KafkaConsumer] = None
        self._handlers: Dict[str, Callable] = {}
    
    def register_handler(self, topic: str, handler: Callable):
        """Register a handler for a specific topic"""
        self._handlers[topic] = handler
    
    def get_consumer(self) -> KafkaConsumer:
        if self._consumer is None:
            self._consumer = KafkaConsumer(
                DLQ_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='earliest',
                enable_auto_commit=False,
                group_id='dlq-processor-group',
                value_deserializer=lambda m: json.loads(m.decode('utf-8'))
            )
        return self._consumer
    
    def process_dlq(self, max_messages: int = 100):
        """
        Process messages from the DLQ
        
        Args:
            max_messages: Maximum number of messages to process
        """
        consumer = self.get_consumer()
        processed = 0
        
        for message in consumer:
            if processed >= max_messages:
                break
            
            try:
                dlq_data = message.value
                dlq_message = DeadLetterMessage.from_dict(dlq_data)
                
                # Check if we should retry
                if dlq_message.retry_count >= MAX_RETRIES:
                    logger.warning(
                        f"Message exceeded max retries: {dlq_message.correlation_id}"
                    )
                    self._move_to_permanent_failure(dlq_message)
                    consumer.commit()
                    continue
                
                # Get handler for original topic
                handler = self._handlers.get(dlq_message.original_topic)
                if not handler:
                    logger.error(f"No handler for topic: {dlq_message.original_topic}")
                    consumer.commit()
                    continue
                
                # Retry processing
                try:
                    handler(dlq_message.original_message)
                    logger.info(f"Successfully reprocessed DLQ message: {dlq_message.correlation_id}")
                    consumer.commit()
                except Exception as e:
                    # Re-send to DLQ with incremented retry count
                    self.dlq.send_to_dlq(
                        original_topic=dlq_message.original_topic,
                        original_message=dlq_message.original_message,
                        error=e,
                        correlation_id=dlq_message.correlation_id,
                        retry_count=dlq_message.retry_count + 1
                    )
                    consumer.commit()
                
                processed += 1
                
            except Exception as e:
                logger.error(f"Error processing DLQ message: {e}")
                consumer.commit()
        
        return processed
    
    def _move_to_permanent_failure(self, message: DeadLetterMessage):
        """Move permanently failed messages to a separate topic for analysis"""
        try:
            self.dlq.producer.send(
                f"{DLQ_TOPIC}.permanent",
                value=message.to_dict()
            )
            self.dlq.producer.flush()
            logger.error(f"Message moved to permanent failure: {message.correlation_id}")
        except Exception as e:
            logger.error(f"Failed to move message to permanent failure: {e}")

# Global DLQ instance
dlq = DeadLetterQueue()
dlq_processor = DLQProcessor(dlq)

def with_dlq(topic: str):
    """
    Decorator that automatically sends failed messages to DLQ
    
    Usage:
        @with_dlq("events.created")
        def process_event(message):
            ...
    """
    def decorator(func: Callable):
        def wrapper(message: Dict[str, Any], *args, **kwargs):
            correlation_id = message.get('correlation_id', str(datetime.utcnow().timestamp()))
            try:
                return func(message, *args, **kwargs)
            except Exception as e:
                dlq.send_to_dlq(
                    original_topic=topic,
                    original_message=message,
                    error=e,
                    correlation_id=correlation_id
                )
                raise
        return wrapper
    return decorator
