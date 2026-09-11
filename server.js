const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// 1. ROUTE DE CRÉATION DE PAIEMENT PAYDUNYA (SANDBOX TEST)
app.post('/api/paydunya/create-invoice', async (req, res) => {
  try {
    const { total_amount, description } = req.body;

    const paydunyaData = {
      invoice: {
        total_amount: total_amount,
        description: description || 'Paiement AfroClip'
      },
      store: {
        name: 'AfroClip'
      }
    };

    // Utilisation de l'URL Sandbox / Test de PayDunya
    const response = await axios.post(
      'https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create',
      paydunyaData,
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
      console.error('Erreur PayDunya Response:', response.data);
      return res.status(400).json({ error: response.data.response_text || 'Erreur PayDunya' });
    }
  } catch (error) {
    console.error('Erreur PayDunya Catch:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec de connexion PayDunya' });
  }
});

// 2. ROUTE IPN PAYDUNYA (CONFIRMATION PAIEMENT)
app.post('/api/paydunya/ipn', async (req, res) => {
  try {
    const data = req.body;
    console.log('Notification IPN reçue :', data);
    return res.status(200).send('IPN reçue avec succès');
  } catch (error) {
    console.error('Erreur IPN:', error.message);
    return res.status(500).send('Erreur lors du traitement IPN');
  }
});

// ROUTE DE TEST
app.get('/', (req, res) => {
  res.send('Serveur AfroClip Backend fonctionnel !');
});

// DEMARRAGE DU SERVEUR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
