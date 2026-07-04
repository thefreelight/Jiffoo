FROM crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:easyeuicc-app-landing-v5-a00138c7-2026060701

USER root
RUN rm -rf /app/apps/shop/.next/server /app/apps/shop/.next/static && \
    mkdir -p /app/apps/shop/.next/server /app/apps/shop/.next/static /app/apps/shop/public/downloads
COPY --chown=nextjs:nodejs apps/shop/.next/server/. /app/apps/shop/.next/server/
COPY --chown=nextjs:nodejs apps/shop/.next/static/. /app/apps/shop/.next/static/
COPY --chown=nextjs:nodejs apps/shop/.next/BUILD_ID apps/shop/.next/*.json /app/apps/shop/.next/
COPY --chown=nextjs:nodejs apps/shop/public/downloads/EasyEUICC-v1.6.2.apk /app/apps/shop/public/downloads/EasyEUICC-v1.6.2.apk
COPY --chown=nextjs:nodejs apps/shop/public/easyeuicc-real-empty.png apps/shop/public/easyeuicc-download-qr.png /app/apps/shop/public/
USER nextjs
