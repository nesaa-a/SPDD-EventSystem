from flask import Flask, request, jsonify

app = Flask(__name__)

# Memory DB (temporary)
events = []

@app.route("/")
def home():
    return {"status": "Event Service RUNNING (local mode)"}

@app.route("/events", methods=["POST"])
def create_event():
    data = request.json
    event_id = len(events) + 1
    data["id"] = event_id
    events.append(data)
    return {"message": "Event received locally", "id": event_id}

@app.route("/events", methods=["GET"])
def get_events():
    return {"events": events}

if __name__ == "__main__":
    app.run(debug=True, port=5000)
