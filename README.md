# 🤖 AI DevOps Optimizer & SRE Co-Pilot

**An autonomous SRE platform that triages, validates, and self-heals CI/CD pipeline failures in real time.**

---

<div align="center">

[![CI/CD Pipeline](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions/workflows/main.yml/badge.svg)](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/K8s-Orchestrated-326CE5.svg)](https://kubernetes.io)
[![Terraform](https://img.shields.io/badge/IaC-Terraform_1.5+-5C4EE5.svg)](https://terraform.io)

*An enterprise-grade AI Operations (AIOps) engine. Built to showcase modern cloud-native architecture, infrastructure automation, telemetry pipelines, and autonomous AI-driven SRE feedback loops.*

</div>

---

## 📌 The Problem

When CI/CD pipelines fail, developers manually:
1. **Dig** through thousands of lines of verbose compiler output
2. **Isolate** the root cause buried in noise
3. **Write** a code fix and test it locally
4. **Push** a branch and open a Pull Request

This cycle represents **significant downtime and friction**.

**AI DevOps Optimizer** automates this entire lifecycle. It ingests pipeline crash telemetry, scrubs secrets, reduces noise, employs LLMs to diagnose the root cause, applies a surgical code patch, validates it inside a **Local Compilation Guard**, and delivers a **Draft Pull Request** — all in under 60 seconds.

---

## 🗺️ System Architecture

```
                                  ┌────────────────────────┐
                                  │   Target Repository    │
                                  │   (e.g., Project B)    │
                                  └───────────┬────────────┘
                                              │  1. Pipeline Crashes
                                              ▼
                                ┌──────────────────────────┐
                                │   GitHub Actions Runner  │
                                │                          │
                                │  ┌────────────────────┐  │
                                │  │ build_failure.log  │  │
                                │  └──────────┬─────────┘  │
                                │             │ 2. Ingests Telemetry
                                │             ▼            │
                                │  ┌────────────────────┐  │
                                │  │   PII Scrubber     │  │
                                │  └──────────┬─────────┘  │
                                │             │ 3. Noise Filtered Logs
                                │             ▼            │
       ┌────────────────────────┼─────────────┼────────────┤
       │ 4. Diagnoses Cause     │             │            │ 8. Pushes Fix Branch & Opens Draft PR
       ▼                        ▼             ▼            ▼
┌──────────────┐         ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────┐
│ NVIDIA NIM   │◄───────►│ AI SRE CLI  │──►│ Compilation │──►│ GitHub REST API (Octokit)│
│ LLM Engine   │         │ (cli-heal)  │   │  Guard      │   └──────────────────────────┘
└──────────────┘         └─────────────┘   └─────────────┘
                                5. Code Patch    6. Runs local build check 
                                   applied          (Up to 2 Self-Correction retries)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20 LTS
- **Docker** & **Docker Compose** (for full observability stack)
- An LLM API key: [NVIDIA NIM](https://build.nvidia.com) (free) or [OpenAI](https://platform.openai.com)

### 1. Clone & Install

```bash
git clone https://github.com/Hamza119612/AI-DevOps-Optimizer.git
cd AI-DevOps-Optimizer/app
cp ../.env.example ../.env   # Edit with your API keys
npm install
```

### 2. Run the Development Server

```bash
npm run dev
# Server starts at http://localhost:3000
```

### 3. Run the Full Stack (App + Prometheus + Grafana)

```bash
docker-compose up -d
# App:        http://localhost:3000
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001 (admin/admin)
```

### 4. Run Tests

```bash
npm test        # 36/36 tests passing
npm run build   # TypeScript compilation check
```

---

## 🛡️ Security & Resilience

### API Key Authentication
All `/api/*` endpoints are protected by **Bearer token authentication** when `API_KEYS` is configured:
```bash
# .env
API_KEYS=your-secret-key-1,your-secret-key-2
```
```bash
# Usage
curl -H "Authorization: Bearer your-secret-key-1" \
     -X POST http://localhost:3000/api/analyze \
     -d '{"logs": "..."}'
```
Auth is automatically disabled in development when `API_KEYS` is not set.

### Request Validation (Zod)
All request bodies are validated using **Zod schemas** with strict type checking, length limits, and enum enforcement. Invalid payloads get a clear error message before reaching any business logic.

### PII & Secret Scrubber
Raw CI logs often contain credentials, tokens, and connection strings. A **regex-driven scrubber** sanitizes all telemetry *before* it reaches the LLM:
- GitHub tokens (`ghp_*`, `github_pat_*`)
- NVIDIA/OpenAI API keys
- AWS access keys (`AKIA*`)
- Database connection strings (MongoDB, MySQL, PostgreSQL)
- Email addresses and Bearer tokens

### Local Compilation Guard
Before pushing any code:
1. The patch is applied locally and the project's build suite runs (`npm run build` / `tsc`)
2. If compilation fails, the **new compiler output** feeds back into the LLM in a **2-retry self-reflection loop**
3. If code remains broken after retries, it **rolls back and aborts cleanly**

### Circuit Breaker
If SRE Co-Pilot runs on a branch matching `devops-copilot/*`, it **instantly terminates** — preventing infinite recursion loops.

### Path Drift Resolution
Logs from subfolders often report relative paths like `src/routes/heal.ts` instead of `app/src/routes/heal.ts`. The engine performs **dual-pass recursive search** to resolve path drift, making it compatible with monorepos and nested setups.

---

## 🔌 API Reference

All endpoints require `Authorization: Bearer <key>` when `API_KEYS` is configured. Health probes are always unauthenticated.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/healthz` | ❌ | Kubernetes liveness probe |
| `GET` | `/readyz` | ❌ | Kubernetes readiness probe (checks NIM reachability) |
| `GET` | `/metrics` | ❌ | Prometheus telemetry data |
| `POST` | `/api/analyze` | ✅ | Parse logs → structured JSON diagnosis |
| `POST` | `/api/optimize` | ✅ | Review config → ranked optimization suggestions |
| `POST` | `/api/heal` | ✅ | Full orchestration: clone → patch → PR |

### POST `/api/analyze`

```json
{
  "logs": "Error: Cannot find module './missing'...",
  "pipelineId": "run-42",
  "skipPreprocess": false
}
```

**Response:**
```json
{
  "success": true,
  "pipelineId": "run-42",
  "analysis": {
    "errors": [{
      "rootCause": "Missing import for './missing' module",
      "file": "src/index.ts",
      "line": 5,
      "suggestedFix": "Install the module or fix the import path",
      "confidence": 92,
      "severity": "high"
    }]
  },
  "meta": {
    "provider": "github-actions",
    "failedStep": "npm run build",
    "totalLines": 847,
    "extractedLines": 23,
    "preprocessed": true
  }
}
```

### POST `/api/optimize`

```json
{
  "config": "FROM node:14\nRUN npm install\nCOPY . .",
  "configType": "dockerfile"
}
```

Valid `configType` values: `dockerfile`, `github-actions`, `gitlab-ci`, `kubernetes`, `helm`, `terraform`, `docker-compose`, `jenkinsfile`, `other`

### POST `/api/heal`

```json
{
  "logs": "##[error] TypeError: Cannot read property...",
  "repoUrl": "https://github.com/org/repo",
  "githubToken": "ghp_...",
  "branch": "main",
  "filePath": "src/index.ts"
}
```

---

## ⚡ CI/CD Integration (2 Minutes)

Integrate SRE Co-Pilot into any project using GitHub Actions:

1. Go to **Settings → Actions → General** → Enable **"Allow GitHub Actions to create and approve pull requests"**
2. Add `NVIDIA_API_KEY` to your repository secrets
3. Copy this workflow to `.github/workflows/ai-copilot.yml`:

```yaml
name: AI SRE Co-Pilot

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - run: npm ci

      - name: 🧪 Run Build Suite
        run: npm run build > build_failure.log 2>&1

      - name: 🩹 AI SRE Auto-Patch (on failure only)
        if: failure()
        env:
          NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "🚨 Build failed. Launching SRE Auto-Patch..."
          npx --package @hamza/ai-devops-optimizer cli-heal --logs build_failure.log
```

---

## 📊 Observability (Prometheus & Grafana)

The platform is built with an **"Observability First"** mindset. Every transaction produces telemetry:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | HTTP requests by method/route/status |
| `http_request_duration_seconds` | Histogram | Request latency |
| `llm_requests_total` | Counter | LLM API calls by operation/model/status |
| `llm_tokens_used_total` | Counter | Token consumption by operation |
| `llm_request_duration_seconds` | Histogram | LLM call latency |
| `llm_estimated_cost_usd_total` | Counter | Approximate API spend |

Plus all default Node.js metrics (CPU, memory, event loop, GC).

---

## ☕ Architecture Analogy (Coffee Shop)

To understand how the DevOps components synergize, think of this platform as a **Premium Coffee Shop Franchise**:

| Component | Role | Tech Equivalent |
|-----------|------|-----------------|
| **Terraform** | "The Construction Crew" — pours the foundation, installs plumbing and power | Provisions VPC, subnets, EKS cluster, ECR registry |
| **Kubernetes** | "The Store Manager" — handles daily ops, replaces sick baristas, opens registers during rush hour | Self-healing pods, autoscaling, zero-downtime rollouts |
| **Helm** | "The Franchise Blueprint Kit" — same recipe, different store sizes | One chart → Dev (1 replica, budget), Staging (3 replicas), Prod (10 replicas, premium) |

---

## 📁 Repository Structure

```
AI-DevOps-Optimizer/
├── app/                          # Express backend API & CLI source
│   ├── src/
│   │   ├── index.ts              # Express API entry point
│   │   ├── schemas.ts            # Zod request validation schemas
│   │   ├── middleware/
│   │   │   └── auth.ts           # Bearer token authentication
│   │   ├── routes/               # Express routing controllers
│   │   │   ├── analyze.ts        # POST /api/analyze
│   │   │   ├── optimize.ts       # POST /api/optimize
│   │   │   ├── heal.ts           # POST /api/heal
│   │   │   └── health.ts         # GET /healthz, /readyz
│   │   ├── services/             # Core business logic
│   │   │   ├── llm.ts            # LLM client (NVIDIA NIM / OpenAI) with retry
│   │   │   ├── git.ts            # Async Git cloner & PR creator
│   │   │   ├── pipeline.ts       # CI log parser & noise reducer
│   │   │   ├── scrubber.ts       # PII & secret sanitizer
│   │   │   ├── logger.ts         # Structured Pino logger
│   │   │   └── metrics.ts        # Prometheus instrumentation
│   │   ├── scripts/
│   │   │   └── cli-heal.ts       # Standalone CLI runner
│   │   └── __tests__/            # Jest test suite (36/36 green)
│   ├── Dockerfile                # Multi-stage hardened production image
│   └── package.json
│
├── terraform/                    # High-availability AWS IaC
│   ├── main.tf                   # Multi-AZ VPC + EKS + ECR
│   ├── backend.tf                # Remote S3/DynamoDB state locking
│   ├── variables.tf              # Configurable parameters
│   └── outputs.tf                # Cluster endpoint & ECR URL
│
├── helm/                         # Kubernetes deployment templates
│   └── ai-devops-optimizer/      # Helm chart with HPA & values per env
│
├── k8s/                          # Raw Kubernetes manifests
│   ├── deployment.yaml           # Pod spec with security context
│   ├── service.yaml              # ClusterIP service
│   ├── ingress.yaml              # Nginx ingress controller
│   └── hpa.yaml                  # Horizontal Pod Autoscaler
│
├── monitoring/                   # Observability stack
│   ├── prometheus/               # Scrape configuration
│   └── grafana/                  # Dashboard JSON definitions
│
├── .github/workflows/            # CI/CD pipeline definitions
│   ├── main.yml                  # Build → Test → Docker → Trivy scan
│   └── cd.yml                    # Helm deploy to Kubernetes
│
├── templates/                    # Copy-pasteable CI integration template
├── scripts/                      # Local Kubernetes setup utilities
├── docker-compose.yml            # Local development stack
└── .env.example                  # Environment variable reference
```

---

## 🧰 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend & CLI** | Node.js 20 LTS, TypeScript 5, Express, Pino Logger |
| **Validation** | Zod v4 (runtime schema validation) |
| **Security** | Bearer token auth, PII scrubber, Trivy container scanning |
| **Artificial Intelligence** | NVIDIA NIM, OpenAI API, Llama-3.3-70b-Instruct |
| **Resilience** | Exponential backoff retry, circuit breakers, compilation guard |
| **Infrastructure as Code** | Terraform 1.5+, AWS (VPC, EKS, ECR, S3, DynamoDB) |
| **Containerization** | Docker (hardened, non-root, multi-stage builds) |
| **Orchestration** | Kubernetes, Helm v3, HPA |
| **Observability** | Prometheus, Grafana, prom-client |
| **Testing** | Jest, Supertest (36 tests, 4 suites) |

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 🔧 to automate operational overhead and accelerate developer velocity.**

</div>
