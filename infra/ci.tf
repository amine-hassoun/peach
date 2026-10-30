# GitHub Actions role. The OIDC provider already exists (Project 2): reference it, never recreate it.
# This role is created by the first LOCAL apply; changes to it are applied locally, not by CI.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "assume_ci" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_oidc_subject_repo}:ref:refs/heads/main", "repo:${var.github_oidc_subject_repo}:pull_request"]
    }
  }
}

resource "aws_iam_role" "ci" {
  name               = "peach-ci"
  assume_role_policy = data.aws_iam_policy_document.assume_ci.json
}

locals {
  acct   = data.aws_caller_identity.current.account_id
  region = data.aws_region.current.region
}

resource "aws_iam_role_policy" "ci" {
  #checkov:skip=CKV_AWS_289:write access is scoped to peach-* resources by ARN
  #checkov:skip=CKV_AWS_290:write access is scoped to peach-* resources by ARN
  #checkov:skip=CKV_AWS_355:only Describe/List calls that AWS does not allow resource-scoping for use "*"
  #checkov:skip=CKV_AWS_286:iam write is limited to the single peach-sync-role ARN
  #checkov:skip=CKV_AWS_287:no credentials-exposure actions granted
  name = "peach-ci-access"
  role = aws_iam_role.ci.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "StateObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.state_bucket}/peach/*"
      },
      {
        Sid       = "StateList"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = "arn:aws:s3:::${var.state_bucket}"
        Condition = { StringLike = { "s3:prefix" = ["peach/*"] } }
      },
      {
        Sid      = "StateLock"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = "arn:aws:dynamodb:${local.region}:${local.acct}:table/terraform-locks"
      },
      {
        Sid      = "Lambda"
        Effect   = "Allow"
        Action   = "lambda:*"
        Resource = "arn:aws:lambda:${local.region}:${local.acct}:function:peach-sync"
      },
      {
        Sid      = "Table"
        Effect   = "Allow"
        Action   = "dynamodb:*"
        Resource = "arn:aws:dynamodb:${local.region}:${local.acct}:table/peach-stays"
      },
      {
        Sid    = "LambdaRoleManage"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
          "iam:TagRole", "iam:UntagRole", "iam:ListRolePolicies", "iam:PutRolePolicy", "iam:GetRolePolicy",
          "iam:DeleteRolePolicy", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole"
        ]
        Resource = "arn:aws:iam::${local.acct}:role/peach-sync-role"
      },
      {
        Sid       = "PassLambdaRole"
        Effect    = "Allow"
        Action    = "iam:PassRole"
        Resource  = "arn:aws:iam::${local.acct}:role/peach-sync-role"
        Condition = { StringEquals = { "iam:PassedToService" = "lambda.amazonaws.com" } }
      },
      {
        Sid      = "ReadOwnRoleForRefresh"
        Effect   = "Allow"
        Action   = ["iam:GetRole", "iam:ListRolePolicies", "iam:GetRolePolicy", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole"]
        Resource = "arn:aws:iam::${local.acct}:role/peach-ci"
      },
      {
        Sid      = "ReadOidcProvider"
        Effect   = "Allow"
        Action   = "iam:GetOpenIDConnectProvider"
        Resource = data.aws_iam_openid_connect_provider.github.arn
      },
      {
        Sid      = "LogGroup"
        Effect   = "Allow"
        Action   = "logs:*"
        Resource = ["arn:aws:logs:${local.region}:${local.acct}:log-group:/aws/lambda/peach-sync", "arn:aws:logs:${local.region}:${local.acct}:log-group:/aws/lambda/peach-sync:*"]
      },
      {
        Sid      = "LogDescribe"
        Effect   = "Allow"
        Action   = "logs:DescribeLogGroups"
        Resource = "arn:aws:logs:${local.region}:${local.acct}:log-group:*"
      },
      {
        Sid      = "Alarm"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:TagResource", "cloudwatch:UntagResource", "cloudwatch:ListTagsForResource"]
        Resource = "arn:aws:cloudwatch:${local.region}:${local.acct}:alarm:peach-*"
      },
      {
        Sid      = "AlarmDescribe"
        Effect   = "Allow"
        Action   = "cloudwatch:DescribeAlarms"
        Resource = "*"
      },
      {
        Sid    = "Topic"
        Effect = "Allow"
        Action = [
          "sns:CreateTopic", "sns:DeleteTopic", "sns:GetTopicAttributes", "sns:SetTopicAttributes", "sns:Subscribe",
          "sns:Unsubscribe", "sns:GetSubscriptionAttributes", "sns:ListSubscriptionsByTopic", "sns:TagResource",
          "sns:UntagResource", "sns:ListTagsForResource"
        ]
        Resource = ["arn:aws:sns:${local.region}:${local.acct}:peach-alerts", "arn:aws:sns:${local.region}:${local.acct}:peach-alerts:*"]
      }
    ]
  })
}
