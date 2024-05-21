#!/bin/bash

rm -f /tmp/$1
touch /tmp/$1

certbot certonly -n --manual --preferred-challenges=dns --manual-auth-hook /admin/shell/dns-challenge-start.sh --manual-cleanup-hook /admin/shell/dns-challenge-cleanup.sh --agree-tos -d $1 -m $2 2>/dev/null 1>/dev/null &

sleep 10

cat /tmp/$1