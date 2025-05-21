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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Teams'e gönderim başarısız:", response.statusText);
    }
  } catch (error) {
    console.error("Teams webhook hatası:", error);
  }
};
