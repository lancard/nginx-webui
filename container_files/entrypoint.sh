#!/bin/bash
set -e

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

if [ -n "$SSH_PUBLIC_KEY" ]; then
    echo "🔑 SSH_PUBLIC_KEY detected."

    # install openssh-server
    if ! command -v sshd >/dev/null 2>&1; then
        echo "📦 Installing openssh-server..."
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y -qq openssh-server
    fi

    echo "🔧 Configuring SSH..."
    mkdir -p /var/run/sshd
    mkdir -p /root/.ssh
    echo "$SSH_PUBLIC_KEY" > /root/.ssh/authorized_keys
    chmod 700 /root/.ssh
    chmod 600 /root/.ssh/authorized_keys

    # ssh host key
    ssh-keygen -A

    # allow root login
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config

    echo "🚀 Starting sshd..."
    /usr/sbin/sshd -D
else
    echo "ℹ️ SSH_PUBLIC_KEY not set. Skipping SSH setup."
    exec "$@"
fi

/docker-entrypoint.sh

npm run start &

nginx -g "daemon off;"
