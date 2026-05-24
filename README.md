# 🤖 AI DevOps Optimizer & SRE Co-Pilot

**A production-grade, highly-observable, autonomous SRE platform that triages, compile-validates, and self-heals CI/CD pipelines in real time.**

---

<div align="center">

[![CI/CD Pipeline](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions/workflows/main.yml/badge.svg)](https://github.com/Hamza119612/AI-DevOps-Optimizer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/K8s-Orchestrated-326CE5.svg)](https://kubernetes.io)
[![Terraform](https://img.shields.io/badge/IaC-Terraform_1.5+-5C4EE5.svg)](https://terraform.io)

*An advanced, enterprise-grade AI Operations (AIOps) learning engine. Built to showcase modern cloud native architecture, infrastructure automation, telemetry pipelines, and autonomous AI-driven SRE feedback loops.*

</div>

---

## 📌 The Core Value Proposition

When CI/CD pipelines fail in standard DevOps workflows, developers must manually dig through thousands of lines of verbose compiler and test logs, isolate the root cause, write a code fix, locally check if it compiles, push a branch, and open a Pull Request. This represents significant downtime and friction.

**AI DevOps Optimizer** completely automates this lifecycle. It ingests pipeline crash telemetry, pre-processes logs in-memory to reduce noise, employs Large Language Models (LLMs) to diagnose the exact root cause, applies a surgical code patch, validates the patch inside a **Local Compilation Guard**, and programmatically delivers a **Draft Pull Request** directly to your GitHub repository—all in under 60 seconds.

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
                                │             ▼
                                │  ┌────────────────────┐  │
                                │  │   PII Scrubber     │  │
                                │  └──────────┬─────────┘  │
                                │             │ 3. Noise Filtered Logs
                                │             ▼
       ┌────────────────────────┼─────────────┼────────────┐
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

## ☕ The Architectural Analogy (Starbucks Coffee Shop)

To understand how the DevOps components of this platform synergize, think of this platform as a **Premium Coffee Shop Franchise**:

### 🧱 1. Terraform is "The Construction Crew"
* **The Role:** Terraform goes to the site, buys the land, pours the concrete foundation, installs the water plumbing, and hooks up the main high-voltage power lines.
* **In Tech:** It automates your cloud network (`VPC`, subnets, route tables) and constructs the **AWS EKS Kubernetes Cluster**. You get a safe, standardized physical building without manually clicking through AWS console pages.

### 🚢 2. Kubernetes (K8s) is "The Store Manager"
* **The Role:** Once the store is built, the store manager runs the daily operations:
  * **Self-Healing (Barista Sick):** If a barista (Express API node) falls ill or drops a tray, the manager instantly replaces them with a fresh, identical barista from the back room within 3 seconds.
  * **Autoscaling (Morning Rush):** At 8:00 AM, a bus unloads 100 customers. The manager immediately opens **3 more cash registers** (Express pods) to handle the queue, and shuts them down at 10:00 AM to save on payroll (cloud costs).
  * **Zero-Downtime (Menu Upgrades):** When upgrading register software, the manager updates Register 1 first, ensures it is working, then moves to Register 2—ensuring transactions are never interrupted.

### 📦 3. Helm is "The Franchise Blueprint Kit"
* **The Role:** You want to open three different locations: a small Test Kiosk (**Dev**), a mid-sized Corporate Shop (**Staging**), and a giant Times Square Store (**Prod**). 
* **In Tech:** Helm packages your massive Kubernetes YAML manifests once, letting you customization all environments using a simple settings sheet (`values.yaml`):
  * **Dev Store settings:** `Baristas: 1`, `BeanQuality: budget`, `NeonLights: off` (low cloud cost).
  * **Prod Store settings:** `Baristas: 10`, `BeanQuality: premium`, `NeonLights: ON` (high reliability).

---

## 🛡️ Senior SRE Resilience & Safeguards

Building autonomous code modification systems requires industrial-grade guardrails. The SRE Co-Pilot engine features 4 architectural safeguards built natively into the CLI executor:

### 1. 🧼 Data Privacy & PII Scrubber
Raw CI logs often contain base64 database connection strings, credentials, authn tokens (`ghp_...`), or customer emails. Our CLI runs a regex-driven **PII & Secret Scrubber** in-memory on the runner *before* transmitting telemetry to the external LLM, replacing high-entropy secrets with `[REDACTED]`.

### 🛡️ 2. The "Self-Correction" Local Compilation Guard
To prevent pushing broken code that would trigger infinite pipeline loops and waste runner minutes:
* The CLI applies the patch locally and immediately runs the project's build suite (`npm run build` or `tsc`).
* If compilation fails, it captures the **new compiler output** and feeds it back to the LLM in a **2-retry self-reflection loop**.
* If the code remains broken after the second retry, it rolls back and aborts cleanly without pushing to origin.

### 🌿 3. "Infinite Loop" Circuit Breakers
If SRE Co-Pilot is executed on a branch that already matches the `devops-copilot/*` pattern, **the script instantly terminates**. SRE Co-Pilot will never attempt to auto-patch a branch it already created.

### 🩹 4. Robust Path Drift Resolution
Logs from subfolders (e.g. inside `app/` or `services/`) often report relative compilation paths like `src/routes/heal.ts` rather than the repository's root path `app/src/routes/heal.ts`. SRE Co-Pilot performs a dual-pass recursive walking search on the cloned folder to automatically resolve path drift, making it fully compatible with monorepos and nested setups.

---

## ⚡ Zero-Friction 2-Minute CI/CD Integration

You can integrate SRE Co-Pilot into any nested project or monorepo in **under 2 minutes** using standard GitHub Actions and our compiled CLI utility, without running any hosted servers!

### 🔧 2-Minute Integration Template
1. Go to your repository settings on GitHub -> **Settings -> Actions -> General**.
2. Scroll to **Workflow permissions**, check **"Allow GitHub Actions to create and approve pull requests"**, and click **Save**.
3. Add `NVIDIA_API_KEY` (or `OPENAI_API_KEY`) to your GitHub Repository Secrets.
4. Copy the copy-pasteable workflow template to your repository at `.github/workflows/ai-copilot.yml`:

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
      contents: write       # Crucial: Allow GITHUB_TOKEN to push branches
      pull-requests: write  # Crucial: Allow GITHUB_TOKEN to open Draft PRs

    steps:
      - name: ⚙️ Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Crucial: Fetch full history for Git branching

      - name: 🟢 Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci

      # --- 1. Run build suite, redirecting output to a file ---
      - name: 🧪 Run Compilation & Test Suite
        run: |
          npm run build > build_failure.log 2>&1

      # --- 2. Spawns ONLY if the compilation step above fails ---
      - name: 🩹 Trigger AI SRE Co-Pilot Auto-Patch
        if: failure()
        env:
          NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "🚨 Build failed. Initiating AI SRE Triage & Auto-Patching..."
          npx --package @hamza/ai-devops-optimizer cli-heal --logs build_failure.log
```

---

## 🔌 API Endpoints (Hosted Mode)

If you prefer to run the platform as a centralized backend server, the Express API exposes the following endpoints (protected by rate limiters and fully instrumented with Prometheus telemetry):

| Method | Endpoint | Description | Payload Schema |
|--------|----------|-------------|----------------|
| `GET` | `/healthz` | Liveness Probe (NIM Reachability) | *None* |
| `GET` | `/readyz` | Readiness Probe | *None* |
| `GET` | `/metrics` | Prometheus Telemetry Data | *None* |
| `POST` | `/api/analyze` | Parse logs and return structured JSON diagnosis | `{"logs": "..."}` |
| `POST` | `/api/optimize` | Get optimization suggestions for Dockerfile/K8s YAMLs | `{"config": "...", "type": "dockerfile"}` |
| `POST` | `/api/heal` | Orchestrates remote cloning, patching, and PR creation | `{"logs": "...", "repoUrl": "...", "githubToken": "..."}` |

---

## 📊 Observability Dashboard (Prometheus & Grafana)

The platform is designed with an **"Observability First"** mindset. Every application transaction compiles telemetry metrics scraped by Prometheus and displayed on Grafana:
* **LLM Usage Telemetry:** Token counts, request latency, and approximate API spend metrics.
* **Express API Telemetry:** HTTP request rates, response durations, and error rate tracking.
* **Structured Pino Logs:** JSON formatted logging tracing requests with correlation `requestId` headers.

---

## 📁 Repository Structure

```
AI-DevOps-Optimizer/
├── app/                          # Express backend API & CLI source
│   ├── src/
│   │   ├── index.ts              # Express API entry point
│   │   ├── routes/               # Express routing controllers
│   │   ├── services/             # Telemetry, Git, and LLM services
│   │   │   ├── llm.ts            # NVIDIA NIM / OpenAI client
│   │   │   ├── git.ts            # Git cloner & PR creator
│   │   │   ├── logger.ts         # Structured Pino logger
│   │   │   └── metrics.ts        # Prometheus instrumentation
│   │   ├── scripts/              # SRE CLI executors
│   │   │   └── cli-heal.ts       # Standalone runner script
│   │   └── __tests__/            # Jest test assertions (34/34 green)
│   ├── Dockerfile                # Multi-stage hardened production image
│   └── package.json
│
├── terraform/                    # High-availability cloud IaC
│   ├── main.tf                   │- High-availability multi-AZ VPC
│   ├── backend.tf                │- EKS Control Plane & EC2 Worker groups
│   └── outputs.tf                │- Remote S3/DynamoDB state locking
│
├── helm/                         # Production Kubernetes templates
│   └── ai-devops-optimizer/      └- Deployments, services, HPA, & values
│
├── templates/                    # CI/CD integration workflow templates
│   └── action-template.yml       └- Copy-pasteable GitHub Actions template
│
├── monitoring/                   # Observability scraping & dashboards
│   ├── prometheus/               
│   └── grafana/                  
└── docker-compose.yml            # Local DevOps development orchestrator
```

---

## 🧰 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend & CLI** | Node.js 20 LTS, TypeScript 5, Express, Pino Logger |
| **Artificial Intelligence** | NVIDIA NIM, OpenAI API, Llama-3.3-70b-Instruct |
| **Infrastructure as Code** | Terraform 1.5+, AWS S3, AWS DynamoDB state locking |
| **Containerization** | Docker (hardened, non-root, multi-stage builds) |
| **Orchestration** | Kubernetes, Helm v3, Horizontal Pod Autoscaler (HPA) |
| **Observability** | Prometheus, Grafana, prom-client |
| **Testing** | Jest, Supertest (100% test coverage) |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 🔧 to automate operational overhead and accelerate developer velocity.**

</div>
