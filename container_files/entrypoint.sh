#!/bin/bash

# first run
if [ ! -f /data/password.txt ]
then
    tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /data/password.txt
    echo "generated admin password :"
    cat /data/password.txt
    echo ""
    echo ""

    cp /nginx_config/default_config.json /data/config.json
fi

/docker-entrypoint.sh

node index.js &

nginx -g "daemon off;"