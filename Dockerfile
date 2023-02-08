FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update
RUN apt-get install certbot python3-certbot-nginx cron npm nodejs net-tools -y
RUN apt-get upgrade -y

# system configuration
RUN echo "net.ipv4.tcp_fin_timeout=3" >> /etc/sysctl.conf

# copy and config
COPY container_files/default_nginx.conf /nginx_config/default_nginx.conf
COPY container_files/default_config.json /nginx_config/default_config.json
RUN cp /nginx_config/default_nginx.conf /etc/nginx/nginx.conf
COPY admin /admin
COPY container_files/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN mkdir -p /cert
RUN mkdir -p /data
RUN mkdir -p /session
RUN rm -f /var/log/nginx/*

# change to node folder
WORKDIR /admin

RUN npm install

ENTRYPOINT ["/entrypoint.sh"]