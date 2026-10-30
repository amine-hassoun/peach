output "function_url" {
  description = "The app. Her personal link is this URL + #k=<token>."
  value       = aws_lambda_function_url.sync.function_url
}

output "ci_role_arn" {
  description = "Set as the AWS_ROLE_ARN GitHub Actions variable."
  value       = aws_iam_role.ci.arn
}
