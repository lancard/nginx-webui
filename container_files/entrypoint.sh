#!/bin/bash

# first run
if [ ! -f /data/password.txt ]
then
    # generate password
    tr -dc A-Za-z0-9 </dev/urandom | head -c 32 > /data/password.txt
    echo "generated admin password :"
    cat /data/password.txt
    echo ""
    echo ""

    # copy default config
    cp /nginx_config/default_config.json /data/config.json

    # make directory
    mkdir -p /etc/letsencrypt/live/localhost_nginx_webui

    # generate self-signed
    openssl req -x509 -nodes -days 36500 -subj "/C=CA/ST=QC/O=Company Inc/CN=localhost" -newkey rsa:2048 -keyout /etc/letsencrypt/live/localhost_nginx_webui/privkey.pem -out /etc/letsencrypt/live/localhost_nginx_webui/fullchain.pem
fi

/docker-entrypoint.sh

node index.js &

nginx -g "daemon off;"
