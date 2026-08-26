FROM node:20-bookworm

# Installation de Python, FFmpeg et yt-dlp
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install --break-system-packages yt-dlp && \
    ln -sf $(which python3) /usr/local/bin/python

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]

