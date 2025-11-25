#!/bin/bash
set -e

# Install Istio
istioctl install -f k8s/istio/install-istio.yaml
kubectl label namespace spdd-events istio-injection=enabled

# Apply base Kubernetes manifests
kubectl apply -k k8s/base/

# Apply Istio configurations
kubectl apply -f k8s/istio/gateway.yaml
kubectl apply -f k8s/istio/mtls.yaml

# Apply monitoring
kubectl apply -f k8s/monitoring/prometheus-rules.yaml

echo "Deployment complete! Access the services at:"
echo "- Event Service: http://localhost/api/events"
echo "- Analytics Service: http://localhost/api/analytics"
echo "- Grafana: http://localhost:3000"
echo "- Jaeger: http://localhost:16686"

# Port-forward services
kubectl port-forward -n istio-system svc/istio-ingressgateway 80:80 &
kubectl port-forward -n monitoring svc/grafana 3000:80 &
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686 &

wait
