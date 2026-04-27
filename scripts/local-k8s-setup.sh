export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#!/bin/bash
# =============================================================
# local-k8s-setup.sh — Build, import, and deploy to local k3s
# =============================================================
# Prerequisites: k3s + Helm installed in WSL
# Usage: bash scripts/local-k8s-setup.sh
# =============================================================
set -euo pipefail

PROJECT_DIR="/mnt/c/Users/Hamza/Documents/GitHub/AI-DevOps-Optimizer"
IMAGE="hamzao119/devops-assistant:local"

# Load .env if present (for NVIDIA_API_KEY)
if [ -f "$PROJECT_DIR/.env" ]; then
  echo "📂 Loading .env file..."
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

echo ""
echo "=== 🐳 Phase 1: Building Docker image ==="
docker build -t "$IMAGE" "$PROJECT_DIR/app"

echo ""
echo "=== 📦 Phase 2: Importing into k3s containerd ==="
docker save "$IMAGE" | sudo k3s ctr images import -

echo ""
echo "=== 🔐 Phase 3: Creating NVIDIA secret ==="
kubectl create secret generic ai-devops-optimizer-secrets \
  --from-literal=nvidia-api-key="${NVIDIA_API_KEY:-placeholder}" \
  --from-literal=nvidia-model="${NVIDIA_MODEL:-meta/llama-3.3-70b-instruct}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "=== 🚀 Phase 4: Deploying with Helm ==="
helm upgrade --install ai-devops-optimizer "$PROJECT_DIR/helm/ai-devops-optimizer" \
  -f "$PROJECT_DIR/helm/ai-devops-optimizer/values-local.yaml" \
  --namespace default \
  --wait \
  --timeout 5m

echo ""
echo "=== ✅ Deployment Complete ==="
echo ""
kubectl get pods -n default
echo ""
kubectl get svc ai-devops-optimizer -n default
echo ""
echo "---------------------------------------------------"
echo "Access via port-forward:"
echo "  kubectl port-forward svc/ai-devops-optimizer 3000:80"
echo "  Then open: http://localhost:3000"
echo "---------------------------------------------------"
