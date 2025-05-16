// App.js
import { useState, useEffect } from "react";
import clsx from "clsx";
import { ref, set, onValue } from "firebase/database";
import { realtimeDB } from "./firebase";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import AdminPanel from "./AdminPanel";

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

        // Eğer bugünkü kayıt yoksa başlat
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
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        await registration.showNotification("Sıra Sende!", {
          body: `${isim}, çağrıyı sen alacaksın.`,
          icon: "/favicon.ico"
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  const siradakiIndex = () => {
    for (let i = 0; i < activeList.length; i++) {
      const idx = (currentIndex + i) % activeList.length;
      if (activeList[idx].status === "Çalışıyor") return idx;
    }
    return -1;
  };

  const ileriAl = () => {
    // Sadece 'Müsait' olanlar arasında sıradaki index
    const musaitler = activeList.filter((emp) => emp.status === "Müsait");
    if (musaitler.length === 0) return;
    const siradakiUid = musaitler[0].uid;
    const index = activeList.findIndex((emp) => emp.uid === siradakiUid);
    if (index !== -1) {
      const person = activeList[index].name;
      const timestamp = new Date().toLocaleTimeString();
      const yeniLog = [{ person, time: timestamp }, ...(logByDate[todayKey] || [])].slice(0, 200);
      const updatedLogByDate = { ...logByDate, [todayKey]: yeniLog };
      // Sıradaki müsaitten sonrasındaki ilk müsait kişiye geç
      let yeniIndex = index;
      for (let i = 1; i <= activeList.length; i++) {
        const nextIdx = (index + i) % activeList.length;
        if (activeList[nextIdx].status === "Müsait") {
          yeniIndex = nextIdx;
          break;
        }
      }
      setCurrentIndex(yeniIndex);
      setCallCount(callCount > 0 ? callCount - 1 : 0);
      setLogByDate(updatedLogByDate);
      guncelleFirebase({ currentIndex: yeniIndex, callCount: callCount > 0 ? callCount - 1 : 0, logByDate: updatedLogByDate });
    }
  };

  // Bilgi kısmı için yardımcı fonksiyonlar
  const siradakiKisi = () => {
    // Sadece 'Müsait' olanlar arasında sıradaki
    const musaitler = activeList.filter((emp) => emp.status === "Müsait");
    return musaitler.length > 0 ? musaitler[0].name : "-";
  };
  const kalanKisiSayisi = () => {
    if (!benimAdim) return 0;
    // Sadece 'Müsait' olanları say
    const musaitler = activeList.filter((emp) => emp.status === "Müsait");
    const benimIndex = musaitler.findIndex((emp) => emp.name === benimAdim);
    if (benimIndex === -1) return musaitler.length; // Listede yoksa hepsi
    return benimIndex;
  };

  // Sadece 'Müsait' olanlar arasında sıradaki index
  const siradakiMusaitIndex = () => {
    const musaitler = activeList.filter((emp) => emp.status === "Müsait");
    if (musaitler.length === 0) return -1;
    return activeList.findIndex((emp) => emp.name === musaitler[0].name);
  };

  // Durum güncellemede log ekle
  const durumGuncelle = (index, status) => {
    const updated = [...activeList];
    const eskiStatus = updated[index].status;
    updated[index].status = status;
    setActiveList(updated);
    // Log ekle
    const person = updated[index].name;
    const timestamp = new Date().toLocaleTimeString();
    const yeniLog = [{ person, time: timestamp, action: `Durum: ${eskiStatus} → ${status}` }, ...(logByDate[todayKey] || [])].slice(0, 200);
    const updatedLogByDate = { ...logByDate, [todayKey]: yeniLog };
    setLogByDate(updatedLogByDate);
    guncelleFirebase({ activeList: updated, logByDate: updatedLogByDate });
  };

  const guncelleFirebase = (yeniVeriler) => {
    set(ref(realtimeDB, "siraTakip"), {
      activeList, currentIndex, callCount, log,
      allEmployees, selectedNames, logByDate, ...yeniVeriler
    });
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
      const updatedList = [...activeList, { name, status: "Müsait" }];
      setSelectedNames(updated);
      setActiveList(updatedList);
      guncelleFirebase({ selectedNames: updated, activeList: updatedList });
    }
  };

  // Bilgi kısmı için yardımcı fonksiyonlar
  // const siradakiKisi = () => {
  //   const idx = siradakiIndex();
  //   return idx !== -1 ? activeList[idx]?.name : "-";
  // };
  // const kalanKisiSayisi = () => {
  //   if (!benimAdim) return 0;
  //   // Sadece 'Müsait' olanları say
  //   const musaitler = activeList.filter((emp) => emp.status === "Müsait");
  //   const benimIndex = musaitler.findIndex((emp) => emp.name === benimAdim);
  //   if (benimIndex === -1) return musaitler.length; // Listede yoksa hepsi
  //   return benimIndex;
  // };

  return (
    <div className={`${darkMode ? "bg-slate-900 text-white" : "bg-white text-black"} min-h-screen w-full max-w-[100vw] overflow-x-hidden flex flex-col box-border px-1 sm:px-4`} style={{overflowY: 'hidden'}}>
      {/* Üst Bar */}
      <header className="sticky top-0 z-20 bg-inherit backdrop-blur-md border-b border-gray-300/20 dark:border-slate-700/40 py-3 sm:py-4 mb-4 sm:mb-6 w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 w-full">
          {/* Başlık ve Saat */}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">Çağrı Takip</h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span>🕒</span>
              <span>
                {time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - 
                {time.toLocaleDateString("tr-TR")}
              </span>
            </div>
          </div>
          {/* Kullanıcı Bilgisi ve İşlemler */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-xs sm:text-sm w-full sm:w-auto">
            <div className="text-right sm:text-left w-full sm:w-auto">
              <p className="text-gray-800 dark:text-gray-200 truncate">
                Hoş geldin,{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {userName || "Kullanıcı"}
                </span>
              </p>
              {auth.currentUser?.email === "muhammedalibekir@gmail.com" && (
                <a
                  href="/admin"
                  className="inline-block mt-1 text-xs text-blue-500 hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  🔧 Admin Panel
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              {/* Tema Butonu */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Tema Değiştir"
                className="text-lg p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
              {/* Çıkış Butonu */}
              <button
                onClick={() => signOut(auth)}
                className="px-3 py-1.5 rounded bg-red-500 text-white text-xs sm:text-sm hover:bg-red-600 transition"
              >
                🔓 Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Bilgi Kısmı */}
      <div className="w-full max-w-full mb-2 flex justify-center">
        <div className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded px-2 py-1 text-xs sm:text-sm font-medium shadow-sm">
          Sıra şimdi <span className="font-bold">{siradakiKisi()}</span>'da, size sıra gelmesi <span className="font-bold">{kalanKisiSayisi()}</span> kişi var.
        </div>
      </div>
      {/* Çağrı Butonu */}
      <div className="flex flex-wrap justify-center sm:justify-start mt-2 sm:mt-4 gap-2 w-full">
        <button
          onClick={() => {
            const yeniSayi = callCount + 1;
            setCallCount(yeniSayi);
            guncelleFirebase({ callCount: yeniSayi });
          }}
          className={`px-4 sm:px-6 py-2 rounded-md font-semibold text-white shadow-md transition w-full sm:w-auto ${
            blink ? "bg-red-600 animate-pulse" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          📞 Yeni Çağrı ({callCount})
        </button>
        <button
          onClick={() => {
            setCallCount((prev) => {
              if (prev <= 0) return prev;
              const yeniSayi = prev - 1;
              guncelleFirebase({ callCount: yeniSayi });
              return yeniSayi;
            });
          }}
          disabled={callCount === 0}
          className={`px-2 py-2 rounded-md font-semibold text-white shadow-md transition w-full sm:w-auto ${
            callCount === 0
              ? "bg-gray-400 opacity-50 cursor-not-allowed"
              : blink
              ? "bg-gray-600 animate-pulse"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          -
        </button>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row w-full gap-4 mt-4 overflow-hidden">
        <div className="w-full lg:w-3/4 pr-0 lg:pr-4 space-y-4 overflow-visible">
          {activeList.map((emp, i) => (
            <div
              key={emp.uid}
              className={clsx(
                "border-2 rounded-lg p-3 sm:p-4 shadow-sm transition-all duration-200 text-xs sm:text-sm w-full overflow-x-auto",
                durumRengi(emp.status),
                i === siradakiMusaitIndex() &&
                  (darkMode
                    ? "scale-[1.02] border-4 border-green-600 bg-slate-800"
                    : "scale-[1.02] border-4 border-green-600 bg-gray-50")
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base sm:text-lg font-semibold truncate max-w-[60vw]">{emp.name}</p>
                {emp.uid === auth.currentUser?.uid ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => durumGuncelle(i, "Molada")} className="text-xs sm:text-sm px-2 py-1 bg-yellow-200 text-black rounded">Moladayım</button>
                    <button onClick={() => durumGuncelle(i, "İzinli")} className="text-xs sm:text-sm px-2 py-1 bg-gray-300 text-black rounded">İzinliyim</button>
                    <button onClick={() => durumGuncelle(i, "Çalışıyor")} className="text-xs sm:text-sm px-2 py-1 bg-orange-300 text-black rounded">Çalışıyorum</button>
                    <button onClick={() => durumGuncelle(i, "Müsait")} className="text-xs sm:text-sm px-2 py-1 bg-green-300 text-black rounded">Müsaitim</button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm italic">Durum: {emp.status}</p>
                )}
              </div>
              {/* Sadece MÜSAİT ve sıradaki kişi sizseniz çağrı alınabilir */}
              {emp.uid === auth.currentUser?.uid && emp.status === "Müsait" && i === siradakiMusaitIndex() && (
                <button
                  onClick={ileriAl}
                  className="mt-3 block bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition w-full sm:w-auto"
                >
                  ✅ Çağrı Aldım
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="w-full lg:w-1/4 flex flex-col">
          <div className="flex-1 overflow-y-auto border-l pl-0 lg:pl-4" style={{maxHeight: 'calc(100dvh - 220px)'}}>
            <h2 className="text-lg sm:text-xl font-semibold mb-2">📋 Bugünkü Çağrı Kayıtları</h2>
            <ul className="list-disc pl-4 sm:pl-6 text-xs sm:text-sm space-y-1">
              {(logByDate[todayKey] || []).map((entry, index) => (
                <li key={index}>{entry.time} - {entry.person} {entry.action ? entry.action : "çağrıyı aldı"}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <footer className="w-full text-center py-2 mt-auto text-[10px] sm:text-xs text-gray-400 border-t border-gray-200 dark:border-slate-700 bg-inherit">
        <span>Siteyi Ali Bekir Özer yaptı</span>
      </footer>
    </div>
  );
}