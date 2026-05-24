output "project_name" {
  description = "The project name"
  value       = var.project_name
}

output "environment" {
  description = "The deployment environment"
  value       = var.environment
}

output "vpc_id" {
  description = "The ID of the provisioned VPC"
  value       = aws_vpc.main.id
}

output "cluster_endpoint" {
  description = "Kubernetes cluster API endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "Kubernetes cluster name"
  value       = aws_eks_cluster.main.name
}

output "ecr_repository_url" {
  description = "The URL of the private ECR container registry"
  value       = aws_ecr_repository.app.repository_url
}
