# 500GL Booking Engine — Docker Container
# Stateless Next.js app. All state in Supabase.
# Image: ~150MB. Runs on: droplet, VAST.AI, Railway, Fly.io

FROM node:24-alpine AS base

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3206
ENV HOSTNAME=0.0.0.0

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY .next/standalone/ ./
COPY .next/static ./.next/static
COPY public ./public

# Fix: standalone nests under the build path
# If standalone has Projects/ASI360-AGENCY/booking-engine/ structure, flatten it
RUN if [ -d "Projects" ]; then \
      cp -r Projects/ASI360-AGENCY/booking-engine/* . && \
      rm -rf Projects; \
    fi

USER nextjs

EXPOSE 3206

CMD ["node", "server.js"]
