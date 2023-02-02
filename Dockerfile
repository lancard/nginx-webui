FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update
RUN apt-get install certbot python3-certbot-nginx cron npm nodejs net-tools -y
RUN apt-get upgrade -y

RUN echo "net.ipv4.tcp_fin_timeout=3" >> /etc/sysctl.conf

# copy config folder
COPY default_nginx.conf /nginx_config/default_nginx.conf
COPY default_config.json /data/config.json
RUN cp /nginx_config/default_nginx.conf /etc/nginx/nginx.conf
COPY admin /admin
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /cert

WORKDIR /data

WORKDIR /admin

RUN npm install

ENTRYPOINT ["/run.sh"]