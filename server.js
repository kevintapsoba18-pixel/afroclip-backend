const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// URL publique du backend (Railway). Sert de base aux redirections PayDunya.
const BASE_URL =
  process.env.BASE_URL || 'https://afroclip-backend-production.up.railway.app';

// 1. ROUTE EXTRACTION VIDÉO (SUPADATA)
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    const response = await axios.get(`https://api.supadata.ai/v1/youtube/download?url=${encodeURIComponent(url)}`, {
      headers: {
        'x-api-key': process.env.SUPADATA_API_KEY
      }
    });

    if (response.data && response.data.downloadUrl) {
      return res.json({ clipUrl: response.data.downloadUrl });
    } else {
      return res.status(500).json({ error: 'Impossible de récupérer le lien de la vidéo' });
    }
  } catch (error) {
    console.error('Erreur Supadata:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec du traitement vidéo' });
  }
});

// 1bis. ROUTE GÉNÉRATION / TRAITEMENT VIDÉO (appelée par le bouton du frontend)
app.post('/api/process-video', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    const response = await axios.get(
      `https://api.supadata.ai/v1/youtube/download?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'x-api-key': process.env.SUPADATA_API_KEY
        }
      }
    );

    if (response.data && response.data.downloadUrl) {
      return res.json({
        success: true,
        clipUrl: response.data.downloadUrl
      });
    }

    return res
      .status(502)
      .json({ error: 'Impossible de récupérer le lien de la vidéo' });
  } catch (error) {
    console.error('Erreur process-video:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec du traitement vidéo' });
  }
});

// 2. ROUTE CRÉATION PAIEMENT PAYDUNYA
app.post('/api/paydunya/create-invoice', async (req, res) => {
  const { amount, planName } = req.body;

  try {
    const response = await axios.post(
      'https://app.paydunya.com/api/v1/checkout-invoice/create',
      {
        invoice: {
          total_amount: amount,
          description: `Abonnement AfroClip.ai - Plan ${planName}`
        },
        store: {
          name: "AfroClip.ai",
          // Redirections PayDunya vers le backend Railway
          return_url: `${BASE_URL}/api/paydunya/return`,
          cancel_url: `${BASE_URL}/api/paydunya/cancel`,
          callback_url: `${BASE_URL}/api/paydunya/ipn`
        },
        actions: {
          return_url: `${BASE_URL}/api/paydunya/return`,
          cancel_url: `${BASE_URL}/api/paydunya/cancel`,
          callback_url: `${BASE_URL}/api/paydunya/ipn`
        }
      },
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
          'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
          'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.response_code === '00') {
      return res.json({ paymentUrl: response.data.response_text });
    } else {
      return res.status(400).json({ error: 'Erreur lors de la création de la facture' });
    }
  } catch (error) {
    console.error('Erreur PayDunya:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec de connexion PayDunya' });
  }
});

// 3. ROUTE IPN PAYDUNYA (CONFIRMATION SERVEUR À SERVEUR)
app.post('/api/paydunya/ipn', (req, res) => {
  console.log('Notification de paiement PayDunya :', req.body);
  res.status(200).send('IPN OK');
});

// 4. REDIRECTION APRÈS PAIEMENT RÉUSSI
app.get('/api/paydunya/return', (req, res) => {
  console.log('Retour paiement PayDunya (succès) :', req.query);
  res.status(200).send('Paiement confirmé. Merci ! Vous pouvez revenir sur AfroClip.ai.');
});

// 5. REDIRECTION APRÈS ANNULATION
app.get('/api/paydunya/cancel', (req, res) => {
  console.log('Paiement PayDunya annulé :', req.query);
  res.status(200).send('Paiement annulé.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
