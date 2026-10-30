#!/usr/bin/env bash
# One-time: make her secret token. The token goes in a password manager; only its hash goes to AWS.
set -euo pipefail
TOKEN=$(openssl rand -hex 32)
HASH=$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)
echo "TOKEN (password manager, never commit): $TOKEN"
echo "export TF_VAR_token_sha256=$HASH"
