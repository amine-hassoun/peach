#!/usr/bin/env sh
# Assemble the Lambda bundle: handler.py + the built site. Run after `npm run build`.
set -eu
[ -d dist ] || { echo "dist/ missing: run npm run build first" >&2; exit 1; }
rm -rf build/lambda
mkdir -p build/lambda
cp lambda/handler.py build/lambda/
cp -r dist build/lambda/dist
echo "packaged: $(find build/lambda -type f | wc -l) files"
