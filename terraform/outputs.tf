output "project_name" {
  description = "The project name"
  value       = var.project_name
}

output "environment" {
  description = "The deployment environment"
  value       = var.environment
}

# Uncomment and update when infrastructure resources are provisioned:
#
# output "cluster_endpoint" {
#   description = "Kubernetes cluster API endpoint"
#   value       = aws_eks_cluster.main.endpoint
# }
#
# output "cluster_name" {
#   description = "Kubernetes cluster name"
#   value       = aws_eks_cluster.main.name
# }
