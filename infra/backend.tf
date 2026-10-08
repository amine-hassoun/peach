terraform {
  backend "s3" {
    bucket         = "amine-hassoun-aws-terraform-infra-state"
    key            = "peach/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}