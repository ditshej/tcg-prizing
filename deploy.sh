#!/bin/sh
set -eu

# There is no build step (ADR 0004) and nothing to upload: the server pulls
# the repository itself. This script only triggers _deploy.sh over SSH.

if [ ! -f .env.deploy ]; then
    echo "Error: .env.deploy not found. Copy .env.deploy.example and fill in your credentials." >&2
    exit 1
fi

set -a
. ./.env.deploy
set +a

echo "Deploying..."
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" -t \
    "cd '$DEPLOY_PATH' && DEPLOY_BRANCH='${DEPLOY_BRANCH:-main}' bash ./_deploy.sh"
