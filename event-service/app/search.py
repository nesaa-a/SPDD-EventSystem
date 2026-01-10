"""
Full-text Search Module using Elasticsearch
Provides advanced search capabilities for events
"""
import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import NotFoundError, ConnectionError

logger = logging.getLogger(__name__)

ES_HOST = os.getenv("ELASTICSEARCH_HOST", "elasticsearch")
ES_PORT = int(os.getenv("ELASTICSEARCH_PORT", "9200"))
ES_INDEX = os.getenv("ES_EVENTS_INDEX", "events")

@dataclass
class SearchResult:
    """Search result with relevance score"""
    id: int
    title: str
    description: str
    location: str
    category: str
    date: str
    score: float
    highlights: Dict[str, List[str]]

class ElasticsearchClient:
    """
    Elasticsearch client for full-text search capabilities
    
    Features:
    - Full-text search with relevance scoring
    - Fuzzy matching for typos
    - Highlighting of matched terms
    - Faceted search (aggregations)
    - Auto-complete suggestions
    """
    
    def __init__(self):
        self._client: Optional[Elasticsearch] = None
        self._index_created = False
    
    @property
    def client(self) -> Elasticsearch:
        if self._client is None:
            # Elasticsearch 8.x connection format
            self._client = Elasticsearch(
                f"http://{ES_HOST}:{ES_PORT}",
                retry_on_timeout=True,
                max_retries=3
            )
        return self._client
    
    def is_available(self) -> bool:
        """Check if Elasticsearch is available"""
        try:
            return self.client.ping()
        except ConnectionError:
            logger.warning("Elasticsearch is not available")
            return False
    
    def create_index(self):
        """Create the events index with proper mappings"""
        if self._index_created:
            return
        
        if not self.is_available():
            logger.warning("Skipping index creation - Elasticsearch unavailable")
            return
        
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "event_analyzer": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": ["lowercase", "asciifolding", "snowball"]
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "title": {
                        "type": "text",
                        "analyzer": "event_analyzer",
                        "fields": {
                            "keyword": {"type": "keyword"},
                            "suggest": {
                                "type": "completion",
                                "analyzer": "simple"
                            }
                        }
                    },
                    "description": {
                        "type": "text",
                        "analyzer": "event_analyzer"
                    },
                    "location": {
                        "type": "text",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "category": {"type": "keyword"},
                    "date": {"type": "date"},
                    "organizer": {"type": "text"},
                    "seats": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            }
        }
        
        try:
            if not self.client.indices.exists(index=ES_INDEX):
                self.client.indices.create(index=ES_INDEX, body=mapping)
                logger.info(f"Created Elasticsearch index: {ES_INDEX}")
            self._index_created = True
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
    
    def index_event(self, event: Dict[str, Any]):
        """Index a single event document"""
        if not self.is_available():
            return
        
        self.create_index()
        
        try:
            self.client.index(
                index=ES_INDEX,
                id=event["id"],
                body=event,
                refresh=True
            )
            logger.debug(f"Indexed event: {event['id']}")
        except Exception as e:
            logger.error(f"Failed to index event {event.get('id')}: {e}")
    
    def bulk_index_events(self, events: List[Dict[str, Any]]):
        """Bulk index multiple events"""
        if not self.is_available() or not events:
            return
        
        self.create_index()
        
        actions = [
            {
                "_index": ES_INDEX,
                "_id": event["id"],
                "_source": event
            }
            for event in events
        ]
        
        try:
            success, errors = helpers.bulk(self.client, actions, raise_on_error=False)
            logger.info(f"Bulk indexed {success} events, {len(errors)} errors")
        except Exception as e:
            logger.error(f"Bulk indexing failed: {e}")
    
    def delete_event(self, event_id: int):
        """Delete an event from the index"""
        if not self.is_available():
            return
        
        try:
            self.client.delete(index=ES_INDEX, id=event_id, refresh=True)
            logger.debug(f"Deleted event from index: {event_id}")
        except NotFoundError:
            pass
        except Exception as e:
            logger.error(f"Failed to delete event {event_id}: {e}")
    
    def search(
        self,
        query: str,
        category: str = None,
        location: str = None,
        date_from: str = None,
        date_to: str = None,
        page: int = 1,
        size: int = 10
    ) -> Dict[str, Any]:
        """
        Full-text search with filters and highlighting
        
        Args:
            query: Search query string
            category: Filter by category
            location: Filter by location
            date_from: Filter events from this date
            date_to: Filter events until this date
            page: Page number (1-indexed)
            size: Results per page
            
        Returns:
            Dict with results, total count, and aggregations
        """
        if not self.is_available():
            return {"results": [], "total": 0, "aggregations": {}}
        
        # Build query
        must_clauses = []
        filter_clauses = []
        
        if query:
            must_clauses.append({
                "multi_match": {
                    "query": query,
                    "fields": ["title^3", "description^2", "location", "organizer"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                    "prefix_length": 2
                }
            })
        
        if category:
            filter_clauses.append({"term": {"category": category}})
        
        if location:
            filter_clauses.append({
                "match": {"location": {"query": location, "fuzziness": "AUTO"}}
            })
        
        if date_from or date_to:
            date_range = {"range": {"date": {}}}
            if date_from:
                date_range["range"]["date"]["gte"] = date_from
            if date_to:
                date_range["range"]["date"]["lte"] = date_to
            filter_clauses.append(date_range)
        
        # Construct search body
        search_body = {
            "query": {
                "bool": {
                    "must": must_clauses if must_clauses else [{"match_all": {}}],
                    "filter": filter_clauses
                }
            },
            "highlight": {
                "fields": {
                    "title": {"number_of_fragments": 0},
                    "description": {"number_of_fragments": 3, "fragment_size": 150}
                },
                "pre_tags": ["<mark>"],
                "post_tags": ["</mark>"]
            },
            "aggs": {
                "categories": {"terms": {"field": "category", "size": 20}},
                "locations": {"terms": {"field": "location.keyword", "size": 20}},
                "date_histogram": {
                    "date_histogram": {
                        "field": "date",
                        "calendar_interval": "month"
                    }
                }
            },
            "from": (page - 1) * size,
            "size": size,
            "sort": [
                {"_score": "desc"},
                {"date": "asc"}
            ]
        }
        
        try:
            response = self.client.search(index=ES_INDEX, body=search_body)
            
            results = []
            for hit in response["hits"]["hits"]:
                source = hit["_source"]
                results.append(SearchResult(
                    id=source.get("id"),
                    title=source.get("title", ""),
                    description=source.get("description", ""),
                    location=source.get("location", ""),
                    category=source.get("category", ""),
                    date=source.get("date", ""),
                    score=hit["_score"],
                    highlights=hit.get("highlight", {})
                ))
            
            return {
                "results": results,
                "total": response["hits"]["total"]["value"],
                "aggregations": {
                    "categories": [
                        {"name": b["key"], "count": b["doc_count"]}
                        for b in response["aggregations"]["categories"]["buckets"]
                    ],
                    "locations": [
                        {"name": b["key"], "count": b["doc_count"]}
                        for b in response["aggregations"]["locations"]["buckets"]
                    ]
                }
            }
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {"results": [], "total": 0, "aggregations": {}}
    
    def suggest(self, prefix: str, size: int = 5) -> List[str]:
        """
        Auto-complete suggestions for event titles
        
        Args:
            prefix: The prefix to complete
            size: Number of suggestions to return
        """
        if not self.is_available() or not prefix:
            return []
        
        try:
            response = self.client.search(
                index=ES_INDEX,
                body={
                    "suggest": {
                        "title-suggest": {
                            "prefix": prefix,
                            "completion": {
                                "field": "title.suggest",
                                "size": size,
                                "fuzzy": {"fuzziness": 1}
                            }
                        }
                    }
                }
            )
            
            suggestions = response["suggest"]["title-suggest"][0]["options"]
            return [s["text"] for s in suggestions]
            
        except Exception as e:
            logger.error(f"Suggestion failed: {e}")
            return []

# Global search client instance
search_client = ElasticsearchClient()
search_service = search_client  # Alias for compatibility
