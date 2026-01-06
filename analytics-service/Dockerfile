FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

# Run the analytics consumer module directly. The repository places the consumer
# at `app/consumer.py`, so run it as a module.
CMD ["python", "-m", "app.consumer"]
