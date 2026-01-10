"""
Distributed Tracing with OpenTelemetry
Integrates with Jaeger for trace visualization
"""
import os
import logging
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from contextlib import contextmanager
from functools import wraps
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Configuration
JAEGER_HOST = os.getenv("JAEGER_HOST", "jaeger")
JAEGER_PORT = int(os.getenv("JAEGER_PORT", "6831"))
OTLP_ENDPOINT = os.getenv("OTLP_ENDPOINT", "http://jaeger:4317")
SERVICE_NAME_ENV = os.getenv("SERVICE_NAME", "event-service")
TRACING_ENABLED = os.getenv("TRACING_ENABLED", "true").lower() == "true"

# Global tracer
_tracer: Optional[trace.Tracer] = None

def setup_tracing(app=None, db_engine=None):
    """
    Initialize OpenTelemetry tracing with Jaeger exporter
    
    Args:
        app: FastAPI application instance
        db_engine: SQLAlchemy engine for DB tracing
    """
    global _tracer
    
    if not TRACING_ENABLED:
        logger.info("Tracing is disabled")
        return
    
    try:
        # Create resource with service name
        resource = Resource.create({
            SERVICE_NAME: SERVICE_NAME_ENV,
            "service.version": "1.0.0",
            "deployment.environment": os.getenv("ENVIRONMENT", "development")
        })
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        
        # Configure Jaeger exporter
        jaeger_exporter = JaegerExporter(
            agent_host_name=JAEGER_HOST,
            agent_port=JAEGER_PORT,
        )
        
        # Add batch processor for better performance
        provider.add_span_processor(
            BatchSpanProcessor(jaeger_exporter)
        )
        
        # Set global tracer provider
        trace.set_tracer_provider(provider)
        
        # Set B3 propagation format (for Istio compatibility)
        set_global_textmap(B3MultiFormat())
        
        # Get tracer instance
        _tracer = trace.get_tracer(__name__)
        
        # Instrument FastAPI
        if app:
            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI instrumented for tracing")
        
        # Instrument SQLAlchemy
        if db_engine:
            SQLAlchemyInstrumentor().instrument(engine=db_engine)
            logger.info("SQLAlchemy instrumented for tracing")
        
        # Instrument Redis
        RedisInstrumentor().instrument()
        logger.info("Redis instrumented for tracing")
        
        # Instrument HTTP client
        HTTPXClientInstrumentor().instrument()
        
        # Instrument logging
        LoggingInstrumentor().instrument(set_logging_format=True)
        
        logger.info(f"Tracing initialized - Jaeger: {JAEGER_HOST}:{JAEGER_PORT}")
        
    except Exception as e:
        logger.error(f"Failed to initialize tracing: {e}")

def get_tracer() -> trace.Tracer:
    """Get the global tracer instance"""
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer(__name__)
    return _tracer

@contextmanager
def create_span(name: str, attributes: Dict[str, Any] = None):
    """
    Context manager for creating a traced span
    
    Usage:
        with create_span("process_event", {"event_id": 123}):
            # Your code here
            pass
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, str(value))
        try:
            yield span
        except Exception as e:
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            raise

def traced(name: str = None, attributes: Dict[str, Any] = None):
    """
    Decorator for tracing function execution
    
    Usage:
        @traced("create_event")
        def create_event(data):
            ...
    """
    def decorator(func):
        span_name = name or func.__name__
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            with create_span(span_name, attributes) as span:
                # Add function arguments as span attributes
                span.set_attribute("function.name", func.__name__)
                span.set_attribute("function.args_count", len(args))
                
                result = func(*args, **kwargs)
                
                span.set_attribute("function.success", True)
                return result
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            with create_span(span_name, attributes) as span:
                span.set_attribute("function.name", func.__name__)
                span.set_attribute("function.args_count", len(args))
                
                result = await func(*args, **kwargs)
                
                span.set_attribute("function.success", True)
                return result
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return wrapper
    
    return decorator

def add_span_attributes(attributes: Dict[str, Any]):
    """Add attributes to the current span"""
    span = trace.get_current_span()
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, str(value))

def record_exception(exception: Exception):
    """Record an exception in the current span"""
    span = trace.get_current_span()
    if span:
        span.set_attribute("error", True)
        span.record_exception(exception)
