#!/bin/bash

rm -f /tmp/$1
touch /tmp/$1

if [ "$3" = "true" ]; then
    certbot certonly -n --manual --preferred-challenges=dns --manual-auth-hook /admin/shell/dns-challenge-start.sh --manual-cleanup-hook /admin/shell/dns-challenge-cleanup.sh --agree-tos -d "*.$1" -d "$1" -m $2 2>>/tmp/$1.log 1>>/tmp/$1.log &
else
    certbot certonly -n --manual --preferred-challenges=dns --manual-auth-hook /admin/shell/dns-challenge-start.sh --manual-cleanup-hook /admin/shell/dns-challenge-cleanup.sh --agree-tos -d "$1" -m $2 2>>/tmp/$1.log 1>>/tmp/$1.log &
fi

sleep 10

cat /tmp/$1