const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Force la mise à jour de yt-dlp au démarrage exact du serveur
try {
  execSync('pip3 install --break-system-packages --upgrade yt-dlp', { stdio: 'inherit' });
  console.log('yt-dlp mis à jour');
} catch (e) {
  console.log('Échec maj yt-dlp:', e.message);
}

// Charger les cookies YouTube depuis la variable Railway
const COOKIES_PATH = '/tmp/cookies.txt';
if (process.env.YT_COOKIES) {
  fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES);
  console.log('Cookies YouTube chargés avec succès.');
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/public', express.static(publicDir));

app.post('/api/process-video', async (req, res) => {
  const { youtubeUrl, startTime = 0, duration = 30 } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'URL YouTube requise' });
  }

  const timestamp = Date.now();
  const inputPath = path.join(__dirname, `temp_${timestamp}.mp4`);
  const outputFileName = `clip_${timestamp}.mp4`;
  const outputPath = path.join(publicDir, outputFileName);

  try {
    const ytdlpArgs = [
      "-f", "bv*[height<=720]+ba/b[height<=720]/best",
      "--merge-output-format", "mp4",
      "--cookies", COOKIES_PATH,
      "--extractor-args", "youtube:player_client=android,ios,web",
      "--retries", "5",
      "--no-warnings",
      "-o", inputPath,
      youtubeUrl
    ];

    await new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', ytdlpArgs);
      let ytdlpErr = '';
      ytdlp.stderr.on('data', (data) => { ytdlpErr += data.toString(); });
      ytdlp.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp error ${code}: ${ytdlpErr}`));
      });
    });

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
      ffmpeg.stderr.on('data', (data) => { ffmpegErr += data.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg error ${code}: ${ffmpegErr}`));
      });
    });

    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const clipUrl = `${protocol}://${host}/public/${outputFileName}`;

    return res.json({ clipUrl });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    console.error('Erreur traitement vidéo:', error);
    return res.status(500).json({ error: 'Échec du traitement vidéo', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
