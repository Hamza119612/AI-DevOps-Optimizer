# Terraform — AI DevOps Optimizer Infrastructure
#
# This is a starter Terraform configuration. Customize the provider
# and resources for your target cloud (AWS, GCP, Azure).
#
# Phase 6 will expand this with:
#   - Kubernetes cluster provisioning
#   - Networking (VPC, subnets, security groups)
#   - Container registry
#   - Remote state backend (S3 + DynamoDB / GCS)

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # Uncomment the provider for your cloud:

    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.0"
    # }

    # google = {
    #   source  = "hashicorp/google"
    #   version = "~> 5.0"
    # }

    # azurerm = {
    #   source  = "hashicorp/azurerm"
    #   version = "~> 3.0"
    # }
  }
}

# provider "aws" {
#   region = var.region
# }
