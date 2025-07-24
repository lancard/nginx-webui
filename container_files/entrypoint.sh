#!/bin/bash

# no password file
if [ ! -f /data/password.json ]
then
    # generate password
    npm run password
fi

# check self-signed cert
if [ -d /etc/letsencrypt/live/localhost_nginx_webui ]
then
    echo "self-signed cert exist"
else
    # make directory
    mkdir -p /etc/letsencrypt/live/localhost_nginx_webui

    # generate self-signed
    openssl req -x509 -nodes -days 36500 -subj "/C=CA/ST=QC/O=Company Inc/CN=localhost" -newkey rsa:2048 -keyout /etc/letsencrypt/live/localhost_nginx_webui/privkey.pem -out /etc/letsencrypt/live/localhost_nginx_webui/fullchain.pem
fi

# copy config back to nginx (for update engine)
if [ -f /data/nginx.conf ]
then
    cp /data/nginx.conf /etc/nginx/nginx.conf
else
    # copy default config
    cp /nginx_config/default_config.json /data/config.json
    cp /data/nginx.conf /etc/nginx/nginx.conf
fi

/docker-entrypoint.sh

npm run start &

nginx -g "daemon off;"
