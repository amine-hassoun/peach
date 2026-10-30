terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # No credentials here: AWS_PROFILE locally, OIDC-exchanged credentials in CI.
  backend "s3" {
    bucket         = "amine-hassoun-aws-terraform-infra-state"
    key            = "peach/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-west-3"

  default_tags {
    tags = {
      Project   = "peach"
      ManagedBy = "terraform"
    }
  }
}
