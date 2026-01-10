"""
Analytics and Data Mining Module
Implements clustering, statistics, and predictive analytics
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import Counter, defaultdict
import math

logger = logging.getLogger(__name__)

@dataclass
class AnalyticsResult:
    """Result container for analytics operations"""
    metric_name: str
    value: Any
    timestamp: str
    details: Dict[str, Any] = None
    
    def to_dict(self) -> dict:
        return {
            "metric_name": self.metric_name,
            "value": self.value,
            "timestamp": self.timestamp,
            "details": self.details or {}
        }

class EventAnalytics:
    """
    Analytics engine for event data
    
    Features:
    - Descriptive statistics
    - Time series analysis
    - Category distribution
    - Trend detection
    - Anomaly detection
    """
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
    
    def get_summary_statistics(self) -> Dict[str, Any]:
        """Get overall summary statistics"""
        session = self.db_session_factory()
        try:
            from .models import Event, Participant
            
            total_events = session.query(Event).count()
            total_participants = session.query(Participant).count()
            
            # Events by category
            category_counts = session.execute("""
                SELECT category, COUNT(*) as count 
                FROM events 
                WHERE category IS NOT NULL 
                GROUP BY category
            """).fetchall()
            
            # Average participants per event
            avg_participants = session.execute("""
                SELECT AVG(participant_count) FROM (
                    SELECT event_id, COUNT(*) as participant_count 
                    FROM participants 
                    GROUP BY event_id
                ) subq
            """).scalar() or 0
            
            # Fill rate statistics
            fill_stats = session.execute("""
                SELECT 
                    AVG(CAST(participant_count AS FLOAT) / NULLIF(seats, 0) * 100) as avg_fill_rate,
                    MIN(CAST(participant_count AS FLOAT) / NULLIF(seats, 0) * 100) as min_fill_rate,
                    MAX(CAST(participant_count AS FLOAT) / NULLIF(seats, 0) * 100) as max_fill_rate
                FROM (
                    SELECT e.id, e.seats, COUNT(p.id) as participant_count
                    FROM events e
                    LEFT JOIN participants p ON e.id = p.event_id
                    GROUP BY e.id, e.seats
                ) subq
            """).fetchone()
            
            return {
                "total_events": total_events,
                "total_participants": total_participants,
                "average_participants_per_event": round(float(avg_participants), 2),
                "category_distribution": {row[0]: row[1] for row in category_counts},
                "fill_rate": {
                    "average": round(float(fill_stats[0] or 0), 2),
                    "minimum": round(float(fill_stats[1] or 0), 2),
                    "maximum": round(float(fill_stats[2] or 0), 2)
                },
                "generated_at": datetime.utcnow().isoformat()
            }
        finally:
            session.close()
    
    def get_time_series_data(
        self, 
        metric: str = "events",
        interval: str = "day",
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get time series data for trend analysis"""
        session = self.db_session_factory()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            if metric == "events":
                query = f"""
                    SELECT DATE_TRUNC('{interval}', created_at) as period,
                           COUNT(*) as count
                    FROM events
                    WHERE created_at >= :start_date
                    GROUP BY period
                    ORDER BY period
                """
            elif metric == "registrations":
                query = f"""
                    SELECT DATE_TRUNC('{interval}', created_at) as period,
                           COUNT(*) as count
                    FROM participants
                    WHERE created_at >= :start_date
                    GROUP BY period
                    ORDER BY period
                """
            else:
                return []
            
            results = session.execute(query, {"start_date": start_date}).fetchall()
            
            return [
                {
                    "period": row[0].isoformat() if row[0] else None,
                    "count": row[1]
                }
                for row in results
            ]
        except Exception as e:
            logger.error(f"Time series query failed: {e}")
            return []
        finally:
            session.close()
    
    def detect_trends(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect trends in time series data"""
        if len(data) < 3:
            return {"trend": "insufficient_data", "slope": 0}
        
        # Simple linear regression
        n = len(data)
        x = list(range(n))
        y = [d.get("count", 0) for d in data]
        
        x_mean = sum(x) / n
        y_mean = sum(y) / n
        
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        slope = numerator / denominator if denominator != 0 else 0
        
        # Classify trend
        if slope > 0.5:
            trend = "strongly_increasing"
        elif slope > 0.1:
            trend = "increasing"
        elif slope < -0.5:
            trend = "strongly_decreasing"
        elif slope < -0.1:
            trend = "decreasing"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "slope": round(slope, 4),
            "data_points": n
        }

class SimpleKMeans:
    """
    Simple K-Means clustering implementation
    For grouping events or participants by characteristics
    """
    
    def __init__(self, k: int = 3, max_iterations: int = 100):
        self.k = k
        self.max_iterations = max_iterations
        self.centroids: List[List[float]] = []
        self.labels: List[int] = []
    
    def _euclidean_distance(self, a: List[float], b: List[float]) -> float:
        """Calculate Euclidean distance between two points"""
        return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(len(a))))
    
    def _initialize_centroids(self, data: List[List[float]]) -> List[List[float]]:
        """Initialize centroids using k-means++ method"""
        import random
        
        centroids = [random.choice(data)]
        
        for _ in range(1, self.k):
            distances = []
            for point in data:
                min_dist = min(self._euclidean_distance(point, c) for c in centroids)
                distances.append(min_dist ** 2)
            
            total = sum(distances)
            probs = [d / total for d in distances]
            
            cumulative = 0
            r = random.random()
            for i, prob in enumerate(probs):
                cumulative += prob
                if cumulative >= r:
                    centroids.append(data[i])
                    break
        
        return centroids
    
    def fit(self, data: List[List[float]]) -> 'SimpleKMeans':
        """Fit the K-Means model to data"""
        if len(data) < self.k:
            raise ValueError(f"Need at least {self.k} data points")
        
        self.centroids = self._initialize_centroids(data)
        
        for _ in range(self.max_iterations):
            # Assign points to nearest centroid
            new_labels = []
            for point in data:
                distances = [self._euclidean_distance(point, c) for c in self.centroids]
                new_labels.append(distances.index(min(distances)))
            
            # Check for convergence
            if new_labels == self.labels:
                break
            
            self.labels = new_labels
            
            # Update centroids
            for i in range(self.k):
                cluster_points = [data[j] for j in range(len(data)) if self.labels[j] == i]
                if cluster_points:
                    n_features = len(cluster_points[0])
                    self.centroids[i] = [
                        sum(p[f] for p in cluster_points) / len(cluster_points)
                        for f in range(n_features)
                    ]
        
        return self
    
    def predict(self, data: List[List[float]]) -> List[int]:
        """Predict cluster labels for new data"""
        labels = []
        for point in data:
            distances = [self._euclidean_distance(point, c) for c in self.centroids]
            labels.append(distances.index(min(distances)))
        return labels
    
    def get_cluster_stats(self, data: List[List[float]]) -> List[Dict[str, Any]]:
        """Get statistics for each cluster"""
        stats = []
        for i in range(self.k):
            cluster_points = [data[j] for j in range(len(data)) if self.labels[j] == i]
            
            if cluster_points:
                n_features = len(cluster_points[0])
                stats.append({
                    "cluster_id": i,
                    "size": len(cluster_points),
                    "centroid": self.centroids[i],
                    "feature_means": [
                        round(sum(p[f] for p in cluster_points) / len(cluster_points), 2)
                        for f in range(n_features)
                    ]
                })
            else:
                stats.append({
                    "cluster_id": i,
                    "size": 0,
                    "centroid": self.centroids[i],
                    "feature_means": []
                })
        
        return stats

class AssociationRuleMiner:
    """
    Simple Apriori-like association rule mining
    For finding patterns like "users who attend Workshop events also attend Meetups"
    """
    
    def __init__(self, min_support: float = 0.1, min_confidence: float = 0.5):
        self.min_support = min_support
        self.min_confidence = min_confidence
        self.frequent_itemsets: Dict[frozenset, int] = {}
        self.rules: List[Dict] = []
    
    def _get_support(self, itemset: frozenset, transactions: List[set]) -> float:
        """Calculate support for an itemset"""
        count = sum(1 for t in transactions if itemset.issubset(t))
        return count / len(transactions) if transactions else 0
    
    def fit(self, transactions: List[set]) -> 'AssociationRuleMiner':
        """Find frequent itemsets and association rules"""
        if not transactions:
            return self
        
        # Get all items
        all_items = set()
        for t in transactions:
            all_items.update(t)
        
        # Find frequent 1-itemsets
        current_itemsets = {}
        for item in all_items:
            itemset = frozenset([item])
            support = self._get_support(itemset, transactions)
            if support >= self.min_support:
                current_itemsets[itemset] = support
        
        self.frequent_itemsets = dict(current_itemsets)
        
        # Generate larger itemsets
        k = 2
        while current_itemsets:
            # Generate candidates
            items = list(current_itemsets.keys())
            candidates = set()
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    union = items[i] | items[j]
                    if len(union) == k:
                        candidates.add(union)
            
            # Filter by support
            current_itemsets = {}
            for candidate in candidates:
                support = self._get_support(candidate, transactions)
                if support >= self.min_support:
                    current_itemsets[candidate] = support
            
            self.frequent_itemsets.update(current_itemsets)
            k += 1
        
        # Generate rules
        self._generate_rules(transactions)
        
        return self
    
    def _generate_rules(self, transactions: List[set]):
        """Generate association rules from frequent itemsets"""
        self.rules = []
        
        for itemset, support in self.frequent_itemsets.items():
            if len(itemset) < 2:
                continue
            
            items = list(itemset)
            
            # Generate all non-empty subsets as antecedents
            for i in range(1, len(items)):
                from itertools import combinations
                for antecedent_tuple in combinations(items, i):
                    antecedent = frozenset(antecedent_tuple)
                    consequent = itemset - antecedent
                    
                    if not consequent:
                        continue
                    
                    antecedent_support = self.frequent_itemsets.get(antecedent, 0)
                    if antecedent_support == 0:
                        continue
                    
                    confidence = support / antecedent_support
                    
                    if confidence >= self.min_confidence:
                        # Calculate lift
                        consequent_support = self._get_support(consequent, transactions)
                        lift = confidence / consequent_support if consequent_support > 0 else 0
                        
                        self.rules.append({
                            "antecedent": list(antecedent),
                            "consequent": list(consequent),
                            "support": round(support, 4),
                            "confidence": round(confidence, 4),
                            "lift": round(lift, 4)
                        })
        
        # Sort by confidence
        self.rules.sort(key=lambda x: x["confidence"], reverse=True)
    
    def get_rules(self, min_lift: float = 1.0) -> List[Dict]:
        """Get rules filtered by minimum lift"""
        return [r for r in self.rules if r["lift"] >= min_lift]

class AnomalyDetector:
    """
    Simple anomaly detection using statistical methods
    Detects unusual patterns in event data
    """
    
    def __init__(self, threshold_std: float = 2.0):
        self.threshold_std = threshold_std
        self.mean: float = 0
        self.std: float = 0
    
    def fit(self, values: List[float]) -> 'AnomalyDetector':
        """Calculate statistics from training data"""
        if not values:
            return self
        
        n = len(values)
        self.mean = sum(values) / n
        
        variance = sum((v - self.mean) ** 2 for v in values) / n
        self.std = math.sqrt(variance) if variance > 0 else 1
        
        return self
    
    def detect(self, values: List[float]) -> List[Dict[str, Any]]:
        """Detect anomalies in new data"""
        anomalies = []
        
        for i, value in enumerate(values):
            z_score = (value - self.mean) / self.std if self.std > 0 else 0
            
            if abs(z_score) > self.threshold_std:
                anomalies.append({
                    "index": i,
                    "value": value,
                    "z_score": round(z_score, 4),
                    "type": "high" if z_score > 0 else "low",
                    "severity": "critical" if abs(z_score) > 3 else "warning"
                })
        
        return anomalies
    
    def get_thresholds(self) -> Dict[str, float]:
        """Get the anomaly thresholds"""
        return {
            "lower_bound": round(self.mean - self.threshold_std * self.std, 2),
            "upper_bound": round(self.mean + self.threshold_std * self.std, 2),
            "mean": round(self.mean, 2),
            "std": round(self.std, 2)
        }
