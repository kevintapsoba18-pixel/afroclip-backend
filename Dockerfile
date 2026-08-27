FROM node:20-bookworm
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg \
    && pip3 install --break-system-packages yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]

