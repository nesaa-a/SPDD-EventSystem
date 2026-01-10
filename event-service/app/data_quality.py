"""
Data Quality Validation Module
Implements data validation rules using Great Expectations patterns
"""
import re
import logging
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class ValidationSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

@dataclass
class ValidationResult:
    """Result of a validation check"""
    rule_name: str
    passed: bool
    severity: ValidationSeverity
    message: str
    column: Optional[str] = None
    value: Optional[Any] = None
    expected: Optional[Any] = None

@dataclass
class ValidationReport:
    """Complete validation report for a dataset"""
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    total_rules: int = 0
    passed_rules: int = 0
    failed_rules: int = 0
    results: List[ValidationResult] = field(default_factory=list)
    
    @property
    def success_rate(self) -> float:
        if self.total_rules == 0:
            return 100.0
        return (self.passed_rules / self.total_rules) * 100
    
    @property
    def is_valid(self) -> bool:
        """Check if all ERROR severity rules passed"""
        return not any(
            r.severity == ValidationSeverity.ERROR and not r.passed 
            for r in self.results
        )
    
    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "total_rules": self.total_rules,
            "passed_rules": self.passed_rules,
            "failed_rules": self.failed_rules,
            "success_rate": self.success_rate,
            "is_valid": self.is_valid,
            "results": [
                {
                    "rule_name": r.rule_name,
                    "passed": r.passed,
                    "severity": r.severity.value,
                    "message": r.message,
                    "column": r.column,
                    "value": str(r.value) if r.value else None,
                    "expected": str(r.expected) if r.expected else None
                }
                for r in self.results
            ]
        }

class DataQualityValidator:
    """
    Data quality validator implementing Great Expectations-like patterns
    
    Usage:
        validator = DataQualityValidator()
        validator.expect_column_to_exist("email")
        validator.expect_column_values_to_not_be_null("name")
        validator.expect_column_values_to_match_regex("email", r"^[\w\.-]+@[\w\.-]+\.\w+$")
        
        report = validator.validate({"name": "John", "email": "john@example.com"})
    """
    
    def __init__(self):
        self.expectations: List[Dict] = []
    
    def expect_column_to_exist(
        self, 
        column: str, 
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect a column to exist in the data"""
        self.expectations.append({
            "type": "column_exists",
            "column": column,
            "severity": severity
        })
        return self
    
    def expect_column_values_to_not_be_null(
        self, 
        column: str,
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect column values to not be null"""
        self.expectations.append({
            "type": "not_null",
            "column": column,
            "severity": severity
        })
        return self
    
    def expect_column_values_to_match_regex(
        self, 
        column: str, 
        regex: str,
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect column values to match a regex pattern"""
        self.expectations.append({
            "type": "regex_match",
            "column": column,
            "regex": regex,
            "severity": severity
        })
        return self
    
    def expect_column_values_to_be_in_set(
        self, 
        column: str, 
        value_set: List[Any],
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect column values to be in a specific set"""
        self.expectations.append({
            "type": "in_set",
            "column": column,
            "value_set": value_set,
            "severity": severity
        })
        return self
    
    def expect_column_values_to_be_between(
        self, 
        column: str, 
        min_value: Any, 
        max_value: Any,
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect column values to be between min and max"""
        self.expectations.append({
            "type": "between",
            "column": column,
            "min_value": min_value,
            "max_value": max_value,
            "severity": severity
        })
        return self
    
    def expect_column_value_length_to_be_between(
        self, 
        column: str, 
        min_length: int, 
        max_length: int,
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Expect string column value length to be between min and max"""
        self.expectations.append({
            "type": "length_between",
            "column": column,
            "min_length": min_length,
            "max_length": max_length,
            "severity": severity
        })
        return self
    
    def expect_column_values_to_be_unique(
        self, 
        column: str,
        severity: ValidationSeverity = ValidationSeverity.WARNING
    ) -> 'DataQualityValidator':
        """Expect column values to be unique (for batch validation)"""
        self.expectations.append({
            "type": "unique",
            "column": column,
            "severity": severity
        })
        return self
    
    def add_custom_expectation(
        self,
        name: str,
        validator: Callable[[Dict], bool],
        message: str,
        severity: ValidationSeverity = ValidationSeverity.ERROR
    ) -> 'DataQualityValidator':
        """Add a custom validation rule"""
        self.expectations.append({
            "type": "custom",
            "name": name,
            "validator": validator,
            "message": message,
            "severity": severity
        })
        return self
    
    def validate(self, data: Dict[str, Any]) -> ValidationReport:
        """
        Validate a single record against all expectations
        
        Args:
            data: Dictionary containing the data to validate
            
        Returns:
            ValidationReport with all results
        """
        report = ValidationReport()
        
        for expectation in self.expectations:
            result = self._validate_expectation(expectation, data)
            report.results.append(result)
            report.total_rules += 1
            if result.passed:
                report.passed_rules += 1
            else:
                report.failed_rules += 1
        
        return report
    
    def validate_batch(self, records: List[Dict[str, Any]]) -> ValidationReport:
        """
        Validate a batch of records
        
        Args:
            records: List of dictionaries to validate
            
        Returns:
            Aggregated ValidationReport
        """
        report = ValidationReport()
        
        for i, record in enumerate(records):
            record_report = self.validate(record)
            for result in record_report.results:
                if not result.passed:
                    result.message = f"Record {i}: {result.message}"
                    report.results.append(result)
            
            report.total_rules += record_report.total_rules
            report.passed_rules += record_report.passed_rules
            report.failed_rules += record_report.failed_rules
        
        return report
    
    def _validate_expectation(
        self, 
        expectation: Dict, 
        data: Dict[str, Any]
    ) -> ValidationResult:
        """Validate a single expectation against data"""
        
        exp_type = expectation["type"]
        severity = expectation.get("severity", ValidationSeverity.ERROR)
        column = expectation.get("column")
        
        if exp_type == "column_exists":
            passed = column in data
            return ValidationResult(
                rule_name=f"expect_column_to_exist_{column}",
                passed=passed,
                severity=severity,
                message=f"Column '{column}' {'exists' if passed else 'does not exist'}",
                column=column
            )
        
        if exp_type == "not_null":
            value = data.get(column)
            passed = value is not None and value != ""
            return ValidationResult(
                rule_name=f"expect_column_values_to_not_be_null_{column}",
                passed=passed,
                severity=severity,
                message=f"Column '{column}' {'is not null' if passed else 'is null or empty'}",
                column=column,
                value=value
            )
        
        if exp_type == "regex_match":
            value = data.get(column, "")
            regex = expectation["regex"]
            passed = bool(re.match(regex, str(value))) if value else False
            return ValidationResult(
                rule_name=f"expect_column_values_to_match_regex_{column}",
                passed=passed,
                severity=severity,
                message=f"Column '{column}' {'matches' if passed else 'does not match'} pattern",
                column=column,
                value=value,
                expected=regex
            )
        
        if exp_type == "in_set":
            value = data.get(column)
            value_set = expectation["value_set"]
            passed = value in value_set
            return ValidationResult(
                rule_name=f"expect_column_values_to_be_in_set_{column}",
                passed=passed,
                severity=severity,
                message=f"Value '{value}' {'is' if passed else 'is not'} in allowed set",
                column=column,
                value=value,
                expected=value_set
            )
        
        if exp_type == "between":
            value = data.get(column)
            min_val = expectation["min_value"]
            max_val = expectation["max_value"]
            passed = min_val <= value <= max_val if value is not None else False
            return ValidationResult(
                rule_name=f"expect_column_values_to_be_between_{column}",
                passed=passed,
                severity=severity,
                message=f"Value {value} {'is' if passed else 'is not'} between {min_val} and {max_val}",
                column=column,
                value=value,
                expected=f"{min_val}-{max_val}"
            )
        
        if exp_type == "length_between":
            value = str(data.get(column, ""))
            min_len = expectation["min_length"]
            max_len = expectation["max_length"]
            passed = min_len <= len(value) <= max_len
            return ValidationResult(
                rule_name=f"expect_column_value_length_to_be_between_{column}",
                passed=passed,
                severity=severity,
                message=f"Length {len(value)} {'is' if passed else 'is not'} between {min_len} and {max_len}",
                column=column,
                value=value,
                expected=f"length {min_len}-{max_len}"
            )
        
        if exp_type == "custom":
            try:
                passed = expectation["validator"](data)
            except Exception as e:
                passed = False
                logger.error(f"Custom validation error: {e}")
            return ValidationResult(
                rule_name=expectation["name"],
                passed=passed,
                severity=severity,
                message=expectation["message"]
            )
        
        return ValidationResult(
            rule_name="unknown",
            passed=False,
            severity=ValidationSeverity.ERROR,
            message=f"Unknown expectation type: {exp_type}"
        )

# Pre-configured validators for common entities
def get_event_validator() -> DataQualityValidator:
    """Get validator for Event entities"""
    return (DataQualityValidator()
        .expect_column_to_exist("title")
        .expect_column_to_exist("date")
        .expect_column_to_exist("location")
        .expect_column_values_to_not_be_null("title")
        .expect_column_values_to_not_be_null("date")
        .expect_column_value_length_to_be_between("title", 3, 200)
        .expect_column_values_to_be_between("seats", 1, 10000)
        .expect_column_values_to_be_in_set("category", [
            "Conference", "Workshop", "Meetup", "Webinar", 
            "Seminar", "Training", "Hackathon", "Social", "Other", ""
        ], severity=ValidationSeverity.WARNING)
    )

def get_participant_validator() -> DataQualityValidator:
    """Get validator for Participant entities"""
    return (DataQualityValidator()
        .expect_column_to_exist("name")
        .expect_column_to_exist("email")
        .expect_column_values_to_not_be_null("name")
        .expect_column_values_to_not_be_null("email")
        .expect_column_values_to_match_regex("email", r"^[\w\.-]+@[\w\.-]+\.\w+$")
        .expect_column_value_length_to_be_between("name", 2, 100)
    )

def get_user_validator() -> DataQualityValidator:
    """Get validator for User entities"""
    return (DataQualityValidator()
        .expect_column_to_exist("username")
        .expect_column_to_exist("email")
        .expect_column_to_exist("password")
        .expect_column_values_to_not_be_null("username")
        .expect_column_values_to_not_be_null("email")
        .expect_column_values_to_not_be_null("password")
        .expect_column_values_to_match_regex("email", r"^[\w\.-]+@[\w\.-]+\.\w+$")
        .expect_column_value_length_to_be_between("username", 3, 50)
        .expect_column_value_length_to_be_between("password", 6, 100)
    )

# Pre-instantiated validators for direct import
event_validator = get_event_validator()
participant_validator = get_participant_validator()
user_validator = get_user_validator()
