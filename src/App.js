import { useState, useEffect } from "react";
import clsx from "clsx";
import { ref, set, onValue } from "firebase/database";
import { realtimeDB } from "./firebase";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import AdminPanel from "./AdminPanel";
import { update } from "firebase/database";

export default function SiraTakip() {
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [activeList, setActiveList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callCount, setCallCount] = useState(0);
  const [blink, setBlink] = useState(false);
  const [newName, setNewName] = useState("");
  const [log, setLog] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [time, setTime] = useState(new Date());
  const [firebaseLoaded, setFirebaseLoaded] = useState(false);
  const [benimAdim, setBenimAdim] = useState("");
  const [logByDate, setLogByDate] = useState({});
  const todayKey = new Date().toISOString().split("T")[0];
  const userName = auth.currentUser?.displayName || "Kullanıcı";

  const durumRengi = (status) => {
    switch (status) {
      case "Mola": return darkMode ? "bg-yellow-300 border-yellow-400 text-black" : "bg-yellow-100 border-yellow-500";
      case "İzin": return darkMode ? "bg-gray-500 border-gray-400 text-white" : "bg-gray-100 border-gray-400 text-gray-500";
      case "Çalışıyor": return darkMode ? "bg-orange-400 border-orange-500 text-black" : "bg-orange-100 border-orange-500";
      case "Müsait": return darkMode ? "bg-slate-700 border-green-400 text-white" : "bg-white border-green-500";
      default: return darkMode ? "bg-slate-800 border-gray-500 text-white" : "bg-white border-gray-300";
    }
  };

  useEffect(() => {
    if (Notification.permission !== "granted") Notification.requestPermission();
  }, []);

  useEffect(() => {
    const index = siradakiIndex();
    const siradaki = activeList[index]?.name;
    if (siradaki && siradaki === benimAdim) bildirimGonder(benimAdim);
  }, [currentIndex, activeList, benimAdim]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  const ad = auth.currentUser?.displayName || "";
  setBenimAdim(ad);
}, []);
  
  useEffect(() => {
  const container = document.getElementById("scaleContainer");
  const wrapper = document.getElementById("scaleWrapper");
  if (!container || !wrapper) return;

  const designWidth = 1440;
  const designHeight = 900;

  const applyScale = () => {
    const scaleX = wrapper.clientWidth / designWidth;
    const scaleY = wrapper.clientHeight / designHeight;
    const scale = Math.min(scaleX, scaleY);
    container.style.transform = `scale(${scale})`;
  };

  applyScale();
  window.addEventListener("resize", applyScale);
  return () => window.removeEventListener("resize", applyScale);
}, []);



  useEffect(() => {
    const dataRef = ref(realtimeDB, "siraTakip");
    onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActiveList(data.activeList || []);
        setCurrentIndex(data.currentIndex || 0);
        setCallCount(data.callCount || 0);
        setAllEmployees(data.allEmployees || []);
        setSelectedNames(data.selectedNames || []);
        setLogByDate(data.logByDate || {});

        if (!data.logByDate?.[todayKey]) {
          const updated = { ...data.logByDate, [todayKey]: [] };
          set(ref(realtimeDB, "siraTakip/logByDate"), updated);
          setLogByDate(updated);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (callCount > 0) {
      const interval = setInterval(() => setBlink((prev) => !prev), 500);
      return () => clearInterval(interval);
    } else setBlink(false);
  }, [callCount]);

  const bildirimGonder = async (isim) => {
  if (Notification.permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("Sıra Sende!", {
        body: `${isim}, çağrıyı sen alacaksın.`,
        icon: "/favicon.ico"
      });
    } catch (error) {
      console.error('Bildirim gönderme hatası:', error);
    }
  }
};


  const siradakiIndex = () => {
    for (let i = 0; i < activeList.length; i++) {
      const idx = (currentIndex + i) % activeList.length;
      if (activeList[idx].status === "Müsait") return idx;
    }
    return -1; // Hiç müsait yoksa -1 döndür
  };

  // Bilgi kısmı için yardımcı fonksiyonlar
  const siradakiMusaitIndex = () => {
    // Önce currentIndex'ten başlayarak ileriye doğru müsait kişi ara
    for (let i = 0; i < activeList.length; i++) {
      const idx = (currentIndex + i) % activeList.length;
      if (activeList[idx]?.status === "Müsait") {
        return idx;
      }
    }
  };

  const siradakiKisi = () => {
    // Önce currentIndex'ten başlayarak ileriye doğru müsait kişi ara
    for (let i = 0; i < activeList.length; i++) {
      const idx = (currentIndex + i) % activeList.length;
      if (activeList[idx]?.status === "Müsait") {
        return activeList[idx].name;
      }
    }
    return "-";
  };

  const kalanKisiSayisi = () => {
  if (!benimAdim) return 0;

  // currentIndex'ten başlayarak sıralı şekilde tüm "Müsait"leri gez
  let sayac = 0;
  for (let i = 0; i < activeList.length; i++) {
    const idx = (currentIndex + i) % activeList.length;
    const kisi = activeList[idx];

    if (kisi?.status === "Müsait") {
      if (kisi.name === benimAdim) {
        return sayac; // Kendi sıranı bulunca dur
      }
      sayac++;
    }
  }

  return 0; // Bulunamazsa
};


  const ileriAl = () => {
    const musaitler = activeList.filter((emp) => emp.status === "Müsait");
    if (musaitler.length === 0) return;

    const currentUserIndex = activeList.findIndex(
      (emp) => emp.uid === auth.currentUser?.uid
    );

    if (currentUserIndex !== -1) {
      const updated = [...activeList];
      const oldStatus = updated[currentUserIndex].status;
      updated[currentUserIndex].status = "Çalışıyor";

      // Sıradaki müsait kişiye geç
      const nextMusait = activeList.findIndex((emp, idx) => 
        idx > currentUserIndex && emp.status === "Müsait"
      );
      const yeniIndex = nextMusait !== -1 ? nextMusait : 
        activeList.findIndex(emp => emp.status === "Müsait");

      const person = activeList[currentUserIndex].name;
      const timestamp = new Date().toLocaleTimeString();
      const yeniLog = [
        { 
          person, 
          time: timestamp,
          action: "çağrıyı aldı ve durumu değişti: " + oldStatus + " → Çalışıyor"
        },
        ...(logByDate[todayKey] || [])
      ].slice(0, 200);
      const updatedLogByDate = { ...logByDate, [todayKey]: yeniLog };

      setActiveList(updated);
      setCallCount(callCount > 0 ? callCount - 1 : 0);
      setLogByDate(updatedLogByDate);
      setCurrentIndex(yeniIndex);

      guncelleFirebase({ 
        activeList: updated, 
        callCount: callCount > 0 ? callCount - 1 : 0,
        logByDate: updatedLogByDate,
        currentIndex: yeniIndex
      });
    }
  };
  const durumGuncelle = (index, status) => {
    const updated = [...activeList];
    const eskiStatus = updated[index].status;
    updated[index].status = status;

    // Eğer Müsait durumuna geçiliyorsa ve currentIndex güncellemesi gerekiyorsa
    let yeniIndex = currentIndex; // olduğu gibi kalsın, değiştirme

    const person = updated[index].name;
    const timestamp = new Date().toLocaleTimeString();
    const yeniLog = [{ person, time: timestamp, action: `Durum: ${eskiStatus} → ${status}` }, ...(logByDate[todayKey] || [])].slice(0, 200);
    const updatedLogByDate = { ...logByDate, [todayKey]: yeniLog };

    setActiveList(updated);
    setLogByDate(updatedLogByDate);
    setCurrentIndex(yeniIndex);
    
    guncelleFirebase({ 
      activeList: updated, 
      logByDate: updatedLogByDate,
      currentIndex: yeniIndex
    });
  };

  const guncelleFirebase = (yeniVeriler) => {
      update(ref(realtimeDB, "siraTakip"), yeniVeriler);
    };


  const toggleName = (name) => {
    if (selectedNames.includes(name)) {
      const updated = selectedNames.filter((n) => n !== name);
      const updatedList = activeList.filter((emp) => emp.name !== name);
      setSelectedNames(updated);
      setActiveList(updatedList);
      guncelleFirebase({ selectedNames: updated, activeList: updatedList });
    } else {
      const updated = [...selectedNames, name];
      const updatedList = [...activeList, {
       name,
       status: "Müsait",
       uid: auth.currentUser?.uid || null
     }];
      setSelectedNames(updated);
      setActiveList(updatedList);
      guncelleFirebase({ selectedNames: updated, activeList: updatedList });
    }
  };
     return (
  <div
    id="scaleWrapper"
    style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "start",
    }}
  >
    <div
      id="scaleContainer"
      style={{
        transformOrigin: "top left",
        width: "2560px",
        height: "1440px",
      }}
    >
      <div className={`${darkMode ? "bg-slate-900 text-white" : "bg-white text-black"} w-full h-full flex flex-col box-border px-1 sm:px-4`}>

        {/* Üst Bar */}
        <header className="sticky top-0 z-20 bg-inherit backdrop-blur-md border-b border-gray-300/20 dark:border-slate-700/40 py-3 sm:py-4 mb-4 sm:mb-6 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 w-full">
            <div className="min-w-0">
              <h1 className="text-[2vw] font-semibold tracking-tight truncate">📞 Çağrı Takip</h1>
              <div className="flex items-center gap-2 text-[0.9vw] text-gray-600 dark:text-gray-400 mt-1">
                <span>🕒</span>
                <span>{time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - {time.toLocaleDateString("tr-TR")}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-[0.9vw] w-full sm:w-auto">
              <div className="text-right sm:text-left w-full sm:w-auto">
                <p className="text-gray-800 dark:text-gray-200 truncate">
                  Hoş geldin, <span className="font-semibold text-blue-600 dark:text-blue-400">{userName || "Kullanıcı"}</span>
                </p>
                {auth.currentUser?.email === "muhammedalibekir@gmail.com" && (
                  <a href="/admin" className="inline-block mt-1 text-[0.8vw] text-blue-500 hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition">
                    🔧 Admin Panel
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                <button onClick={() => setDarkMode(!darkMode)} className="text-[1.2vw] p-[0.5vw] rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                  {darkMode ? "☀️" : "🌙"}
                </button>
                <button onClick={() => signOut(auth)} className="px-[1vw] py-[0.6vw] rounded bg-red-500 text-white text-[0.9vw] hover:bg-red-600 transition">
                  🔓 Çıkış Yap
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Bilgi Kısmı */}
        <div className="w-full max-w-full mb-2 flex justify-center">
          <div className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded px-[0.6vw] py-[0.4vw] text-[0.9vw] font-medium shadow-sm">
            Sıra şimdi <span className="font-bold">{siradakiKisi()}</span>'da, size sıra gelmesi <span className="font-bold">{kalanKisiSayisi()}</span> kişi var.
          </div>
        </div>

        {/* Çağrı Butonları */}
        <div className="flex flex-wrap justify-center sm:justify-start mt-2 sm:mt-4 gap-2 w-full">
          <button onClick={() => { const yeniSayi = callCount + 1; setCallCount(yeniSayi); guncelleFirebase({ callCount: yeniSayi }); }}
            className={`px-[1.5vw] py-[0.8vw] rounded-md font-semibold text-white shadow-md transition w-full sm:w-auto text-[1vw] ${blink ? "bg-red-600 animate-pulse" : "bg-red-500 hover:bg-red-600"}`}>
            📞 Yeni Çağrı ({callCount})
          </button>

          <button onClick={() => { setCallCount((prev) => { if (prev <= 0) return prev; const yeniSayi = prev - 1; guncelleFirebase({ callCount: yeniSayi }); return yeniSayi; }); }}
            disabled={callCount === 0}
            className={`px-[1vw] py-[0.8vw] rounded-md font-semibold text-white shadow-md transition w-full sm:w-auto text-[1vw] ${callCount === 0 ? "bg-gray-400 opacity-50 cursor-not-allowed" : blink ? "bg-gray-600 animate-pulse" : "bg-gray-600 hover:bg-gray-700"}`}>
            -
          </button>
        </div>

        {/* Aktif Liste ve Log */}
        <div className="flex-1 flex flex-col lg:flex-row w-full gap-4 mt-4 overflow-hidden">
          <div className="w-full lg:w-3/4 pr-0 lg:pr-4 space-y-4 overflow-visible">
            {activeList.map((emp, i) => (
              <div key={emp.uid} className={clsx(
                "border-2 rounded-lg p-[1vw] shadow-sm transition-all duration-200 text-[0.9vw] w-full overflow-x-auto",
                durumRengi(emp.status),
                i === siradakiMusaitIndex() &&
                (darkMode ? "scale-[1.02] border-4 border-green-600 bg-slate-800" : "scale-[1.02] border-4 border-green-600 bg-gray-50")
              )}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[1.2vw] font-semibold truncate max-w-[60vw]">{emp.name}</p>
                  {emp.uid === auth.currentUser?.uid ? (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => durumGuncelle(i, "Molada")} className="text-[0.9vw] px-[0.6vw] py-[0.4vw] bg-yellow-200 text-black rounded">Moladayım</button>
                      <button onClick={() => durumGuncelle(i, "İzinli")} className="text-[0.9vw] px-[0.6vw] py-[0.4vw] bg-gray-300 text-black rounded">İzinliyim</button>
                      <button onClick={() => durumGuncelle(i, "Çalışıyor")} className="text-[0.9vw] px-[0.6vw] py-[0.4vw] bg-orange-300 text-black rounded">Çalışıyorum</button>
                      <button onClick={() => durumGuncelle(i, "Müsait")} className="text-[0.9vw] px-[0.6vw] py-[0.4vw] bg-green-300 text-black rounded">Müsaitim</button>
                    </div>
                  ) : (
                    <p className="text-[0.9vw] italic">Durum: {emp.status}</p>
                  )}
                </div>
                {emp.uid === auth.currentUser?.uid && emp.status === "Müsait" && i === siradakiMusaitIndex() && (
                  <button onClick={ileriAl} className="mt-3 block bg-green-500 text-white px-[1.5vw] py-[0.8vw] rounded hover:bg-green-600 transition w-full sm:w-auto text-[1vw]">
                    ✅ Çağrı Aldım
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="w-full lg:w-1/4 flex flex-col">
            <div className="flex-1 overflow-y-auto border-l pl-0 lg:pl-4" style={{ maxHeight: 'calc(100dvh - 220px)' }}>
              <h2 className="text-[1.5vw] font-semibold mb-2">📋 Bugünkü Çağrı Kayıtları</h2>
              <ul className="list-disc pl-[1.5vw] text-[0.8vw] space-y-[0.3vh]">
                {(logByDate[todayKey] || []).map((entry, index) => (
                  <li key={index}>{entry.time} - {entry.person} {entry.action ? entry.action : "çağrıyı aldı"}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <footer className="w-full text-center py-2 mt-auto text-[0.7vw] text-gray-400 border-t border-gray-200 dark:border-slate-700 bg-inherit">
          <span>Created by Ali Bekir Özer</span>
        </footer>

      </div>
    </div>
  </div>
  );
}