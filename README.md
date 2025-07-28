# NGINX WebUI

[![Build Status](https://github.com/lancard/nginx-webui/actions/workflows/build-docker.yml/badge.svg)](https://github.com/lancard/nginx-webui/actions/workflows/build-docker.yml)
![Repo Size](https://img.shields.io/github/repo-size/lancard/nginx-webui)
![File Count](https://img.shields.io/github/directory-file-count/lancard/nginx-webui)
![Docker Pulls](https://img.shields.io/docker/pulls/lancard/nginx-webui)
![Docker Image Size](https://img.shields.io/docker/image-size/lancard/nginx-webui)

> 💡 **Manage NGINX like a pro, without touching the terminal.**  
> Simple, powerful, and production-ready NGINX management UI with Let's Encrypt integration.

---

## ✨ Features

- ✅ One‑click reverse proxy setup  
- 🔐 Automatic Let's Encrypt certificate issuance & renewal (incl. DNS challenge)  
- 🔄 CI/CD‑friendly API to enable/disable upstream backends  
- 🧰 Logrotate configuration via UI  
- ⚙️ Superuser/admin mode for advanced NGINX config  
- 👨‍👩‍👧‍👦 Designed for managing **multiple domains** and **teams**  
- 🧪 Non‑disruptive deployments using Jenkins or other CI/CD tools  
- ⚡ Built with **full ES Modules (ESM)** for modern, modular Node.js architecture  
- 📱 **Responsive, mobile‑friendly UI** that adapts to desktop, tablet, and phone layouts  
- 🧩 **Lightweight and minimal UI stack**: tailwind, daisyui etc. (no heavy frameworks)  
- 🔁 Instant config reload & validation – UI‑triggered NGINX config test + reload  
- 🔥 **Session and certificate data persisted in Docker volumes**, ready for production
- 🛠 Easy setup with production‑grade **Docker‑Compose** (`version: '3.7'` by default) :contentReference[oaicite:1]{index=1}  
- 🔐 **Self‑signed HTTPS for admin UI** on port 81 (browser warning expected, ignore and proceed) :contentReference[oaicite:2]{index=2}  


---

## 📸 Screenshots

| UI Overview | Service Editor | SSL Management | Dashboard |
|------------|----------------|----------------|-----------|
| ![](./screenshot/screenshot1.png) | ![](./screenshot/screenshot2.png) | ![](./screenshot/screenshot3.png) | ![](./screenshot/screenshot4.png) |

---

## 🎬 Video Tutorials

- **Install & Load-Balancer Setup**  
  [![Install and Setup](https://img.youtube.com/vi/3SEdU_Jj5IM/0.jpg)](https://www.youtube.com/watch?v=3SEdU_Jj5IM)

- **CI/CD + Non-disruptive Deployment**  
  [![Jenkins Integration](https://img.youtube.com/vi/UaJF-s2AuZo/0.jpg)](https://www.youtube.com/watch?v=UaJF-s2AuZo)

- **Let's Encrypt Certificate Renewal**  
  [![Cert Renewal](https://img.youtube.com/vi/O12f2PYPCpU/0.jpg)](https://www.youtube.com/watch?v=O12f2PYPCpU)

---

## 🚀 Quick Start

### 1. Prerequisites

- [Docker](https://docs.docker.com/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Create `docker-compose.yml`

```yaml
version: '3.7'
services:
  nginx-webui:
    image: lancard/nginx-webui
    container_name: nginx-webui
    environment:
      - TZ=Asia/Seoul
    ulimits:
      memlock:
        soft: -1
        hard: -1
    restart: always
    ports:
      - 80:80
      - 81:81
      - 443:443
    volumes:
      - nginx-webui-data:/data
      - nginx-webui-cert:/etc/letsencrypt
      - nginx-webui-session:/session
      - nginx-webui-log:/var/log/nginx
      - nginx-webui-logrotate-config:/etc/logrotate.d

volumes:
  nginx-webui-data:
  nginx-webui-cert:
  nginx-webui-session:
  nginx-webui-log:
  nginx-webui-logrotate-config:
