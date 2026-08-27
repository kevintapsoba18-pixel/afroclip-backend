FROM node:18-slim

# Installation des dépendances et mise à jour forcée de yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && rm -rf /var/lib/apt-get/lists/*
RUN pip3 install --break-system-packages --upgrade yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
