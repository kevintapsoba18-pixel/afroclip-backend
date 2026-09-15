FROM node:20-slim

# Dépendances système : ffmpeg (découpage/recadrage/incrustation sous-titres),
# git + build-essential + cmake (pour compiler whisper.cpp), curl (yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    git \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp en binaire autonome (toujours à jour, pas besoin de Python/pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# whisper.cpp : transcription locale gratuite (sans clé API).
# Le système de build de whisper.cpp a changé de version en version (Makefile
# classique vs CMake) : on essaie le Makefile, sinon on bascule sur CMake,
# puis on repère le binaire produit où qu'il soit et on le symlink à un
# emplacement fixe pour que server.js n'ait jamais à s'en soucier.
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /opt/whisper.cpp \
    && cd /opt/whisper.cpp \
    && (make -j"$(nproc)" || (cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j --config Release)) \
    && BIN=$(find /opt/whisper.cpp -maxdepth 4 -type f \( -name "main" -o -name "whisper-cli" \) -perm -u+x | head -n1) \
    && ln -s "$BIN" /usr/local/bin/whisper-cli \
    && bash ./models/download-ggml-model.sh base

# Modèle "base" = bon compromis vitesse/qualité en CPU. Pour plus de
# précision (au prix de plus de temps de calcul), remplace "base" par
# "small" ci-dessus et dans WHISPER_MODEL ci-dessous.
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL=/opt/whisper.cpp/models/ggml-base.bin
ENV WHISPER_LANG=fr

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/tmp

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
