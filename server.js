const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTE DE DIAGNOSTIC
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

// ROUTE DE CRÉATION DE PAIEMENT PAYDUNYA
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
        return_url: 'https://afroclip-ai-6.v0.build'
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

// ROUTE IPN PAYDUNYA
app.post('/api/paydunya/ipn', async (req, res) => {
  console.log('--- IPN PAYDUNYA REÇUE (PROD) ---');

  try {
    const bodyData = req.body.data || req.body;
    const status = bodyData.status || bodyData.invoice?.status;

    if (status === 'completed') {
      let userId = bodyData.custom_data?.user_id;

      // Connexion directe avec la clé service_role correcte
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        'https://efevohzbezzgzmxmpvxy.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZXZvaHpiZXp6Z3pteG1wdnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODk2Nzk2OCwiZXhwIjoyMTA0NTQzOTY4fQ.cGfPLyVPaRV0rycwLqjcGbFbVC5tYXcH0K6aXZlQ1-E'
      );

      // Si aucun userId n'est transmis par PayDunya, utiliser maybeSingle pour éviter le crash si la table est vide
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

        // Si l'utilisateur n'existe pas encore dans la table, on l'insère, sinon on met à jour
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
