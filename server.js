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

    // Nettoyage rigoureux des clés (supprime les espaces ou retours à la ligne superflus)
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
    return res.status(500).json({ 
      error: 'Échec de connexion PayDunya', 
      details: typeof error.response?.data === 'string' ? 'Page d\'erreur PayDunya (Clés invalides ou compte non activé)' : error.response?.data || error.message 
    });
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
