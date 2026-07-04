FROM crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:yevbi-bluewhite-patch3-a00138c7-202604292024

USER root
RUN if [ -d /app/apps/shop/.next/static/static ]; then \
      cp -a /app/apps/shop/.next/static/static/. /app/apps/shop/.next/static/ && \
      rm -rf /app/apps/shop/.next/static/static; \
    fi
USER nextjs
