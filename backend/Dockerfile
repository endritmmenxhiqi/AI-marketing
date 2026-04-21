FROM node:20-bookworm AS base

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY .env.example ./.env.example

RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
