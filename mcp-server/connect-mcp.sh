#!/bin/bash
# connect-mcp.sh — ECS Exec into the MCP server container

set -e

# Load .env from parent directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=""
for dir in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.."; do
  if [[ -f "$dir/.env" ]]; then
    ENV_FILE="$dir/.env"
    break
  fi
done

if [[ -n "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  echo "[connect-mcp] Loaded .env from $ENV_FILE"
else
  echo "[connect-mcp] WARNING: .env not found — using existing environment variables"
fi

if [[ -z "$AWS_ACCESS_KEY_ID" ]]; then
  echo "[connect-mcp] WARNING: AWS credentials not found in .env"
fi

CLUSTER="${MCP_CLUSTER:-ai-mcp-develop-infra-cluster}"
CONTAINER="${MCP_CONTAINER:-mcp-server}"
REGION="${AWS_REGION:-us-east-1}"

echo "[connect-mcp] Cluster: $CLUSTER"
echo "[connect-mcp] Region:  $REGION"

# Check session-manager-plugin
if ! command -v session-manager-plugin &>/dev/null; then
  echo ""
  echo "ERROR: session-manager-plugin is not installed."
  echo ""
  echo "Install on WSL/Ubuntu:"
  echo "  curl -fsSL https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb -o /tmp/ssm.deb"
  echo "  dpkg -x /tmp/ssm.deb /tmp/ssm-plugin"
  echo "  cp /tmp/ssm-plugin/usr/local/sessionmanagerplugin/bin/session-manager-plugin ~/bin/"
  echo "  export PATH=\"\$HOME/bin:\$PATH\""
  exit 1
fi

# Get running task ARN
echo "[connect-mcp] Looking up running task..."
TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --desired-status RUNNING \
  --region "$REGION" \
  --no-cli-pager \
  --query 'taskArns[0]' \
  --output text)

if [[ "$TASK_ARN" == "None" || -z "$TASK_ARN" ]]; then
  echo "ERROR: No running tasks found in cluster $CLUSTER"
  exit 1
fi

echo "[connect-mcp] Task: $TASK_ARN"
echo ""
echo "Connecting... (After connecting, run: su -s /bin/bash mcpuser)"
echo ""

aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container "$CONTAINER" \
  --interactive \
  --command "/bin/bash" \
  --region "$REGION" \
  --no-cli-pager
