import os
import json
from kafka import KafkaConsumer
from .mongo_client import get_db

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
TOPIC = "event.created"

def consume():
    consumer = KafkaConsumer(
        TOPIC,
        bootstrap_servers=[KAFKA_BROKER],
        auto_offset_reset='earliest',
        enable_auto_commit=True,
        group_id='analytics-group',
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    db = get_db()
    coll = db.events_analytics
    print("Analytics consumer started, listening for events...")
    for msg in consumer:
        data = msg.value
        print("Received:", data)
        # store in Mongo for analytics
        coll.insert_one({"event_id": data["id"], "title": data["title"], "ts": data.get("date")})

if __name__ == "__main__":
    consume()
