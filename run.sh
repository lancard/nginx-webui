#!/bin/bash

/docker-entrypoint.sh

node index.js &

nginx -g "daemon off;"