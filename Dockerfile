FROM node:20-alpine AS base

# 1. 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 전 프리즈마 클라이언트 생성
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. 실행 단계 (Runner)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# --- 핵심 수정 부분: 외부 접속 허용 설정 ---
ENV HOSTNAME "0.0.0.0"
ENV PORT 3000
# ---------------------------------------

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next

# Standalone 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 볼륨 마운트 시 폴더 권한 문제(Permission denied)를 피하기 위해 기본 사용자(root)로 실행합니다.
# USER nextjs

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]