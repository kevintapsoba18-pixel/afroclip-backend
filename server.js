require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const youtubedl = require('youtube-dl-exec');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'tmp', 'downloads');
const CLIPS_DIR = path.join(__dirname, 'tmp', 'clips');
[DOWNLOAD_DIR, CLIPS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/clips', express.static(CLIPS_DIR));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/process-video', async (req, res) => {
  const { url, watermark = true, startSeconds = 0, durationSeconds = 30 } = req.body;

  if (!url || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) {
    return res.status(400).json({ error: 'URL YouTube invalide' });
  }

  const jobId = uuidv4();
  const rawPath = path.join(DOWNLOAD_DIR, `${jobId}.mp4`);
  const clipFilename = `${jobId}${watermark ? '_watermark' : '_hd'}.mp4`;
  const clipPath = path.join(CLIPS_DIR, clipFilename);

  try {
    await youtubedl(url, {
      output: rawPath,
      format: 'mp4',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    const ffmpegArgs = [
      '-y',
      '-i', rawPath,
      '-ss', String(startSeconds),
      '-t', String(durationSeconds),
    ];

    if (watermark) {
      ffmpegArgs.push(
        '-vf',
        "crop=ih*9/16:ih,scale=1080:1920,drawtext=text='AfroClip.ai':fontcolor=white@0.6:fontsize=36:x=(w-text_w)/2:y=h-100"
      );
    } else {
      ffmpegArgs.push('-vf', 'crop=ih*9/16:ih,scale=1080:1920');
    }

    ffmpegArgs.push('-c:a', 'copy', clipPath);

    await execFileAsync('ffmpeg', ffmpegArgs);

    fs.unlink(rawPath, () => {});

    return res.json({
      jobId,
      watermark,
      clipUrl: `/clips/${clipFilename}`,
    });
  } catch (err) {
    console.error('Erreur traitement vidéo:', err);
    return res.status(500).json({ error: 'Échec du traitement vidéo', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`AfroClip backend démarré sur le port ${PORT}`);
});
