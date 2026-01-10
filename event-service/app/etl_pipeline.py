"""
Simple ETL Pipeline Example
Demonstrates data extraction, transformation, and loading patterns
"""
import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Generator
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor
import schedule
import time

logger = logging.getLogger(__name__)

@dataclass
class PipelineContext:
    """Context passed through pipeline stages"""
    pipeline_id: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    records_extracted: int = 0
    records_transformed: int = 0
    records_loaded: int = 0
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def duration_seconds(self) -> float:
        return (datetime.utcnow() - self.started_at).total_seconds()
    
    def to_dict(self) -> dict:
        return {
            "pipeline_id": self.pipeline_id,
            "started_at": self.started_at.isoformat(),
            "duration_seconds": self.duration_seconds,
            "records_extracted": self.records_extracted,
            "records_transformed": self.records_transformed,
            "records_loaded": self.records_loaded,
            "error_count": len(self.errors),
            "success": len(self.errors) == 0
        }

class Extractor(ABC):
    """Base class for data extractors"""
    
    @abstractmethod
    def extract(self, context: PipelineContext) -> Generator[Dict, None, None]:
        """Extract data and yield records"""
        pass

class Transformer(ABC):
    """Base class for data transformers"""
    
    @abstractmethod
    def transform(self, record: Dict, context: PipelineContext) -> Optional[Dict]:
        """Transform a single record, return None to filter out"""
        pass

class Loader(ABC):
    """Base class for data loaders"""
    
    @abstractmethod
    def load(self, records: List[Dict], context: PipelineContext) -> int:
        """Load records and return count of successfully loaded"""
        pass

# Concrete Implementations

class PostgresExtractor(Extractor):
    """Extract data from PostgreSQL"""
    
    def __init__(self, db_session_factory, query: str, batch_size: int = 1000):
        self.db_session_factory = db_session_factory
        self.query = query
        self.batch_size = batch_size
    
    def extract(self, context: PipelineContext) -> Generator[Dict, None, None]:
        session = self.db_session_factory()
        try:
            result = session.execute(self.query)
            columns = result.keys()
            
            for row in result:
                record = dict(zip(columns, row))
                context.records_extracted += 1
                yield record
                
        except Exception as e:
            context.errors.append(f"Extraction error: {str(e)}")
            logger.error(f"Extraction failed: {e}")
        finally:
            session.close()

class APIExtractor(Extractor):
    """Extract data from an API endpoint"""
    
    def __init__(self, base_url: str, endpoint: str, headers: Dict = None):
        self.base_url = base_url
        self.endpoint = endpoint
        self.headers = headers or {}
    
    def extract(self, context: PipelineContext) -> Generator[Dict, None, None]:
        import httpx
        
        try:
            with httpx.Client() as client:
                response = client.get(
                    f"{self.base_url}{self.endpoint}",
                    headers=self.headers,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                records = data if isinstance(data, list) else data.get("items", [data])
                
                for record in records:
                    context.records_extracted += 1
                    yield record
                    
        except Exception as e:
            context.errors.append(f"API extraction error: {str(e)}")
            logger.error(f"API extraction failed: {e}")

class DataCleaningTransformer(Transformer):
    """Clean and standardize data"""
    
    def __init__(self, required_fields: List[str] = None, field_mappings: Dict[str, str] = None):
        self.required_fields = required_fields or []
        self.field_mappings = field_mappings or {}
    
    def transform(self, record: Dict, context: PipelineContext) -> Optional[Dict]:
        try:
            # Apply field mappings
            transformed = {}
            for old_key, new_key in self.field_mappings.items():
                if old_key in record:
                    transformed[new_key] = record[old_key]
            
            # Copy unmapped fields
            for key, value in record.items():
                if key not in self.field_mappings:
                    transformed[key] = value
            
            # Check required fields
            for field in self.required_fields:
                if field not in transformed or transformed[field] is None:
                    logger.warning(f"Missing required field: {field}")
                    return None
            
            # Clean string values
            for key, value in transformed.items():
                if isinstance(value, str):
                    transformed[key] = value.strip()
            
            context.records_transformed += 1
            return transformed
            
        except Exception as e:
            context.errors.append(f"Transform error: {str(e)}")
            return None

class EnrichmentTransformer(Transformer):
    """Enrich records with additional data"""
    
    def __init__(self, enrichment_func):
        self.enrichment_func = enrichment_func
    
    def transform(self, record: Dict, context: PipelineContext) -> Optional[Dict]:
        try:
            enriched = self.enrichment_func(record)
            context.records_transformed += 1
            return enriched
        except Exception as e:
            context.errors.append(f"Enrichment error: {str(e)}")
            return record  # Return original on failure

class MongoLoader(Loader):
    """Load data into MongoDB"""
    
    def __init__(self, mongo_client, database: str, collection: str):
        self.client = mongo_client
        self.database = database
        self.collection = collection
    
    def load(self, records: List[Dict], context: PipelineContext) -> int:
        if not records:
            return 0
        
        try:
            db = self.client[self.database]
            coll = db[self.collection]
            
            result = coll.insert_many(records, ordered=False)
            loaded = len(result.inserted_ids)
            context.records_loaded += loaded
            return loaded
            
        except Exception as e:
            context.errors.append(f"Load error: {str(e)}")
            logger.error(f"Loading failed: {e}")
            return 0

class ElasticsearchLoader(Loader):
    """Load data into Elasticsearch"""
    
    def __init__(self, es_client, index: str):
        self.client = es_client
        self.index = index
    
    def load(self, records: List[Dict], context: PipelineContext) -> int:
        if not records:
            return 0
        
        try:
            from elasticsearch import helpers
            
            actions = [
                {
                    "_index": self.index,
                    "_id": record.get("id"),
                    "_source": record
                }
                for record in records
            ]
            
            success, _ = helpers.bulk(self.client, actions, raise_on_error=False)
            context.records_loaded += success
            return success
            
        except Exception as e:
            context.errors.append(f"ES Load error: {str(e)}")
            logger.error(f"ES loading failed: {e}")
            return 0

class ETLPipeline:
    """
    ETL Pipeline orchestrator
    
    Features:
    - Configurable extractors, transformers, and loaders
    - Batch processing
    - Error handling and retry
    - Metrics and monitoring
    """
    
    def __init__(
        self,
        name: str,
        extractor: Extractor,
        transformers: List[Transformer],
        loader: Loader,
        batch_size: int = 100
    ):
        self.name = name
        self.extractor = extractor
        self.transformers = transformers
        self.loader = loader
        self.batch_size = batch_size
    
    def run(self) -> PipelineContext:
        """Execute the ETL pipeline"""
        context = PipelineContext(pipeline_id=f"{self.name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")
        
        logger.info(f"Starting pipeline: {self.name}")
        
        try:
            batch = []
            
            # Extract and transform
            for record in self.extractor.extract(context):
                # Apply all transformers
                transformed = record
                for transformer in self.transformers:
                    if transformed is None:
                        break
                    transformed = transformer.transform(transformed, context)
                
                if transformed is not None:
                    batch.append(transformed)
                
                # Load in batches
                if len(batch) >= self.batch_size:
                    self.loader.load(batch, context)
                    batch = []
            
            # Load remaining records
            if batch:
                self.loader.load(batch, context)
            
            logger.info(f"Pipeline completed: {context.to_dict()}")
            
        except Exception as e:
            context.errors.append(f"Pipeline error: {str(e)}")
            logger.error(f"Pipeline failed: {e}")
        
        return context

class PipelineScheduler:
    """Schedule ETL pipelines to run at specific intervals"""
    
    def __init__(self):
        self.pipelines: Dict[str, ETLPipeline] = {}
        self._running = False
    
    def register(self, pipeline: ETLPipeline, interval_minutes: int = 60):
        """Register a pipeline to run at specified interval"""
        self.pipelines[pipeline.name] = pipeline
        schedule.every(interval_minutes).minutes.do(pipeline.run)
        logger.info(f"Registered pipeline {pipeline.name} to run every {interval_minutes} minutes")
    
    def run_once(self, pipeline_name: str) -> Optional[PipelineContext]:
        """Run a specific pipeline once"""
        pipeline = self.pipelines.get(pipeline_name)
        if pipeline:
            return pipeline.run()
        return None
    
    def start(self):
        """Start the scheduler"""
        self._running = True
        logger.info("Pipeline scheduler started")
        
        while self._running:
            schedule.run_pending()
            time.sleep(1)
    
    def stop(self):
        """Stop the scheduler"""
        self._running = False
        logger.info("Pipeline scheduler stopped")

# Example pipeline for syncing events to analytics
def create_events_analytics_pipeline(pg_session_factory, mongo_client) -> ETLPipeline:
    """Create pipeline to sync events from Postgres to MongoDB analytics"""
    
    extractor = PostgresExtractor(
        db_session_factory=pg_session_factory,
        query="""
            SELECT e.*, 
                   COUNT(p.id) as participant_count,
                   COUNT(CASE WHEN p.checked_in THEN 1 END) as checked_in_count
            FROM events e
            LEFT JOIN participants p ON e.id = p.event_id
            WHERE e.updated_at > NOW() - INTERVAL '1 hour'
            GROUP BY e.id
        """
    )
    
    transformers = [
        DataCleaningTransformer(
            required_fields=["id", "title"],
            field_mappings={"id": "event_id"}
        ),
        EnrichmentTransformer(
            enrichment_func=lambda r: {
                **r,
                "fill_rate": (r.get("participant_count", 0) / r.get("seats", 1)) * 100 if r.get("seats") else 0,
                "check_in_rate": (r.get("checked_in_count", 0) / r.get("participant_count", 1)) * 100 if r.get("participant_count") else 0,
                "synced_at": datetime.utcnow().isoformat()
            }
        )
    ]
    
    loader = MongoLoader(
        mongo_client=mongo_client,
        database="analytics",
        collection="events_analytics"
    )
    
    return ETLPipeline(
        name="events_to_analytics",
        extractor=extractor,
        transformers=transformers,
        loader=loader,
        batch_size=100
    )
