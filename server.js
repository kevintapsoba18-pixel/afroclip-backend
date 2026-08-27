const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

// Helper pour télécharger un fichier depuis une URL vers un disque local
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      // Gérer les redirections (301, 302)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Échec du téléchargement, code HTTP: ${response.statusCode}`));
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close(resolve);
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

// Routes de diagnostic et santé
app.get('/api/version', (req, res) => {
  res.json({ ok: true, mode: 'Cobalt v10 + FFmpeg' });
});

app.get('/api/formats', (req, res) => {
  res.type('text/plain').send('Mode Cobalt actif. Téléchargement délégué.');
});

// Dossier public pour stocker les clips 9:16 générés
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/public', express.static(publicDir));

// Route principale de traitement vidéo
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
    console.log(`[1/3] Demande du lien vidéo à l'API Cobalt v10 pour : ${youtubeUrl}`);
    
    // Appel à l'instance Cobalt v10 active
    const cobaltReq = await fetch('https://cobalt-api.kwiatekm.com/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: youtubeUrl,
        videoQuality: '720'
      })
    });

    const cobaltData = await cobaltReq.json();

    if (!cobaltData || (!cobaltData.url && cobaltData.status !== 'redirect' && cobaltData.status !== 'tunnel')) {
      console.error('Réponse Cobalt invalide:', cobaltData);
      throw new Error(`Erreur extraction vidéo: ${cobaltData.text || 'Lien vidéo introuvable'}`);
    }

    const downloadUrl = cobaltData.url;

    console.log('[2/3] Téléchargement du fichier source...');
    await downloadFile(downloadUrl, inputPath);

    console.log('[3/3] Découpage et conversion 9:16 avec FFmpeg...');
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
        else reject(new Error(`FFmpeg error ${code}: ${ffmpegErr}`));
      });
    });

    // Suppression du fichier temporaire source
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const clipUrl = `${protocol}://${host}/public/${outputFileName}`;

    console.log('Succès ! Clip généré :', clipUrl);
    return res.json({ clipUrl });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    console.error('Erreur lors du traitement :', error.message);
    return res.status(500).json({ error: 'Échec du traitement vidéo', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
