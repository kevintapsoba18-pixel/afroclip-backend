const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// 1. ROUTE DE CRÉATION DE PAIEMENT PAYDUNYA
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

    const response = await axios.post(
      'https://app.paydunya.com/api/v1/checkout-invoice/create',
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
      return res.status(400).json({ error: 'Erreur lors de la création de la facture PayDunya' });
    }
  } catch (error) {
    console.error('Erreur PayDunya:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Échec de connexion PayDunya' });
  }
});

// 2. ROUTE IPN PAYDUNYA (CONFIRMATION PAIEMENT)
app.post('/api/paydunya/ipn', async (req, res) => {
  try {
    const data = req.body;
    console.log('Notification IPN reçue :', data);

    // Traitement/validation du statut du paiement ici si nécessaire
    return res.status(200).send('IPN reçue avec succès');
  } catch (error) {
    console.error('Erreur IPN:', error.message);
    return res.status(500).send('Erreur lors du traitement IPN');
  }
});

// ROUTE DE TEST / SANTE DU SERVEUR
app.get('/', (req, res) => {
  res.send('Serveur AfroClip Backend fonctionnel !');
});

// DEMARRAGE DU SERVEUR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
