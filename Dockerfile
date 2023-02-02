FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update
RUN apt-get install certbot python3-certbot-nginx cron npm nodejs -y
RUN apt-get upgrade -y

# copy backup folder
COPY default_nginx.conf /nginx_config/default_nginx.conf
RUN cp /nginx_config/default_nginx.conf /etc/nginx/nginx.conf
COPY admin /admin
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /data

WORKDIR /admin

RUN npm install

ENTRYPOINT ["/run.sh"]