FROM crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:imagic-20260327000048

USER root

COPY deploy/hotfix/api-runtime-hotfix.js /tmp/api-runtime-hotfix.js
COPY deploy/hotfix/imagic-core/index.js /app/extensions/plugins/imagic-core/src/index.js

RUN node /tmp/api-runtime-hotfix.js \
  && rm /tmp/api-runtime-hotfix.js \
  && chown api:nodejs /app/extensions/plugins/imagic-core/src/index.js

USER api
