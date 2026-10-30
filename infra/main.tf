data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ---------- data: one item, provisioned 1/1 (Always Free pool, never on-demand) ----------
resource "aws_dynamodb_table" "stays" {
  #checkov:skip=CKV2_AWS_16: fixed 1/1 provisioned capacity keeps the account inside the shared 25/25 Always Free pool; auto scaling would add cost surface
  name           = "peach-stays"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "pk"

  attribute {
    name = "pk"
    type = "S"
  }
}

# ---------- Lambda: serves the site AND the API; NOT attached to any VPC ----------
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../build/lambda" # produced by scripts/package.sh (handler.py + dist/)
  output_path = "${path.module}/peach-sync.zip"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/peach-sync"
  retention_in_days = 14
}

data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "peach-sync-role"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

resource "aws_iam_role_policy" "lambda" {
  name = "peach-sync-access"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "OneTableTwoActions"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
        Resource = aws_dynamodb_table.stays.arn
      },
      {
        Sid      = "WriteOwnLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "sync" {
  function_name    = "peach-sync"
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.13"
  handler          = "handler.handler"
  architectures    = ["arm64"]
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  memory_size      = 128
  timeout          = 10

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.stays.name
      TOKEN_SHA256 = var.token_sha256
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy.lambda]
}

resource "aws_lambda_function_url" "sync" {
  function_name      = aws_lambda_function.sync.function_name
  authorization_type = "NONE" # the app-level token guards /api; the site shell holds no data
}

# A Function URL with AuthType NONE needs BOTH statements, or it returns a persistent 403.
resource "aws_lambda_permission" "url" {
  #checkov:skip=CKV_AWS_301: public Function URL by design; the handler returns 401 before any database call unless the secret token hash matches
  statement_id           = "AllowPublicInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.sync.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "invoke" {
  #checkov:skip=CKV_AWS_301: second statement a public Function URL requires (InvokeFunction alongside InvokeFunctionUrl)
  statement_id  = "AllowPublicInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync.function_name
  principal     = "*"
}
