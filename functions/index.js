const {onValueWritten} = require("firebase-functions/v2/database");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const {onValueUpdated} = require("firebase-functions/v2/database");
const TEAMS_WEBHOOK_URL = defineSecret("TEAMS_WEBHOOK_URL");

exports.bildirimGonder = onValueWritten(
    {
      region: "europe-west1",
      ref: "/siradakiKisi",
      secrets: [TEAMS_WEBHOOK_URL],
    },
    async (event) => {
      const after = event.data.after;

      if (!after.exists()) return;

      const payload = {
        "@type": "MessageCard",
        // "@context": "http://schema.org/extensions",
        "summary": "Çağrı Takip Bildirimi",
        "themeColor": "0076D7",
        "title": "📢 Yeni Çağrı",
        "username": "Çağrı Takip Bildirimi",
        "text": `Şu an çağrı sırası **${after.val()}** kişisine geçti.`,
      };

      try {
        const response = await fetch(TEAMS_WEBHOOK_URL.value(), {
          method: "POST",
          headers: {"Content-Type": "application/json"},
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
    },
);

exports.currentIndexTakip = onValueUpdated(
    {
      region: "europe-west1",
      ref: "siraTakip/currentIndex",
    },
    async (event) => {
      const afterIndex = event.data.after.val();
      if (afterIndex === undefined || afterIndex === null) return;

      const activeListRef = `siraTakip/activeList/${afterIndex}`;
      const snapshot = await admin.database().ref(activeListRef).once("value");
      const kisi = snapshot.val();

      if (!kisi || !kisi.name) return;

      await admin.database().ref("siradakiKisi").set(kisi.name);
      console.log(`siradakiKisi güncellendi: ${kisi.name}`);
    },
);

exports.callCountNotify = onValueUpdated(
    {
      region: "europe-west1",
      ref: "siraTakip/callCount",
      secrets: [TEAMS_WEBHOOK_URL],
    },
    async (event) => {
      const before = event.data.before.val();
      const after = event.data.after.val();

      const hadCallCount = typeof before === "number";
      const hasCallCount = typeof after === "number";
      const callCountIncreased = hadCallCount && hasCallCount && after > before;

      if (callCountIncreased) {
        const payload = {
          "@type": "MessageCard",
          "summary": "Çağrı Takip Bildirimi",
          "themeColor": "D00000",
          "title": "\uD83D\uDD51 Bekleyen Çağrı",
          "text": `Sistemde bekleyen çağrı sayısı **${after}**.`,
        };

        try {
          const response = await fetch(TEAMS_WEBHOOK_URL.value(), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Pending call webhook başarısız:", errorText);
          } else {
            console.log("Pending call Teams bildirimi gönderildi.");
          }
        } catch (err) {
          console.error("Pending call webhook gönderim hatası:", err);
        }
      }
    },
);

exports.updateUserCredentials = onCall(
    {region: "europe-west1"},
    async (request) => {
      const {uid, email, password, passwordLength} = request.data || {};
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
          if (passwordLength !== undefined) {
            updateFirestore.passwordLength = passwordLength;
          }
          await admin.firestore()
              .collection("users")
              .doc(uid)
              .update(updateFirestore);
        }
        return {success: true};
      } catch (err) {
        console.error("updateUserCredentials error:", err);
        throw new HttpsError("internal", err.message);
      }
    },
);

exports.rotateDailyToOguz = onSchedule(
    {
      region: "europe-west1",
      schedule: "0 8 * * *",
      timeZone: "Europe/Istanbul",
    },
    async () => {
      const db = admin.database();
      const activeSnap = await db.ref("siraTakip/activeList").once("value");
      const list = activeSnap.val() || [];

      const oguzIndex = list.findIndex((emp) => emp.name === "Oğuz_2260");
      if (oguzIndex === -1) {
        console.log("Oğuz bulunamadı");
        return;
      }

      let newIndex = oguzIndex;
      for (let i = 0; i < list.length; i++) {
        const idx = (oguzIndex + i) % list.length;
        if (list[idx] && list[idx].status !== "İzinli") {
          newIndex = idx;
          break;
        }
      }

      await db.ref("siraTakip/currentIndex").set(newIndex);
      const nextName = list[newIndex]?.name || "-";
      await db.ref("siradakiKisi").set(nextName);
      console.log(`Günlük devir yapıldı, yeni sıra: ${nextName}`);
    },
);

exports.resetStatusesNightly = onSchedule(
    {
      region: "europe-west1",
      schedule: "45 7 * * *",
      timeZone: "Europe/Istanbul",
    },
    async () => {
      const db = admin.database();
      const activeRef = db.ref("siraTakip/activeList");
      const logRef = db.ref("siraTakip/logByDate");

      const [activeSnap, logSnap] = await Promise.all([
        activeRef.once("value"),
        logRef.once("value"),
      ]);

      const list = activeSnap.val() || [];
      const logs = logSnap.val() || {};

      let changed = false;
      const now = new Date();
      const time = now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const todayKey = now.toISOString().split("T")[0];
      const newEntries = [];

      const updatedList = list.map((emp) => {
        if (emp.status === "Çalışıyor" || emp.status === "Molada") {
          changed = true;
          newEntries.push({
            person: emp.name,
            time,
            action: `Durum: ${emp.status} → Müsait`,
          });
          return {...emp, status: "Müsait"};
        }
        return emp;
      });

      if (changed) {
        await activeRef.set(updatedList);
        const updatedLogs = {
          ...logs,
          [todayKey]: [...newEntries, ...(logs[todayKey] || [])].slice(0, 200),
        };
        await logRef.set(updatedLogs);
      }
    },
);
