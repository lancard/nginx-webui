FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update
RUN apt-get install certbot python3-certbot-nginx npm nodejs net-tools cron logrotate dnsutils procps -y
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
RUN mkdir -p /data
RUN rm -f /var/log/nginx/*

# change to node folder
WORKDIR /admin
RUN npm install -g esbuild
RUN npm install
RUN npm run build
RUN npm run cleanBuild

ENTRYPOINT ["/entrypoint.sh"]
