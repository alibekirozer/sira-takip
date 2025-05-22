const { onValueWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const { onValueUpdated } = require("firebase-functions/v2/database"); 
const TEAMS_WEBHOOK_URL = "https://kocsistem.webhook.office.com/webhookb2/44660f66-4726-4a54-842b-1c313fd46f06@1e1aa76b-4b02-45f4-9417-2e13eb0da973/IncomingWebhook/d1328f8dc75542e5b31707c9a9324303/cf410a20-3801-452e-8fea-eb078c94b436/V2w6nLuCsA3K6zGc3tTXYihO6WiBHVscjm3HV0mioXUyI1";

exports.bildirimGonder = onValueWritten(
  {
    region: "europe-west1",
    ref: "/siradakiKisi",
  },
  async (event) => {
    const before = event.data.before;
    const after = event.data.after;

    if (!after.exists() || before.val() === after.val()) return;

    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "summary": "Sıra Takip Bildirimi",
      "themeColor": "0076D7",
      "title": "📢 Yeni Çağrı",
      "text": `Şu an çağrı sırası **${after.val()}** kişisine geçti.`,
    };

    try {
      const response = await fetch(TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Teams webhook başarısız:", await response.text());
      } else {
        console.log("Teams bildirimi gönderildi.");
      }
    } catch (err) {
      console.error("Webhook gönderim hatası:", err);
    }
  }
);

exports.currentIndexTakip = onValueUpdated(
  {
    region: "europe-west1",
    ref: "siraTakip/currentIndex"
  },
  async (event) => {
    const afterIndex = event.data.after.val();
    if (afterIndex === undefined || afterIndex === null) return;

    const snapshot = await admin.database().ref(`siraTakip/activeList/${afterIndex}`).once("value");
    const kisi = snapshot.val();

    if (!kisi || !kisi.name) return;

    await admin.database().ref("siradakiKisi").set(kisi.name);
    console.log(`siradakiKisi güncellendi: ${kisi.name}`);
  }
);