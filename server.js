const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ROUTE DE DIAGNOSTIC
app.get('/api/paydunya/debug', (req, res) => {
  res.json({
    master: !!process.env.PAYDUNYA_MASTER_KEY,
    public: !!process.env.PAYDUNYA_PUBLIC_KEY,
    private: !!process.env.PAYDUNYA_PRIVATE_KEY,
    token: !!process.env.PAYDUNYA_TOKEN,
    mode: process.env.PAYDUNYA_MODE || 'live'
  });
});

// ROUTE DE CRÉATION DE PAIEMENT PAYDUNYA (PRODUCTION LIVE)
app.post('/api/paydunya/create-invoice', async (req, res) => {
  try {
    const { total_amount, description } = req.body;

    const paydunyaData = {
      invoice: {
        total_amount: Number(total_amount) || 1000,
        description: description || 'Paiement AfroClip'
      },
      store: {
        name: 'AfroClip'
      },
      actions: {
        cancel_url: 'https://afroclip-ai-6.v0.build',
        return_url: 'https://afroclip-ai-6.v0.build'
      }
    };

    const mode = (process.env.PAYDUNYA_MODE || 'live').trim().toLowerCase();
    const apiUrl = mode === 'live' 
      ? 'https://app.paydunya.com/api/v1/checkout-invoice/create'
      : 'https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create';

    const response = await axios.post(
      apiUrl,
      paydunyaData,
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY?.trim(),
          'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY?.trim(),
          'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY?.trim(),
          'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN?.trim(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.response_code === '00') {
      return res.json({ paymentUrl: response.data.response_text });
    } else {
      console.error('Erreur PayDunya Response:', response.data);
      return res.status(400).json({ error: response.data.response_text || 'Erreur PayDunya' });
    }
  } catch (error) {
    console.error('Erreur PayDunya Catch:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec de connexion PayDunya', details: error.response?.data || error.message });
  }
});

// ROUTE IPN PAYDUNYA
app.post('/api/paydunya/ipn', async (req, res) => {
  try {
    console.log('Notification IPN reçue :', req.body);
    return res.status(200).send('IPN reçue avec succès');
  } catch (error) {
    console.error('Erreur IPN:', error.message);
    return res.status(500).send('Erreur lors du traitement IPN');
  }
});

// ROUTE D'ACCUEIL
app.get('/', (req, res) => {
  res.send('Serveur AfroClip Backend fonctionnel !');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
