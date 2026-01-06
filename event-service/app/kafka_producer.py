import json
from kafka import KafkaProducer
import time

class KafkaProducerClient:
    def __init__(self, bootstrap_servers="kafka:9092"):
        # retries and acks can be configured here
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            retries=5,
            acks=1,
            request_timeout_ms=30000,
            client_id='event-producer',
            api_version=(3,0,0),
            metadata_max_age_ms=10000
        )

    def publish(self, topic, message):
        future = self.producer.send(topic, value=message)
        result = future.get(timeout=10)  # block until sent or timeout
        return result
