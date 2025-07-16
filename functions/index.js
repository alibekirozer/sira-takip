const { onValueWritten } = require("firebase-functions/v2/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const { onValueUpdated } = require("firebase-functions/v2/database"); 
const TEAMS_WEBHOOK_URL =
  process.env.TEAMS_WEBHOOK_URL ||
  "https://kocsistem.webhook.office.com/webhookb2/44660f66-4726-4a54-842b-1c313fd46f06@1e1aa76b-4b02-45f4-9417-2e13eb0da973/IncomingWebhook/ee9e8e581a9947978427c0251aa55949/cf410a20-3801-452e-8fea-eb078c94b436/V2s7VscePkYeDL_oi1CU0E1isjutKTu5F0uKoQJeD_L9Q1";
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
      //"@context": "http://schema.org/extensions",
      "summary": "Çağrı Takip Bildirimi",
      "themeColor": "0076D7",
      "title": "📢 Yeni Çağrı",
      "username": "Çağrı Takip Bildirimi",
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

exports.updateUserCredentials = onCall({ region: "europe-west1" }, async (request) => {
  const { uid, email, password, passwordLength } = request.data || {};
  if (!uid) {
    throw new HttpsError("invalid-argument", "Missing uid");
  }
  const updateData = {};
  if (email) updateData.email = email;
  if (password) updateData.password = password;
  try {
    if (Object.keys(updateData).length) {
      await admin.auth().updateUser(uid, updateData);
    }
    if (email || passwordLength !== undefined) {
      const updateFirestore = {};
      if (email) updateFirestore.email = email;
      if (passwordLength !== undefined) updateFirestore.passwordLength = passwordLength;
      await admin.firestore().collection("users").doc(uid).update(updateFirestore);
    }
    return { success: true };
  } catch (err) {
    console.error("updateUserCredentials error:", err);
    throw new HttpsError("internal", err.message);
  }
});
