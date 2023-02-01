#!/bin/bash

/docker-entrypoint.sh

echo "1"

node index.js &

echo "2"

nginx -g "daemon off;"