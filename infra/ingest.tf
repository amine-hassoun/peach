data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  ingest_secret_param = "/peach/ingest-shared-secret"
}

data "archive_file" "ingest" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/ingest"
  output_path = "${path.module}/build/ingest.zip"
}

resource "aws_cloudwatch_log_group" "ingest" {
  name              = "/aws/lambda/peach-ingest"
  retention_in_days = 14
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ingest" {
  name               = "peach-ingest"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "ingest" {
  statement {
    sid       = "WriteJobs"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.jobs.arn]
  }
  statement {
    sid       = "ReadSharedSecret"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ingest_secret_param}"]
  }
  statement {
    sid       = "WriteLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.ingest.arn}:*"]
  }
}

resource "aws_iam_role_policy" "ingest" {
  name   = "peach-ingest"
  role   = aws_iam_role.ingest.id
  policy = data.aws_iam_policy_document.ingest.json
}

resource "aws_lambda_function" "ingest" {
  function_name    = "peach-ingest"
  role             = aws_iam_role.ingest.arn
  runtime          = "python3.13"
  handler          = "handler.handler"
  filename         = data.archive_file.ingest.output_path
  source_code_hash = data.archive_file.ingest.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      TABLE_NAME        = aws_dynamodb_table.jobs.name
      SECRET_PARAM_NAME = local.ingest_secret_param
    }
  }

  depends_on = [aws_cloudwatch_log_group.ingest]
}

resource "aws_lambda_function_url" "ingest" {
  function_name      = aws_lambda_function.ingest.function_name
  authorization_type = "NONE"
}

# A Function URL with AuthType NONE needs BOTH statements.
resource "aws_lambda_permission" "url_invoke" {
  statement_id           = "AllowPublicInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.ingest.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "invoke" {
  statement_id  = "AllowPublicInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "*"
}

output "ingest_url" {
  value = aws_lambda_function_url.ingest.function_url
}

output "jobs_table_name" {
  value = aws_dynamodb_table.jobs.name
}