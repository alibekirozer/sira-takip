export const sendTeamsNotification = async (message) => {
  const webhookUrl = process.env.REACT_APP_TEAMS_WEBHOOK_URL;

  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "summary": "Sıra Takip Uyarısı",
    "themeColor": "0076D7",
    "title": "📢 Çağrı Bildirimi",
    "text": message,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text(); // hata varsa detayını logla
    if (!response.ok) {
      console.error("Teams'e gönderim başarısız:", text);
    } else {
      console.log("Teams'e gönderildi:", text);
    }
  } catch (err) {
    console.error("Teams webhook hatası:", err);
  }
};
