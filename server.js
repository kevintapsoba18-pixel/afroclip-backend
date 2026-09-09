const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

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
        store: { name: "AfroClip.ai" }
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

// 3. ROUTE IPN PAYDUNYA (CONFIRMATION)
app.post('/api/paydunya/ipn', (req, res) => {
  console.log('Notification de paiement PayDunya :', req.body);
  res.status(200).send('IPN OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
