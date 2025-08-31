FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update && apt-get install certbot python3-certbot-nginx npm nodejs net-tools cron logrotate dnsutils procps -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# install anubis
WORKDIR /tmp
RUN curl -L -O https://github.com/TecharoHQ/anubis/releases/download/v1.21.3/anubis_1.21.3_amd64.deb
RUN apt-get install ./anubis_1.21.3_amd64.deb -y
RUN rm anubis_1.21.3_amd64.deb

# system configuration
RUN echo "net.ipv4.tcp_fin_timeout=3" >> /etc/sysctl.conf

# copy and config
COPY container_files/default_nginx.conf /nginx_config/default_nginx.conf
COPY container_files/default_config.json /nginx_config/default_config.json
COPY container_files/anubis.conf /etc/nginx/anubis.conf
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
