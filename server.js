const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// CONFIG
// ============================================================
const TMP_DIR = path.join(os.tmpdir(), 'afroclip');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'shorts';
const MAX_CLIPS = 5;
const ALLOWED_DURATIONS = [15, 30, 60];
const DEFAULT_DURATION = 30;

const WHISPER_BIN = process.env.WHISPER_BIN || 'whisper-whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '/opt/whisper.cpp/models/ggml-base.bin';
const WHISPER_LANG = process.env.WHISPER_LANG || 'fr';

// Styles de sous-titres proposés dans l'interface
const SUBTITLE_STYLES = {
  karaoke:      { label: 'Karaoké',    color: '#FFD400', outline: '#000000', outlineWidth: 3 },
  neon:         { label: 'Néon',       color: '#B15DFF', outline: '#B15DFF', outlineWidth: 5 },
  'gras-blanc': { label: 'Gras Blanc', color: '#FFFFFF', outline: '#000000', outlineWidth: 3 },
  'pop-orange': { label: 'Pop Orange', color: '#FF7A00', outline: '#000000', outlineWidth: 3 }
};
const DEFAULT_SUBTITLE_STYLE = 'gras-blanc';

// Si des cookies YouTube sont fournis (pour éviter le blocage anti-bot
// de YouTube sur les IP de serveurs cloud), on les écrit sur disque au
// démarrage. Pour générer YTDLP_COOKIES_B64 : exporter les cookies
// youtube.com depuis ton navigateur (extension "Get cookies.txt"),
// puis `base64 -w0 cookies.txt` et coller le résultat dans la variable
// d'environnement Railway.
let COOKIES_PATH = null;
if (process.env.YTDLP_COOKIES_B64) {
  try {
    COOKIES_PATH = path.join(TMP_DIR, 'cookies.txt');
    fs.writeFileSync(COOKIES_PATH, Buffer.from(process.env.YTDLP_COOKIES_B64, 'base64'));
    console.log('Cookies YouTube chargés depuis YTDLP_COOKIES_B64');
  } catch (e) {
    console.error('Impossible de charger les cookies YouTube:', e.message);
    COOKIES_PATH = null;
  }
}

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ============================================================
// STOCKAGE DES JOBS EN MÉMOIRE
// ============================================================
// jobs[jobId] = { status, progress, error, clips, createdAt }
// status: pending | downloading | analyzing | processing | uploading | done | error
const jobs = {};

setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const id in jobs) {
    if (jobs[id].createdAt < twoHoursAgo) delete jobs[id];
  }
}, 30 * 60 * 1000);

function updateJob(jobId, patch) {
  jobs[jobId] = { ...jobs[jobId], ...patch };
}

// ============================================================
// HELPERS GÉNÉRAUX
// ============================================================
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code, signal) => {
      if (code === 0) resolve(stdout);
      else {
        const details = `${stderr.slice(-1000)}\n${stdout.slice(-1000)}`.trim();
        if (signal) reject(new Error(`${cmd} a été tué par le signal ${signal} (probablement un manque de mémoire sur le conteneur): ${details}`));
        else reject(new Error(`${cmd} a échoué (code ${code}): ${details || '(aucune sortie)'}`));
      }
    });
  });
}

function isValidYoutubeUrl(url) {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url || '');
}

async function getDuration(filePath) {
  const out = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'json',
    filePath
  ]);
  const parsed = JSON.parse(out);
  return parseFloat(parsed.format.duration);
}

function computeClipWindows(duration, clipLength) {
  // MVP : on répartit des segments de longueur fixe sur toute la vidéo.
  // La sélection "intelligente" des meilleurs moments (via IA) est une
  // amélioration prévue en V2 - pour l'instant c'est un échantillonnage
  // régulier qui couvre le début, le milieu et la fin.
  if (duration <= clipLength + 5) {
    return [{ start: 0, length: Math.max(5, Math.floor(duration)) }];
  }
  const numClips = Math.min(MAX_CLIPS, Math.max(1, Math.floor(duration / (clipLength * 1.3))));
  const usable = Math.max(duration - clipLength, 1);
  const spacing = usable / numClips;
  const windows = [];
  for (let i = 0; i < numClips; i++) {
    windows.push({ start: Math.round(i * spacing), length: clipLength });
  }
  return windows;
}

function cleanupFiles(paths) {
  for (const p of paths) {
    fs.promises.unlink(p).catch(() => {});
  }
}

// ============================================================
// TÉLÉCHARGEMENT + DÉCOUPAGE
// ============================================================
async function downloadVideo(youtubeUrl, outputPath) {
  const args = [
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '-o', outputPath
  ];
  if (COOKIES_PATH) args.push('--cookies', COOKIES_PATH);
  args.push(youtubeUrl);
  await runCommand('yt-dlp', args);
}

async function cutVerticalClip(sourcePath, outputPath, start, length) {
  await runCommand('ffmpeg', [
    '-y',
    '-ss', String(start),
    '-i', sourcePath,
    '-t', String(length),
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-threads', '2',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath
  ]);
}

// ============================================================
// TRANSCRIPTION (whisper.cpp local, gratuit) + SOUS-TITRES
// ============================================================
async function extractAudioForWhisper(videoPath, audioPath) {
  // whisper.cpp attend du WAV mono 16kHz
  await runCommand('ffmpeg', [
    '-y', '-i', videoPath,
    '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
    audioPath
  ]);
}

async function transcribeWordByWord(audioPath, outBase) {
  // -ml 1 force des segments d'un seul mot => sous-titres mot par mot
  // (style "pop captions" façon TikTok), avec la timestamp de chaque mot.
  await runCommand(WHISPER_BIN, [
    '-m', WHISPER_MODEL,
    '-f', audioPath,
    '-osrt',
    '-of', outBase,
    '-ml', '1',
    '-l', WHISPER_LANG
  ]);
  return `${outBase}.srt`;
}

function srtTimeToSeconds(t) {
  const [h, m, rest] = t.split(':');
  const [s, ms] = rest.split(',');
  return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
}

function parseSrt(content) {
  const blocks = content.trim().split(/\r?\n\r?\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
    if (!text) continue;
    cues.push({
      start: srtTimeToSeconds(startStr),
      end: srtTimeToSeconds(endStr),
      text
    });
  }
  return cues;
}

function secondsToAssTime(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  const pad = (n) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function rgbToAssColor(hex) {
  const c = hex.replace('#', '');
  const r = c.slice(0, 2);
  const g = c.slice(2, 4);
  const b = c.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text) {
  return text.replace(/[{}]/g, '');
}

function buildAss(cues, styleKey, videoWidth, videoHeight) {
  const style = SUBTITLE_STYLES[styleKey] || SUBTITLE_STYLES[DEFAULT_SUBTITLE_STYLE];
  const primary = rgbToAssColor(style.color);
  const outline = rgbToAssColor(style.outline);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,84,${primary},${primary},${outline},&H00000000,-1,0,0,0,100,100,0,0,1,${style.outlineWidth},0,2,60,60,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = cues
    .map((c) => `Dialogue: 0,${secondsToAssTime(c.start)},${secondsToAssTime(c.end)},Default,,0,0,0,,${escapeAssText(c.text)}`)
    .join('\n');

  return header + lines + '\n';
}

async function burnSubtitles(inputPath, assPath, outputPath) {
  // Le filtre "subtitles" de ffmpeg veut un chemin avec les ':' échappés
  const escapedAssPath = assPath.replace(/:/g, '\\:');
  await runCommand('ffmpeg', [
    '-y', '-i', inputPath,
    '-vf', `subtitles=${escapedAssPath}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-threads', '2',
    '-c:a', 'copy',
    outputPath
  ]);
}

// ============================================================
// UPLOAD
// ============================================================
async function uploadClipToSupabase(jobId, index, filePath) {
  if (!supabase) throw new Error('Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)');
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${jobId}/short_${index + 1}.mp4`;

  const { error: uploadErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true });

  if (uploadErr) throw new Error(`Upload Supabase échoué: ${uploadErr.message}`);

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ============================================================
// TRAITEMENT PRINCIPAL (asynchrone, en arrière-plan)
// ============================================================
async function processVideo(jobId, youtubeUrl, clipLength, subtitleStyle) {
  const sourcePath = path.join(TMP_DIR, `${jobId}_source.mp4`);
  const tempFiles = [sourcePath];

  try {
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadVideo(youtubeUrl, sourcePath);

    updateJob(jobId, { status: 'analyzing', progress: 25 });
    const duration = await getDuration(sourcePath);
    const windows = computeClipWindows(duration, clipLength);

    updateJob(jobId, { status: 'processing', progress: 35 });
    const finalClipPaths = [];

    for (let i = 0; i < windows.length; i++) {
      const rawPath = path.join(TMP_DIR, `${jobId}_${i}_raw.mp4`);
      const audioPath = path.join(TMP_DIR, `${jobId}_${i}.wav`);
      const srtBase = path.join(TMP_DIR, `${jobId}_${i}`);
      const assPath = path.join(TMP_DIR, `${jobId}_${i}.ass`);
      const finalPath = path.join(TMP_DIR, `${jobId}_${i}_final.mp4`);
      tempFiles.push(rawPath, audioPath, `${srtBase}.srt`, assPath, finalPath);

      // 1. Découpage + recadrage vertical
      await cutVerticalClip(sourcePath, rawPath, windows[i].start, windows[i].length);

      // 2. Transcription locale (whisper.cpp)
      await extractAudioForWhisper(rawPath, audioPath);
      const srtPath = await transcribeWordByWord(audioPath, srtBase);
      const cues = fs.existsSync(srtPath) ? parseSrt(fs.readFileSync(srtPath, 'utf8')) : [];

      // 3. Génération + incrustation des sous-titres stylés
      if (cues.length > 0) {
        fs.writeFileSync(assPath, buildAss(cues, subtitleStyle, 1080, 1920));
        await burnSubtitles(rawPath, assPath, finalPath);
      } else {
        // Pas de parole détectée : on garde le clip tel quel plutôt que d'échouer
        fs.copyFileSync(rawPath, finalPath);
      }

      finalClipPaths.push(finalPath);
      updateJob(jobId, { progress: 35 + Math.round(((i + 1) / windows.length) * 45) });
    }

    updateJob(jobId, { status: 'uploading', progress: 85 });
    const clips = [];
    for (let i = 0; i < finalClipPaths.length; i++) {
      const url = await uploadClipToSupabase(jobId, i, finalClipPaths[i]);
      clips.push({
        title: `Short ${i + 1}`,
        durationSec: windows[i].length,
        subtitleStyle,
        url
      });
      updateJob(jobId, { progress: 85 + Math.round(((i + 1) / finalClipPaths.length) * 15) });
    }

    updateJob(jobId, { status: 'done', progress: 100, clips });
  } catch (err) {
    console.error(`Erreur traitement job ${jobId}:`, err.message);
    updateJob(jobId, { status: 'error', error: err.message });
  } finally {
    cleanupFiles(tempFiles);
  }
}

// ============================================================
// ROUTES ANALYSE VIDÉO
// ============================================================
app.post('/api/analyze', (req, res) => {
  const { youtubeUrl } = req.body;
  let { clipDuration, subtitleStyle } = req.body;

  if (!isValidYoutubeUrl(youtubeUrl)) {
    return res.status(400).json({ error: 'Lien YouTube invalide' });
  }

  clipDuration = ALLOWED_DURATIONS.includes(Number(clipDuration)) ? Number(clipDuration) : DEFAULT_DURATION;
  subtitleStyle = SUBTITLE_STYLES[subtitleStyle] ? subtitleStyle : DEFAULT_SUBTITLE_STYLE;

  const jobId = crypto.randomUUID();
  jobs[jobId] = {
    status: 'pending',
    progress: 0,
    error: null,
    clips: [],
    createdAt: Date.now()
  };

  res.json({ jobId });

  processVideo(jobId, youtubeUrl, clipDuration, subtitleStyle);
});

app.get('/api/analyze/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job introuvable' });
  res.json(job);
});

// ============================================================
// ROUTES PAYDUNYA (inchangées)
// ============================================================
app.get('/api/paydunya/debug', (req, res) => {
  res.json({
    master: !!process.env.PAYDUNYA_MASTER_KEY,
    public: !!process.env.PAYDUNYA_PUBLIC_KEY,
    private: !!process.env.PAYDUNYA_PRIVATE_KEY,
    token: !!process.env.PAYDUNYA_TOKEN,
    supabaseUrl: true,
    supabaseKey: true,
    mode: process.env.PAYDUNYA_MODE || 'live'
  });
});

app.post('/api/paydunya/create-invoice', async (req, res) => {
  try {
    const { total_amount, description, custom_data } = req.body;

    const paydunyaData = {
      invoice: {
        total_amount: Number(total_amount) || 1000,
        description: description || 'Paiement AfroClip'
      },
      store: {
        name: 'AfroClip',
        callback_url: 'https://afroclip-backend-production.up.railway.app/api/paydunya/ipn'
      },
      actions: {
        cancel_url: 'https://afroclip-ai-6.v0.build',
        return_url: 'https://afroclip-ai-6.v0.build/success'
      },
      custom_data: custom_data || {}
    };

    const masterKey = (process.env.PAYDUNYA_MASTER_KEY || '').trim();
    const publicKey = (process.env.PAYDUNYA_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.PAYDUNYA_PRIVATE_KEY || '').trim();
    const token = (process.env.PAYDUNYA_TOKEN || '').trim();

    const response = await axios.post(
      'https://app.paydunya.com/api/v1/checkout-invoice/create',
      paydunyaData,
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': masterKey,
          'PAYDUNYA-PUBLIC-KEY': publicKey,
          'PAYDUNYA-PRIVATE-KEY': privateKey,
          'PAYDUNYA-TOKEN': token,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.response_code === '00') {
      return res.json({ paymentUrl: response.data.response_text });
    } else {
      console.error('Erreur PayDunya Response:', response.data);
      return res.status(400).json({ error: response.data?.response_text || 'Erreur PayDunya' });
    }
  } catch (error) {
    console.error('Erreur PayDunya Catch:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec de connexion PayDunya' });
  }
});

app.post('/api/paydunya/ipn', async (req, res) => {
  console.log('--- IPN PAYDUNYA REÇUE (PROD) ---');

  try {
    const bodyData = req.body.data || req.body;
    const status = bodyData.status || bodyData.invoice?.status;

    if (status === 'completed') {
      let userId = bodyData.custom_data?.user_id;

      if (!supabase) {
        console.error("Supabase non configuré, impossible de créditer l'utilisateur");
        return res.status(200).send('OK (supabase non configuré)');
      }

      if (!userId) {
        const { data: firstUser, error: findErr } = await supabase.from('users').select('id').limit(1).maybeSingle();
        if (findErr) console.error('Erreur récupération utilisateur Supabase:', findErr.message);
        if (firstUser) userId = firstUser.id;
      }

      if (userId) {
        const cleanUserId = String(userId);

        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('credits')
          .eq('id', cleanUserId)
          .maybeSingle();

        if (userErr) console.error('Erreur lecture crédits Supabase:', userErr.message);

        const currentCredits = user?.credits || 0;
        const newCredits = currentCredits + 10;

        const { error: upsertErr } = await supabase
          .from('users')
          .upsert({ id: cleanUserId, credits: newCredits }, { onConflict: 'id' });

        if (upsertErr) {
          console.error('Erreur mise à jour/insertion crédits Supabase:', upsertErr.message);
        } else {
          console.log(`SUCCÈS PROD : 10 crédits ajoutés à ${cleanUserId}. Nouveau total : ${newCredits}`);
        }
      } else {
        console.error('Aucun utilisateur trouvé dans Supabase pour attribuer les crédits.');
      }
    }

    return res.status(200).send('IPN reçue avec succès');
  } catch (error) {
    console.error('Erreur traitement IPN PROD:', error.message);
    return res.status(200).send('OK (erreur interceptée)');
  }
});

app.get('/', (req, res) => {
  res.send('Serveur AfroClip Backend fonctionnel !');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
