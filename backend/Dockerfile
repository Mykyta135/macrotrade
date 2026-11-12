# ── Збірка ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Спочатку лише маніфести — шар із залежностями кешується, доки вони не змінились
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Прибираємо dev-залежності, щоб не тягнути їх у фінальний образ
RUN npm prune --omit=dev

# ── Запуск ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Скрипти імпорту (import-aaii, import-calendar) лишаються доступними всередині
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY scripts ./scripts

# Nest слухає PORT; 3901 — порт MacroTrade за замовчуванням
EXPOSE 3901

# Працюємо не від root
USER node

CMD ["node", "dist/main"]
