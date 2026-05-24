<div align="center">

# 🤖 AI DevOps Optimizer

**An LLM-powered platform that analyzes, optimizes, and self-heals CI/CD pipelines in real time.**

[![CI/CD Pipeline](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions/workflows/main.yml/badge.svg)](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/K8s-Orchestrated-326CE5.svg)](https://kubernetes.io)

<br/>

*A hands-on DevOps learning project — built to explore infrastructure, automation, and AI-driven operations from the ground up.*

</div>

---

## 📌 What Is This?

**AI DevOps Optimizer** is an intelligent backend service that plugs into your CI/CD pipelines and uses **Large Language Models (LLMs)** to:

- 🔍 **Analyze** pipeline logs and detect failure patterns before they cascade
- ⚡ **Optimize** build times, resource allocation, and deployment strategies
- 🩹 **Self-heal** by suggesting (or auto-applying) fixes when pipelines break
- 📊 **Monitor** infrastructure health with Prometheus metrics and Grafana dashboards

It's not just another chatbot wrapper — it's a real system that ingests pipeline telemetry, processes it through AI, and closes the feedback loop with actionable changes.

---

## 🎯 Why This Project?

This is a **learning-by-building** project designed to go deep on every layer of the DevOps stack:

| Layer | What You'll Learn | Tools |
|---|---|---|
| **Application** | Building production-grade APIs in TypeScript | Express, Node.js |
| **AI/LLM** | Integrating LLMs for real-world automation | OpenAI API, LangChain, RAG |
| **Containerization** | Multi-stage builds, image hardening | Docker |
| **Orchestration** | Deploying, scaling, and managing workloads | Kubernetes, Helm |
| **CI/CD** | Pipeline design, testing, deployment automation | GitHub Actions |
| **Monitoring** | Metrics collection, dashboards, alerting | Prometheus, Grafana |
| **Infrastructure** | Provisioning cloud resources as code | Terraform |
| **Security** | Image scanning, secret management, RBAC | Trivy, SOPS, OPA |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     GitHub Actions                       │
│          (CI/CD Pipeline — build, test, deploy)          │
└──────────┬──────────────────────────────────┬────────────┘
           │  webhook / logs                  │  deploy
           ▼                                  ▼
┌─────────────────────┐          ┌────────────────────────┐
│   AI DevOps API     │          │   Kubernetes Cluster   │
│  (Express + TS)     │◄────────►│  (Helm-managed pods)   │
│                     │          │                        │
│  ┌───────────────┐  │          │  ┌──────────────────┐  │
│  │ Pipeline      │  │          │  │ App Deployment   │  │
│  │ Analyzer      │  │          │  ├──────────────────┤  │
│  ├───────────────┤  │          │  │ Prometheus       │  │
│  │ LLM Engine    │  │          │  ├──────────────────┤  │
│  │ (OpenAI /     │  │          │  │ Grafana          │  │
│  │  LangChain)   │  │          │  └──────────────────┘  │
│  ├───────────────┤  │          └────────────────────────┘
│  │ Metrics       │  │
│  │ (prom-client) │  │          ┌────────────────────────┐
│  └───────────────┘  │          │   Terraform            │
└─────────────────────┘          │   (Infra provisioning) │
                                 └────────────────────────┘
```

---

## 🧠 LLM Integration — How AI Fits In

This isn't prompt engineering for fun — the LLM is a **core component** of the pipeline feedback loop:

### 1. Pipeline Log Analysis
Feed raw CI/CD logs into an LLM to extract structured failure reports:
```
Input:  500 lines of noisy GitHub Actions log output
Output: { "root_cause": "TypeScript type error in auth module",
          "file": "src/auth/middleware.ts",
          "suggested_fix": "Add Optional<> wrapper to userId param",
          "confidence": 0.87 }
```

### 2. Configuration Optimization
The LLM reviews your pipeline YAML, Dockerfile, and K8s manifests to suggest optimizations:
- *"Your Docker build is 3.2GB — switch to multi-stage build to cut it to ~180MB"*
- *"Pipeline stages `lint` and `test` are independent — run in parallel to save 4 min"*
- *"Your K8s HPA is set to scale at 80% CPU — based on your traffic pattern, 60% would prevent cold-start latency"*

### 3. Self-Healing Pipelines (SRE Co-Pilot)
When a pipeline fails in any repository (e.g. Sam's **Project B**), the **SRE Co-Pilot CLI Engine** executes locally within the runner to:
1. **Scrub PII & Secrets:** Mask GitHub tokens, database credentials, and email addresses before they are transmitted.
2. **Isolate Failures:** Feed log traces to NVIDIA NIM or OpenAI to pinpoint the exact broken file and line.
3. **Compile-Guard Patching:** Generates a fix, writes it, runs `npm run build` or `tsc` locally, and loops back to self-correct up to 2 times if compilation fails.
4. **Clean Git Delivery:** Checkout a fix branch, commit the verified code, push, and open a Draft Pull Request on GitHub.

### 4. RAG for Runbooks
Build a **Retrieval-Augmented Generation** layer over your team's runbooks and docs — so anyone can ask *"How do I roll back a canary deployment?"* and get an answer grounded in YOUR documentation, not generic internet knowledge.

---

## ⚡ Zero-Friction SRE Co-Pilot Integration (Project B)

Say hello to **2-minute zero-friction setups**. Rather than hosting complex, heavy API servers and managing databases, your developers can integrate SRE Co-Pilot into any nested project or monorepo in **under 2 minutes** using standard GitHub Actions and our compiled CLI utility!

### 🔧 2-Minute Integration Template
To active the SRE Co-Pilot in another repository (e.g., **Project B**):
1. Add `NVIDIA_API_KEY` (or `OPENAI_API_KEY`) to your GitHub Repository Secrets.
2. Copy the copy-pasteable workflow template to `.github/workflows/ai-copilot.yml`:

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
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Get full history for Git branching

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x

      - name: Install dependencies
        run: npm ci

      - name: Run Build & Compilation Suite
        run: |
          npm run build > build_failure.log 2>&1

      - name: Spawn AI SRE Co-Pilot on Failure
        if: failure()
        env:
          NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Ephemeral write token
        run: |
          echo "🚨 Pipeline crash detected! Launching SRE Auto-Patch..."
          npx --package @hamza/ai-devops-optimizer cli-heal --logs build_failure.log
```

---

## 🛡️ Senior SRE Resilience & Safeguards

Building automation in CI/CD requires extreme resilience. SRE Co-Pilot features 4 core senior-architect safeguards to guarantee clean, safe, and secure executions:

### 1. 🧼 Data Privacy & PII Scrubber
All pipeline logs are pre-processed in-memory on the CI runner before ever reaching the LLM API. High-entropy regex scrubbers automatically replace GitHub tokens (`ghp_...`), NVIDIA API keys, connection strings (MongoDB, MySQL, PostgreSQL), and emails with `[REDACTED]`.

### 🛡️ 2. The "Self-Correction" Local Compilation Guard
Before committing or pushing code, the SRE CLI validates the fix *locally* on the runner. If compilation fails:
* It captures the *new* TypeScript compiler output.
* It feeds the crash details back to the LLM in a **2-retry self-reflection loop**.
* If the code remains broken after the second retry, the CLI aborts cleanly, rolls back, and leaves your branch untainted.

### 🌿 3. "Infinite Loop" Circuit Breakers
If SRE Co-Pilot runs on an active branch that it already created (matching the `devops-copilot/*` pattern), the script instantly aborts. This prevents infinite AI branching recursion loops in the event of continuous network outages.

### 🩹 4. Robust Path Drift Resolution
Logs from subfolders (e.g. inside `app/` or `services/`) often report paths like `src/routes/heal.ts` instead of `app/src/routes/heal.ts`. SRE Co-Pilot performs a dual-pass recursive walking search on the cloned folder to automatically resolve path drift, making it fully compatible with monorepos and nested setups.

---

## 📁 Project Structure

```
AI-DevOps-Optimizer/
├── app/                          # Application source
│   ├── src/
│   │   ├── index.ts              # Express API entry point
│   │   ├── routes/               # API route handlers
│   │   │   ├── health.ts         # Health & readiness probes
│   │   │   ├── analyze.ts        # Pipeline log analysis endpoint
│   │   │   └── optimize.ts       # Config optimization endpoint
│   │   ├── services/
│   │   │   ├── llm.ts            # LLM client (OpenAI / LangChain)
│   │   │   ├── pipeline.ts       # Pipeline log parser & processor
│   │   │   └── metrics.ts        # Prometheus metrics service
│   │   └── __tests__/            # Unit & integration tests
│   ├── Dockerfile                # Multi-stage production build
│   ├── .dockerignore
│   ├── package.json
│   └── tsconfig.json
│
├── k8s/                          # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
│
├── helm/                         # Helm chart
│   └── ai-devops-optimizer/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│
├── terraform/                    # Infrastructure as Code
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── monitoring/                   # Observability stack
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Build, test, lint, scan
│       ├── cd.yml                # Deploy to K8s
│       └── ai-review.yml        # LLM-powered PR review
│
├── docker-compose.yml            # Local development stack
├── .env.example                  # Environment variable template
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 20 LTS
- **Docker** & **Docker Compose**
- **kubectl** (for K8s deployment)
- An **OpenAI API key** (or compatible LLM endpoint)

### Run Locally

```bash
# Clone the repo
git clone https://github.com/Hamza119612/AI-DevOps-Optimizer.git
cd AI-DevOps-Optimizer

# Copy environment config
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start everything (app + Prometheus + Grafana)
docker-compose up -d

# The API is live at http://localhost:3000
# Grafana dashboard at http://localhost:3001
# Prometheus at http://localhost:9090
```

### Run Tests

```bash
cd app
npm install
npm test
```

---

## 🛣️ Roadmap

The project is built in phases, each designed to teach a specific DevOps domain:

### Phase 1 — Foundation ✅
- [x] Express + TypeScript API scaffold
- [x] Prometheus metrics endpoint (`/metrics`)
- [x] Dockerfile & basic GitHub Actions pipeline
- [x] Unit testing with Jest + Supertest

### Phase 2 — Harden the Pipeline ✅
- [x] Fix CI/CD: Node version alignment, `actions@v4`, PR triggers
- [x] Multi-stage Docker build with non-root user
- [x] Add `.dockerignore`, `.env.example`, proper `.gitignore`
- [x] ESLint + Prettier for code quality
- [x] Container image scanning with Trivy

### Phase 3 — LLM Integration ✅
- [x] OpenAI/NVIDIA NIM service layer (`src/services/llm.ts`)
- [x] `POST /api/analyze` — parse pipeline logs with LLM
- [x] `POST /api/optimize` — review pipeline config with LLM
- [x] Rate limiting & cost controls for API calls
- [x] Pipeline log pre-processor (`src/services/pipeline.ts`)
- [x] LLM metrics tracking (token usage, latency, cost)
- [x] End-to-end integration tests with mocked LLM

### Phase 4 — Kubernetes & Helm ✅
- [x] K8s manifests (Deployment, Service, Ingress, HPA)
- [x] Helm chart with configurable `values.yaml`
- [x] Health checks (`/healthz`, `/readyz`) with NVIDIA NIM reachability
- [x] Resource limits & requests
- [x] CD pipeline to deploy to K8s via GitHub Actions (Helm)

### Phase 5 — Monitoring & Observability ✅
- [x] Prometheus scrape configuration
- [x] Grafana dashboards (request rate, latency, error rate, LLM usage)
- [x] Structured logging with Pino
- [ ] Alerting rules (pipeline failure spike, high error rate)

### Phase 6 — Infrastructure as Code ✅
- [x] Terraform modules for EKS & VPC networking
- [x] Remote state management (S3 + DynamoDB locking)
- [ ] Environment separation (dev / staging / prod)

### Phase 7 — Advanced AI Features 🤖
- [x] The 'Draft-PR' SRE Co-Pilot (Bypass Git Boilerplate)
- [ ] RAG pipeline over internal runbooks / docs
- [ ] AI-powered PR review bot via GitHub Actions
- [ ] Cost optimization insights from LLM analysis
- [ ] Fine-tuning on your own pipeline history

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/healthz` | Liveness probe |
| `GET` | `/readyz` | Readiness probe |
| `GET` | `/metrics` | Prometheus metrics |
| `POST` | `/api/analyze` | Analyze pipeline logs with LLM |
| `POST` | `/api/optimize` | Get optimization suggestions for pipeline config |
| `POST` | `/api/heal` | Spawn Git SRE Co-Pilot to patch code and open a Draft Pull Request |

---

## 🛡️ Security

- Container runs as **non-root user**
- Docker images scanned with **Trivy** on every build
- Secrets managed via **GitHub Actions Secrets** (no hardcoded credentials)
- API keys validated and rate-limited
- RBAC-ready K8s deployment

---

## 🧰 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 20 LTS, TypeScript 5 |
| **Framework** | Express.js |
| **AI/LLM** | OpenAI API, LangChain.js, RAG |
| **Containerization** | Docker (multi-stage) |
| **Orchestration** | Kubernetes, Helm |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Prometheus, Grafana, Pino |
| **IaC** | Terraform |
| **Security** | Trivy, SOPS, OPA |
| **Testing** | Jest, Supertest |

---

## 🤝 Contributing

This is a personal learning project, but contributions are welcome! If you'd like to:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 🔧 to learn DevOps the hard way — by actually doing it.**

</div>
