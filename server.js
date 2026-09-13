const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
// PERMET DE LIRE LES DONNÉES ENVOYÉES PAR PAYDUNYA
app.use(express.urlencoded({ extended: true }));

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
    const { total_amount, description, custom_data } = req.body;

    const paydunyaData = {
      invoice: {
        total_amount: Number(total_amount) || 1000,
        description: description || 'Paiement AfroClip'
      },
      store: {
        name: 'AfroClip',
        // Spécification explicite de l'URL IPN à PayDunya
        callback_url: 'https://afroclip-backend-production.up.railway.app/api/paydunya/ipn'
      },
      actions: {
        cancel_url: 'https://afroclip-ai-6.v0.build',
        return_url: 'https://afroclip-ai-6.v0.build'
      },
      // Transmission de custom_data (user_id) si présent
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
    return res.status(500).json({ 
      error: 'Échec de connexion PayDunya', 
      details: typeof error.response?.data === 'string' ? 'Page d\'erreur PayDunya' : error.response?.data || error.message 
    });
  }
});

// ROUTE IPN PAYDUNYA
app.post('/api/paydunya/ipn', async (req, res) => {
  try {
    console.log('Notification IPN brute reçue :', req.body);

    // Extraction du token du paiement envoyé par PayDunya
    const token_invoice = req.body.data?.token || req.body['data[token]'] || req.body.token;

    if (token_invoice) {
      const masterKey = (process.env.PAYDUNYA_MASTER_KEY || '').trim();
      const publicKey = (process.env.PAYDUNYA_PUBLIC_KEY || '').trim();
      const privateKey = (process.env.PAYDUNYA_PRIVATE_KEY || '').trim();
      const token = (process.env.PAYDUNYA_TOKEN || '').trim();

      // Vérification directe auprès de PayDunya du statut de la facture
      const confirmResponse = await axios.get(
        `https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token_invoice}`,
        {
          headers: {
            'PAYDUNYA-MASTER-KEY': masterKey,
            'PAYDUNYA-PUBLIC-KEY': publicKey,
            'PAYDUNYA-PRIVATE-KEY': privateKey,
            'PAYDUNYA-TOKEN': token
          }
        }
      );

      const invoiceData = confirmResponse.data;
      console.log('Données de confirmation PayDunya :', invoiceData);

      if (invoiceData.status === 'completed') {
        const customData = invoiceData.custom_data || {};
        console.log('Paiement Réussi ! Données utilisateur :', customData);
        
        // TODO: Insérer ici l'appel BDD pour créditer les tokens de customData.user_id
      }
    }

    return res.status(200).send('IPN reçue avec succès');
  } catch (error) {
    console.error('Erreur traitement IPN:', error.response?.data || error.message);
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
