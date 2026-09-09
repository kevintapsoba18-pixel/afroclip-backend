const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Route pour extraire/télécharger la vidéo via Supadata
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "L'URL est requise" });
  }

  try {
    const response = await axios.get('https://api.supadata.ai/v1/youtube/download', {
      params: { url: url },
      headers: {
        'x-api-key': process.env.SUPADATA_API_KEY
      }
    });

    const videoUrl = response.data.downloadUrl || response.data.url;

    if (!videoUrl) {
      return res.status(500).json({ error: "Aucun lien vidéo renvoyé par Supadata" });
    }

    return res.json({ clipUrl: videoUrl });

  } catch (error) {
    console.error('Erreur Supadata:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Échec de la récupération avec Supadata',
      details: error.response?.data || error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
