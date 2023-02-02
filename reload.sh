SERVICE_NAME=`grep container_name docker-compose.yml | cut -d: -f 2 | tr -d ' '`
docker-compose exec $SERVICE_NAME bash -c "killall node"
docker-compose exec $SERVICE_NAME bash -c "node index.js"