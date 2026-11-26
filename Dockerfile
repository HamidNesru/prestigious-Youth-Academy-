FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm run install:all && npm run build
ENV NODE_ENV=production PORT=4000 SEED_DEMO=false DB_FILE=/data/school.db
VOLUME /data
EXPOSE 4000
CMD ["npm", "start"]
