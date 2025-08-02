# migration guid

## 1.1.X to 1.3.X
- pull image and recreate.
- check docker logs and you can find administrator's new password.
- delete session volume. (it moved to JWT token in 1.3.X version)
- nginx-webui login (:81 port)
- check cert menu and re-issue cert if you need.
- that's all!
