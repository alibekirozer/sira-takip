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
  
  // Ölçekleme için referans boyutlar
  const DESIGN_WIDTH = 1440;
  const DESIGN_HEIGHT = 900;

  useEffect(() => {
    const scaleContainer = document.getElementById("scaleContainer");
    const scaleWrapper = document.getElementById("scaleWrapper");
    if (!scaleContainer || !scaleWrapper) return;

    const applyScale = () => {
      const scaleX = window.innerWidth / DESIGN_WIDTH;
      const scaleY = window.innerHeight / DESIGN_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      scaleContainer.style.transform = `scale(${scale})`;
      scaleContainer.style.width = DESIGN_WIDTH + "px";
      scaleContainer.style.height = DESIGN_HEIGHT + "px";
      scaleWrapper.style.overflow = "hidden";
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
    <div className={clsx(
      "min-h-screen min-w-screen flex flex-col items-center justify-center",
      darkMode ? "bg-gradient-to-br from-slate-900 to-blue-900 text-white" : "bg-gradient-to-br from-blue-100 to-white text-gray-900"
    )}>
      {/* Üst Bar */}
      <header className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between py-6 px-4 gap-4">
        <div className="flex items-center gap-4">
          <img src="/favicon.png" alt="logo" className="w-12 h-12 rounded-full shadow-lg" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Çağrı Takip</h1>
            <div className="text-sm text-blue-700 dark:text-blue-200 font-medium mt-1">
              {time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - {time.toLocaleDateString("tr-TR")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-blue-600 dark:text-blue-300 text-lg">{userName}</span>
          <button onClick={() => setDarkMode(!darkMode)} className="text-2xl p-2 rounded-full hover:bg-blue-200 dark:hover:bg-slate-700 transition">{darkMode ? "☀️" : "🌙"}</button>
          <button onClick={() => signOut(auth)} className="px-4 py-2 rounded bg-red-500 text-white font-semibold shadow hover:bg-red-600 transition">Çıkış Yap</button>
        </div>
      </header>

      {/* Bilgi Barı */}
      <div className="w-full max-w-3xl mx-auto mb-4">
        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl px-6 py-3 flex flex-col sm:flex-row items-center justify-between shadow">
          <span className="text-lg font-semibold">Sıra şimdi <span className="text-blue-700 dark:text-blue-300">{siradakiKisi()}</span>'da</span>
          <span className="text-md mt-2 sm:mt-0">Size sıra gelmesi <span className="font-bold text-blue-700 dark:text-blue-300">{kalanKisiSayisi()}</span> kişi var</span>
        </div>
      </div>

      {/* Çağrı Butonları */}
      <div className="w-full max-w-3xl mx-auto flex gap-4 mb-6">
        <button onClick={() => { const yeniSayi = callCount + 1; setCallCount(yeniSayi); guncelleFirebase({ callCount: yeniSayi }); }}
          className={clsx(
            "flex-1 py-3 rounded-xl font-bold text-lg shadow transition",
            blink ? "bg-red-600 animate-pulse text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
          )}>
          📞 Yeni Çağrı ({callCount})
        </button>
        <button onClick={() => { setCallCount((prev) => { if (prev <= 0) return prev; const yeniSayi = prev - 1; guncelleFirebase({ callCount: yeniSayi }); return yeniSayi; }); }}
          disabled={callCount === 0}
          className={clsx(
            "flex-0 px-6 py-3 rounded-xl font-bold text-lg shadow transition",
            callCount === 0 ? "bg-gray-300 text-gray-400 cursor-not-allowed" : "bg-gray-600 hover:bg-gray-700 text-white"
          )}>
          -
        </button>
      </div>

      {/* Ana İçerik Grid */}
      <main className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 flex-1">
        {/* Aktif Liste */}
        <section className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeList.map((emp, i) => (
            <div key={emp.uid} className={clsx(
              "rounded-2xl shadow-lg p-6 flex flex-col gap-2 border-2 transition-all duration-200",
              durumRengi(emp.status),
              i === siradakiMusaitIndex() && "border-blue-600 scale-[1.03] bg-blue-50 dark:bg-slate-800"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold truncate">{emp.name}</span>
                <span className="text-md italic text-gray-500 dark:text-gray-300">{emp.status}</span>
              </div>
              {emp.uid === auth.currentUser?.uid && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => durumGuncelle(i, "Molada")} className="px-3 py-1 rounded bg-yellow-200 text-yellow-900 font-semibold">Moladayım</button>
                  <button onClick={() => durumGuncelle(i, "İzinli")} className="px-3 py-1 rounded bg-gray-300 text-gray-800 font-semibold">İzinliyim</button>
                  <button onClick={() => durumGuncelle(i, "Çalışıyor")} className="px-3 py-1 rounded bg-orange-200 text-orange-900 font-semibold">Çalışıyorum</button>
                  <button onClick={() => durumGuncelle(i, "Müsait")} className="px-3 py-1 rounded bg-green-200 text-green-900 font-semibold">Müsaitim</button>
                </div>
              )}
              {emp.uid === auth.currentUser?.uid && emp.status === "Müsait" && i === siradakiMusaitIndex() && (
                <button onClick={ileriAl} className="mt-4 w-full py-2 rounded-xl bg-green-600 text-white font-bold text-lg shadow hover:bg-green-700 transition">
                  ✅ Çağrı Aldım
                </button>
              )}
            </div>
          ))}
        </section>
        {/* Loglar */}
        <aside className="w-full lg:w-1/3 bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-slate-700 flex flex-col max-h-[70vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-300">📋 Bugünkü Çağrı Kayıtları</h2>
          <ul className="space-y-2 text-base">
            {(logByDate[todayKey] || []).map((entry, index) => (
              <li key={index} className="border-b border-gray-100 dark:border-slate-800 pb-2 last:border-0">
                <span className="font-semibold text-blue-700 dark:text-blue-300">{entry.time}</span> - <span className="font-bold">{entry.person}</span> <span className="text-gray-600 dark:text-gray-300">{entry.action ? entry.action : "çağrıyı aldı"}</span>
              </li>
            ))}
          </ul>
        </aside>
      </main>

      <footer className="w-full text-center py-4 mt-8 text-sm text-gray-400 border-t border-gray-200 dark:border-slate-700 bg-inherit">
        <span>Created by Ali Bekir Özer</span>
      </footer>
    </div>
  );
}