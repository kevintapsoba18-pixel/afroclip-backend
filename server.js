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
const CLIP_DURATION_SEC = 50; // durée approximative de chaque short

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

// Nettoyage des jobs de plus de 2h pour éviter une fuite mémoire
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
// HELPERS
// ============================================================
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject); // ex: binaire introuvable
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} a échoué (code ${code}): ${stderr.slice(-2000)}`));
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

function computeClipWindows(duration) {
  // MVP : on répartit des segments de longueur fixe sur toute la vidéo.
  // La sélection "intelligente" des meilleurs moments (via IA) est une
  // amélioration prévue en V2 - pour l'instant c'est un échantillonnage
  // régulier qui couvre le début, le milieu et la fin.
  if (duration <= CLIP_DURATION_SEC + 5) {
    return [{ start: 0, length: Math.max(5, Math.floor(duration)) }];
  }
  const numClips = Math.min(MAX_CLIPS, Math.max(1, Math.floor(duration / 45)));
  const usable = Math.max(duration - CLIP_DURATION_SEC, 1);
  const spacing = usable / numClips;
  const windows = [];
  for (let i = 0; i < numClips; i++) {
    windows.push({ start: Math.round(i * spacing), length: CLIP_DURATION_SEC });
  }
  return windows;
}

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
  // Recadre en 9:16 (1080x1920) centré. Si la vidéo source est plus
  // étroite que 1080 en hauteur équivalente, ffmpeg complète en noir.
  await runCommand('ffmpeg', [
    '-y',
    '-ss', String(start),
    '-i', sourcePath,
    '-t', String(length),
    '-vf', "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath
  ]);
}

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

function cleanupFiles(paths) {
  for (const p of paths) {
    fs.promises.unlink(p).catch(() => {});
  }
}

// ============================================================
// TRAITEMENT PRINCIPAL (asynchrone, en arrière-plan)
// ============================================================
async function processVideo(jobId, youtubeUrl) {
  const sourcePath = path.join(TMP_DIR, `${jobId}_source.mp4`);
  const tempFiles = [sourcePath];

  try {
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadVideo(youtubeUrl, sourcePath);

    updateJob(jobId, { status: 'analyzing', progress: 30 });
    const duration = await getDuration(sourcePath);
    const windows = computeClipWindows(duration);

    updateJob(jobId, { status: 'processing', progress: 40 });
    const clipPaths = [];
    for (let i = 0; i < windows.length; i++) {
      const outPath = path.join(TMP_DIR, `${jobId}_clip_${i}.mp4`);
      await cutVerticalClip(sourcePath, outPath, windows[i].start, windows[i].length);
      clipPaths.push(outPath);
      tempFiles.push(outPath);
      updateJob(jobId, { progress: 40 + Math.round(((i + 1) / windows.length) * 30) });
    }

    updateJob(jobId, { status: 'uploading', progress: 75 });
    const clips = [];
    for (let i = 0; i < clipPaths.length; i++) {
      const url = await uploadClipToSupabase(jobId, i, clipPaths[i]);
      clips.push({
        title: `Short ${i + 1}`,
        durationSec: windows[i].length,
        url
      });
      updateJob(jobId, { progress: 75 + Math.round(((i + 1) / clipPaths.length) * 25) });
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

  if (!isValidYoutubeUrl(youtubeUrl)) {
    return res.status(400).json({ error: 'Lien YouTube invalide' });
  }

  const jobId = crypto.randomUUID();
  jobs[jobId] = {
    status: 'pending',
    progress: 0,
    error: null,
    clips: [],
    createdAt: Date.now()
  };

  // On répond immédiatement, le traitement continue en arrière-plan
  res.json({ jobId });

  processVideo(jobId, youtubeUrl);
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
        console.error('Supabase non configuré, impossible de créditer l\'utilisateur');
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
