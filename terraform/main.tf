# Terraform Infrastructure as Code
# Main configuration for SPDD Event System

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
  
  # Backend for state management (configure for your environment)
  # backend "s3" {
  #   bucket = "spdd-terraform-state"
  #   key    = "infrastructure/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

# Variables
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "development"
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "spdd-events"
}

variable "replicas" {
  description = "Number of replicas for services"
  type        = map(number)
  default = {
    event-service     = 2
    analytics-service = 1
  }
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = "changeme"
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  default     = ""
}

# Provider configuration
provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

# Namespace
resource "kubernetes_namespace" "spdd" {
  metadata {
    name = var.namespace
    
    labels = {
      app         = "spdd-eventsystem"
      environment = var.environment
      managed-by  = "terraform"
    }
  }
}

# ConfigMap for application configuration
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.spdd.metadata[0].name
  }
  
  data = {
    ENVIRONMENT           = var.environment
    LOG_LEVEL            = var.environment == "production" ? "INFO" : "DEBUG"
    TRACING_ENABLED      = "true"
    KAFKA_TOPIC_EVENTS   = "events.created"
    KAFKA_CONSUMER_GROUP = "analytics-group"
  }
}

# Secret for sensitive data
resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "app-secrets"
    namespace = kubernetes_namespace.spdd.metadata[0].name
  }
  
  data = {
    POSTGRES_PASSWORD = base64encode(var.postgres_password)
    REDIS_PASSWORD    = base64encode(var.redis_password)
    JWT_SECRET_KEY    = base64encode("your-super-secret-jwt-key-change-in-production")
  }
  
  type = "Opaque"
}

# PostgreSQL Helm Release
resource "helm_release" "postgresql" {
  name       = "postgresql"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  version    = "13.2.0"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "auth.postgresPassword"
    value = var.postgres_password
  }
  
  set {
    name  = "auth.database"
    value = "eventsdb"
  }
  
  set {
    name  = "primary.persistence.size"
    value = "10Gi"
  }
  
  set {
    name  = "metrics.enabled"
    value = "true"
  }
}

# Redis Helm Release
resource "helm_release" "redis" {
  name       = "redis"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "redis"
  version    = "18.2.0"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "architecture"
    value = "standalone"
  }
  
  set {
    name  = "auth.enabled"
    value = var.redis_password != "" ? "true" : "false"
  }
  
  set {
    name  = "auth.password"
    value = var.redis_password
  }
  
  set {
    name  = "master.persistence.size"
    value = "5Gi"
  }
  
  set {
    name  = "metrics.enabled"
    value = "true"
  }
}

# Kafka Helm Release
resource "helm_release" "kafka" {
  name       = "kafka"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "kafka"
  version    = "26.4.0"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "kraft.enabled"
    value = "true"
  }
  
  set {
    name  = "controller.replicaCount"
    value = var.environment == "production" ? "3" : "1"
  }
  
  set {
    name  = "broker.replicaCount"
    value = var.environment == "production" ? "3" : "1"
  }
  
  set {
    name  = "metrics.kafka.enabled"
    value = "true"
  }
  
  set {
    name  = "provisioning.enabled"
    value = "true"
  }
  
  set {
    name  = "provisioning.topics[0].name"
    value = "events.created"
  }
  
  set {
    name  = "provisioning.topics[0].partitions"
    value = "3"
  }
  
  set {
    name  = "provisioning.topics[0].replicationFactor"
    value = "1"
  }
  
  set {
    name  = "provisioning.topics[1].name"
    value = "events.dlq"
  }
}

# Elasticsearch Helm Release
resource "helm_release" "elasticsearch" {
  name       = "elasticsearch"
  repository = "https://helm.elastic.co"
  chart      = "elasticsearch"
  version    = "8.5.1"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "replicas"
    value = var.environment == "production" ? "3" : "1"
  }
  
  set {
    name  = "minimumMasterNodes"
    value = "1"
  }
  
  set {
    name  = "resources.requests.memory"
    value = "1Gi"
  }
  
  set {
    name  = "resources.limits.memory"
    value = "2Gi"
  }
  
  set {
    name  = "volumeClaimTemplate.resources.requests.storage"
    value = "10Gi"
  }
}

# Prometheus Stack (includes Grafana)
resource "helm_release" "prometheus_stack" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "54.0.0"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "grafana.enabled"
    value = "true"
  }
  
  set {
    name  = "grafana.adminPassword"
    value = "admin"
  }
  
  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "15d"
  }
  
  set {
    name  = "alertmanager.enabled"
    value = "true"
  }
}

# Jaeger for Distributed Tracing
resource "helm_release" "jaeger" {
  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = "0.73.0"
  namespace  = kubernetes_namespace.spdd.metadata[0].name
  
  set {
    name  = "allInOne.enabled"
    value = var.environment != "production" ? "true" : "false"
  }
  
  set {
    name  = "storage.type"
    value = var.environment == "production" ? "elasticsearch" : "memory"
  }
}

# Outputs
output "namespace" {
  description = "Kubernetes namespace"
  value       = kubernetes_namespace.spdd.metadata[0].name
}

output "postgres_host" {
  description = "PostgreSQL service host"
  value       = "${helm_release.postgresql.name}-postgresql.${kubernetes_namespace.spdd.metadata[0].name}.svc.cluster.local"
}

output "redis_host" {
  description = "Redis service host"
  value       = "${helm_release.redis.name}-master.${kubernetes_namespace.spdd.metadata[0].name}.svc.cluster.local"
}

output "kafka_host" {
  description = "Kafka service host"
  value       = "${helm_release.kafka.name}.${kubernetes_namespace.spdd.metadata[0].name}.svc.cluster.local"
}

output "elasticsearch_host" {
  description = "Elasticsearch service host"
  value       = "${helm_release.elasticsearch.name}-master.${kubernetes_namespace.spdd.metadata[0].name}.svc.cluster.local"
}
