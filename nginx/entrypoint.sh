#!/bin/sh
# Sanity check that BACKEND_URL is set before the nginx-image's
# 20-envsubst-on-templates.sh tries to render the config with an empty value.
# Numerical prefix 05 puts us ahead of nginx's own startup scripts.
set -e

if [ -z "$BACKEND_URL" ]; then
    echo "[entrypoint] FATAL: BACKEND_URL env var is not set" >&2
    echo "[entrypoint] Expected something like http://internal-cs436-backend-alb-xxxxxx.eu-west-1.elb.amazonaws.com" >&2
    exit 1
fi

echo "[entrypoint] BACKEND_URL=${BACKEND_URL}"
