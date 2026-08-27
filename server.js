const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Mise à jour de yt-dlp au démarrage
try {
  execSync('pip3 install --break-system-packages --upgrade yt-dlp', { stdio: 'inherit' });
  console.log('yt-dlp mis à jour avec succès.');
} catch (e) {
  console.log('Avertissement maj yt-dlp:', e.message);
}

// 2. Gestion et chargement des cookies YouTube
const COOKIES_PATH = '/tmp/cookies.txt';
if (process.env.YT_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES);
    console.log('Cookies YouTube écrits dans /tmp/cookies.txt');
  } catch (err) {
    console.error('Erreur lors de l’écriture des cookies:', err.message);
  }
} else {
  console.warn('ATTENTION: La variable d’environnement YT_COOKIES n’est pas définie dans Railway.');
}

// 3. Route de diagnostic des formats (requise par v0)
app.get('/api/formats', (req, res) => {
  const id = req.query.id || 'dQw4w9WgXcQ';
  const targetUrl = `https://www.youtube.com/watch?v=${id}`;
  
  const hasCookies = fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 0;
  const cookieArg = hasCookies ? `--cookies ${COOKIES_PATH}` : '';
  
  try {
    const out = execSync(
      `yt-dlp ${cookieArg} --extractor-args "youtube:player_client=tv,mweb" -F "${targetUrl}"`,
      { timeout: 60000 }
    ).toString();
    res.type('text/plain').send(out);
  } catch (e) {
    res.type('text/plain').send(`ERREUR DIAGNOSTIC FORMATS:\n${e.message}\n${e.stderr ? e.stderr.toString() : ''}`);
  }
});

// 4. Route de vérification de version
app.get('/api/version', (req, res) => {
  try {
    const v = execSync('yt-dlp --version').toString().trim();
    res.json({ ok: true, ytdlp: v });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5. Configuration du dossier public de sortie
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/public', express.static(publicDir));

// 6. Traitement principal de la vidéo
app.post('/api/process-video', async (req, res) => {
  const { youtubeUrl, startTime = 0, duration = 30 } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'URL YouTube requise' });
  }

  const timestamp = Date.now();
  const inputPath = path.join(__dirname, `temp_${timestamp}.mp4`);
  const outputFileName = `clip_${timestamp}.mp4`;
  const outputPath = path.join(publicDir, outputFileName);

  const hasCookies = fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 0;

  try {
    const ytdlpArgs = [
      "-f", "b/best/bv*+ba",
      "--merge-output-format", "mp4",
      "--extractor-args", "youtube:player_client=tv,mweb",
      "--retries", "5",
      "--no-warnings",
      "-o", inputPath
    ];

    if (hasCookies) {
      ytdlpArgs.push("--cookies", COOKIES_PATH);
    }

    ytdlpArgs.push(youtubeUrl);

    // Étape A : Téléchargement avec yt-dlp
    await new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', ytdlpArgs);
      let ytdlpErr = '';
      
      ytdlp.stderr.on('data', (data) => { 
        ytdlpErr += data.toString(); 
      });
      
      ytdlp.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp s'est arrêté avec le code ${code}: ${ytdlpErr}`));
      });
    });

    // Étape B : Recadrage 9:16 et encodage avec ffmpeg
    const ffmpegArgs = [
      "-y",
      "-ss", String(startTime),
      "-i", inputPath,
      "-t", String(duration),
      "-vf", "crop=ih*9/16:ih,scale=720:1280",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-c:a", "aac",
      outputPath
    ];

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let ffmpegErr = '';
      
      ffmpeg.stderr.on('data', (data) => { 
        ffmpegErr += data.toString(); 
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg s'est arrêté avec le code ${code}: ${ffmpegErr}`));
      });
    });

    // Nettoyage du fichier temporaire
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const clipUrl = `${protocol}://${host}/public/${outputFileName}`;

    return res.json({ clipUrl });

  } catch (error) {
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    console.error('Erreur traitement vidéo:', error);
    return res.status(500).json({ error: 'Échec du traitement vidéo', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré et à l'écoute sur le port ${PORT}`));
