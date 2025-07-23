#!/bin/bash

echo -n $CERTBOT_VALIDATION > /tmp/$CERTBOT_DOMAIN

# wait until dig complete
while :
do
    dig -t txt @8.8.8.8 _acme-challenge.$CERTBOT_DOMAIN +short | grep "$CERTBOT_VALIDATION" > /dev/null
    if [ $? -eq 0 ]
    then
        sleep 10
        break
    fi

    sleep 5
done