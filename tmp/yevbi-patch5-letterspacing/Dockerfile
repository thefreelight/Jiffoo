FROM crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:yevbi-bluewhite-patch4-a00138c7-2026043001

USER root
RUN rm -rf /app/apps/shop/.next/server /app/apps/shop/.next/static && \
    mkdir -p /app/apps/shop/.next/server /app/apps/shop/.next/static
COPY --chown=nextjs:nodejs apps/shop/.next/server/. /app/apps/shop/.next/server/
COPY --chown=nextjs:nodejs apps/shop/.next/static/. /app/apps/shop/.next/static/
COPY --chown=nextjs:nodejs apps/shop/.next/BUILD_ID apps/shop/.next/*.json /app/apps/shop/.next/
USER nextjs
