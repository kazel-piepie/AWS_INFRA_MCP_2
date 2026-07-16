# ---------------------------------------------------------------------------
# Dedicated IAM user "billing" for human billing administration via the AWS
# console on this account (239460481239). Console login only (no programmatic
# access key): manages the Billing and Cost Management console end to end --
# viewing costs, creating/editing budgets, Savings Plans, Cost Optimization
# Hub, Marketplace subscriptions, payment methods, invoices, tax settings,
# etc. No MFA is enforced by policy. The initial console password is exposed
# only as a sensitive Terraform output and is never stored in code or
# committed.
# ---------------------------------------------------------------------------

resource "aws_iam_user" "billing" {
  name = "${local.name}-billing"
  path = "/billing/"

  tags = merge(local.tags, {
    Name    = "${local.name}-billing"
    Purpose = "billing-console-administration"
  })
}

# Console login. No PGP key, so the generated password is available as a
# Terraform attribute and surfaced through a sensitive output below. The user
# must change the password on first sign-in.
resource "aws_iam_user_login_profile" "billing" {
  user                    = aws_iam_user.billing.name
  password_length         = 20
  password_reset_required = true

  lifecycle {
    # Do not churn the password on every apply once it has been set.
    ignore_changes = [password_length, password_reset_required]
  }
}

# ---------------------------------------------------------------------------
# Billing permissions. AWS managed "Billing" job-function policy covers most
# of the console (Cost Explorer, Budgets, payment methods, invoices, tax
# settings, Free Tier, consolidated billing), plus three more managed
# policies for areas it does not cover: Savings Plans, Cost Optimization Hub,
# and AWS Marketplace subscription management.
# ---------------------------------------------------------------------------
resource "aws_iam_user_policy_attachment" "billing" {
  user       = aws_iam_user.billing.name
  policy_arn = "arn:aws:iam::aws:policy/job-function/Billing"
}

resource "aws_iam_user_policy_attachment" "billing_savings_plans" {
  user       = aws_iam_user.billing.name
  policy_arn = "arn:aws:iam::aws:policy/AWSSavingsPlansFullAccess"
}

resource "aws_iam_user_policy_attachment" "billing_cost_optimization_hub" {
  user       = aws_iam_user.billing.name
  policy_arn = "arn:aws:iam::aws:policy/CostOptimizationHubAdminAccess"
}

resource "aws_iam_user_policy_attachment" "billing_marketplace_subscriptions" {
  user       = aws_iam_user.billing.name
  policy_arn = "arn:aws:iam::aws:policy/AWSMarketplaceManageSubscriptions"
}

# ---------------------------------------------------------------------------
# Custom supplement policy for billing-console tasks not fully covered by the
# managed policies above: full read access to Cost Explorer (forecasts,
# recommendations, anomalies), plus account contact/alternate-contact
# management and region opt-in controls. These are account/billing-level
# actions that do not support resource-level permissions, so Resource is "*".
# account:CloseAccount is deliberately excluded as too dangerous.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "billing_console_supplement" {
  statement {
    sid    = "CostExplorerReadOnly"
    effect = "Allow"
    actions = [
      "ce:Get*",
      "ce:List*",
      "ce:Describe*",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "AccountContactAndRegionManagement"
    effect = "Allow"
    actions = [
      "account:GetContactInformation",
      "account:PutContactInformation",
      "account:GetAlternateContact",
      "account:PutAlternateContact",
      "account:DeleteAlternateContact",
      "account:GetRegionOptStatus",
      "account:ListRegions",
      "account:EnableRegion",
      "account:DisableRegion",
      "account:GetPrimaryEmail",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "billing_console_supplement" {
  name        = "${local.name}-billing-console-supplement"
  description = "Supplemental billing console permissions: Cost Explorer read, account contact and region opt-in management"
  policy      = data.aws_iam_policy_document.billing_console_supplement.json
}

resource "aws_iam_user_policy_attachment" "billing_console_supplement" {
  user       = aws_iam_user.billing.name
  policy_arn = aws_iam_policy.billing_console_supplement.arn
}

# ---------------------------------------------------------------------------
# Outputs. The console password is sensitive and never printed in plaintext to
# logs, code or commits; retrieve it with:
#   terraform output -raw billing_console_password
# ---------------------------------------------------------------------------
output "billing_user_name" {
  description = "IAM user name for billing console administration"
  value       = aws_iam_user.billing.name
}

output "billing_console_password" {
  description = "Initial console password for the billing IAM user (reset required on first sign-in)"
  value       = aws_iam_user_login_profile.billing.password
  sensitive   = true
}
