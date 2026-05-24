# Remote State Backend Configuration
# 
# Storing Terraform state in S3 with state locking via DynamoDB
# ensures team collaboration without race conditions or state corruption.

terraform {
  backend "s3" {
    bucket         = "ai-devops-optimizer-tf-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ai-devops-optimizer-tf-locks"
  }
}
