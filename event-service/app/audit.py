"""
Audit Logging Module
Implements immutable audit logging with integrity verification
"""
import os
import json
import hashlib
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict, field
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from sqlalchemy.ext.declarative import declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()

class AuditAction(Enum):
    """Audit action types"""
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    PERMISSION_CHANGE = "PERMISSION_CHANGE"
    EXPORT = "EXPORT"
    FAILED_LOGIN = "FAILED_LOGIN"

class AuditCategory(Enum):
    """Categories of audited resources"""
    USER = "USER"
    EVENT = "EVENT"
    PARTICIPANT = "PARTICIPANT"
    SYSTEM = "SYSTEM"
    SECURITY = "SECURITY"
    DATA = "DATA"

@dataclass
class AuditEntry:
    """Audit log entry structure"""
    action: AuditAction
    category: AuditCategory
    resource_type: str
    resource_id: Optional[str]
    user_id: Optional[int]
    username: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    old_value: Optional[Dict] = None
    new_value: Optional[Dict] = None
    details: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> dict:
        d = asdict(self)
        d['action'] = self.action.value
        d['category'] = self.category.value
        return d

class AuditLog(Base):
    """SQLAlchemy model for audit logs with integrity verification"""
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    action = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100))
    user_id = Column(Integer)
    username = Column(String(100))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    old_value = Column(Text)  # JSON serialized
    new_value = Column(Text)  # JSON serialized
    details = Column(Text)
    
    # Integrity fields (blockchain-like)
    hash = Column(String(64), nullable=False)  # SHA-256 hash
    previous_hash = Column(String(64))  # Previous entry hash for chain verification
    
    __table_args__ = (
        Index('ix_audit_timestamp', 'timestamp'),
        Index('ix_audit_user', 'user_id'),
        Index('ix_audit_resource', 'resource_type', 'resource_id'),
        Index('ix_audit_action', 'action'),
    )

class AuditLogger:
    """
    Immutable audit logger with blockchain-like integrity verification
    
    Features:
    - Chained hashes for tamper detection
    - Comprehensive audit trail
    - Query capabilities for compliance
    - Data access governance
    """
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self._last_hash: Optional[str] = None
    
    def _compute_hash(self, entry: AuditEntry, previous_hash: str = None) -> str:
        """Compute SHA-256 hash of audit entry"""
        data = {
            **entry.to_dict(),
            "previous_hash": previous_hash or ""
        }
        content = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _get_last_hash(self, session) -> Optional[str]:
        """Get hash of the last audit entry for chaining"""
        if self._last_hash:
            return self._last_hash
        
        last_entry = session.query(AuditLog).order_by(
            AuditLog.id.desc()
        ).first()
        
        return last_entry.hash if last_entry else None
    
    def log(self, entry: AuditEntry) -> int:
        """
        Log an audit entry with integrity hash
        
        Args:
            entry: The audit entry to log
            
        Returns:
            The ID of the created audit log
        """
        session = self.db_session_factory()
        try:
            previous_hash = self._get_last_hash(session)
            current_hash = self._compute_hash(entry, previous_hash)
            
            audit_log = AuditLog(
                timestamp=datetime.fromisoformat(entry.timestamp),
                action=entry.action.value,
                category=entry.category.value,
                resource_type=entry.resource_type,
                resource_id=entry.resource_id,
                user_id=entry.user_id,
                username=entry.username,
                ip_address=entry.ip_address,
                user_agent=entry.user_agent,
                old_value=json.dumps(entry.old_value) if entry.old_value else None,
                new_value=json.dumps(entry.new_value) if entry.new_value else None,
                details=entry.details,
                hash=current_hash,
                previous_hash=previous_hash
            )
            
            session.add(audit_log)
            session.commit()
            
            self._last_hash = current_hash
            
            logger.info(
                f"Audit: {entry.action.value} {entry.resource_type} "
                f"by user {entry.username} from {entry.ip_address}"
            )
            
            return audit_log.id
            
        except Exception as e:
            session.rollback()
            logger.error(f"Audit logging failed: {e}")
            raise
        finally:
            session.close()
    
    def verify_integrity(self, start_id: int = None, end_id: int = None) -> Dict[str, Any]:
        """
        Verify integrity of the audit log chain
        
        Args:
            start_id: Starting ID (optional)
            end_id: Ending ID (optional)
            
        Returns:
            Verification result with details of any integrity issues
        """
        session = self.db_session_factory()
        try:
            query = session.query(AuditLog).order_by(AuditLog.id)
            
            if start_id:
                query = query.filter(AuditLog.id >= start_id)
            if end_id:
                query = query.filter(AuditLog.id <= end_id)
            
            entries = query.all()
            
            if not entries:
                return {"valid": True, "checked": 0, "issues": []}
            
            issues = []
            previous_hash = entries[0].previous_hash
            
            for entry in entries:
                # Reconstruct the audit entry
                audit_entry = AuditEntry(
                    action=AuditAction(entry.action),
                    category=AuditCategory(entry.category),
                    resource_type=entry.resource_type,
                    resource_id=entry.resource_id,
                    user_id=entry.user_id,
                    username=entry.username,
                    ip_address=entry.ip_address,
                    user_agent=entry.user_agent,
                    old_value=json.loads(entry.old_value) if entry.old_value else None,
                    new_value=json.loads(entry.new_value) if entry.new_value else None,
                    details=entry.details,
                    timestamp=entry.timestamp.isoformat()
                )
                
                # Verify chain linkage
                if entry.previous_hash != previous_hash:
                    issues.append({
                        "id": entry.id,
                        "type": "chain_break",
                        "message": f"Chain broken at entry {entry.id}"
                    })
                
                # Verify hash
                computed_hash = self._compute_hash(audit_entry, entry.previous_hash)
                if computed_hash != entry.hash:
                    issues.append({
                        "id": entry.id,
                        "type": "hash_mismatch",
                        "message": f"Hash mismatch at entry {entry.id} - possible tampering"
                    })
                
                previous_hash = entry.hash
            
            return {
                "valid": len(issues) == 0,
                "checked": len(entries),
                "issues": issues
            }
            
        finally:
            session.close()
    
    def query_logs(
        self,
        user_id: int = None,
        resource_type: str = None,
        resource_id: str = None,
        action: AuditAction = None,
        category: AuditCategory = None,
        start_date: datetime = None,
        end_date: datetime = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """
        Query audit logs with filters
        
        Returns:
            List of audit log entries matching the criteria
        """
        session = self.db_session_factory()
        try:
            query = session.query(AuditLog)
            
            if user_id:
                query = query.filter(AuditLog.user_id == user_id)
            if resource_type:
                query = query.filter(AuditLog.resource_type == resource_type)
            if resource_id:
                query = query.filter(AuditLog.resource_id == resource_id)
            if action:
                query = query.filter(AuditLog.action == action.value)
            if category:
                query = query.filter(AuditLog.category == category.value)
            if start_date:
                query = query.filter(AuditLog.timestamp >= start_date)
            if end_date:
                query = query.filter(AuditLog.timestamp <= end_date)
            
            entries = query.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset).all()
            
            return [
                {
                    "id": e.id,
                    "timestamp": e.timestamp.isoformat(),
                    "action": e.action,
                    "category": e.category,
                    "resource_type": e.resource_type,
                    "resource_id": e.resource_id,
                    "user_id": e.user_id,
                    "username": e.username,
                    "ip_address": e.ip_address,
                    "details": e.details,
                    "hash": e.hash[:16] + "..."  # Truncated for display
                }
                for e in entries
            ]
            
        finally:
            session.close()

# Helper function for creating audit entries
def create_audit_entry(
    action: AuditAction,
    category: AuditCategory,
    resource_type: str,
    resource_id: str = None,
    user=None,
    request=None,
    old_value: Dict = None,
    new_value: Dict = None,
    details: str = None
) -> AuditEntry:
    """Helper to create audit entries from common patterns"""
    return AuditEntry(
        action=action,
        category=category,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        user_id=user.id if user else None,
        username=user.username if user else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("User-Agent", "")[:500] if request else None,
        old_value=old_value,
        new_value=new_value,
        details=details
    )
