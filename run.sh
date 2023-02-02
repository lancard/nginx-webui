#!/bin/bash

if [ ! -f /data/password.txt ]
then
    tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /data/password.txt
    echo "generated admin password :"
    cat /data/password.txt
    echo ""
    echo ""
fi

/docker-entrypoint.sh

node index.js &

nginx -g "daemon off;"