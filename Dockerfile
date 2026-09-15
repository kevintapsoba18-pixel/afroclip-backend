FROM node:20-slim

# Dépendances système : ffmpeg pour le découpage/recadrage vidéo,
# curl pour récupérer le binaire yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp en binaire autonome (toujours à jour, pas besoin de Python/pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/tmp

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]

