FROM nginx:stable

EXPOSE 80
EXPOSE 443

# install modules
RUN apt-get update
RUN apt-get install certbot python3-certbot-nginx cron npm nodejs -y
RUN apt-get upgrade -y
