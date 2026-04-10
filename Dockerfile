FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="team-workload-app" \
      org.opencontainers.image.description="Team dynamic workload assessment web app" \
      org.opencontainers.image.version="1.0.0"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

