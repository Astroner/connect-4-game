FROM node:16.20-alpine
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY src src

ENV NODE_ENV=production
RUN npm run build

ENV PORT=80
EXPOSE 80
CMD ["npm", "start"]