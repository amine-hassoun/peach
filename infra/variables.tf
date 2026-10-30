variable "token_sha256" {
  description = "SHA-256 hex of the secret token (scripts/gen-token.sh). Only the hash ever reaches AWS."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9a-f]{64}$", var.token_sha256))
    error_message = "token_sha256 must be 64 lowercase hex characters."
  }
}

variable "alert_email" {
  description = "Where the Lambda error alarm emails go."
  type        = string
}

variable "github_repo" {
  description = "owner/repo allowed to assume the CI role."
  type        = string
  default     = "amine-hassoun/peach"
}

variable "state_bucket" {
  description = "Shared Terraform state bucket (Project 2)."
  type        = string
  default     = "amine-hassoun-aws-terraform-infra-state"
}
