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

  // Durum rengi fonksiyonu: durum adları ve renkler güncellendi
  const durumRengi = (status) => {
    switch (status) {
      case "Molada":
        return darkMode
          ? "bg-yellow-400 border-yellow-500 text-black"
          : "bg-yellow-200 border-yellow-400 text-black";
      case "İzinli":
        return darkMode
          ? "bg-gray-500 border-gray-400 text-white"
          : "bg-gray-200 border-gray-400 text-gray-600";
      case "Çalışıyor":
        return darkMode
          ? "bg-orange-500 border-red-500 text-white"
          : "bg-orange-300 border-red-400 text-black";
      case "Müsait":
        return darkMode
          ? "bg-green-700 border-green-400 text-white"
          : "bg-green-200 border-green-500 text-black";
      default:
        return darkMode
          ? "bg-slate-800 border-gray-500 text-white"
          : "bg-white border-gray-300 text-black";
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
    if (activeList.length === 0) return -1;
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    for (let i = 0; i < activeList.length; i++) {
      const idx = (startIndex + i) % activeList.length;
      if (activeList[idx]?.status === "Müsait") return idx;
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
    return -1; // Hiç müsait yoksa -1 döndür
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
      const yeniSiradaki = updated[yeniIndex]?.name || "-";
      set(ref(realtimeDB, "/siradakiKisi"), yeniSiradaki);
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
    <div className={`${darkMode ? "bg-slate-900 text-white" : "bg-white text-black"} min-h-screen w-full max-w-[100vw] overflow-x-hidden flex flex-col box-border px-[0.5vw]`} style={{ overflowY: 'hidden' }}>
      {/* Üst Bar */}
      <header className="sticky top-0 z-20 bg-inherit backdrop-blur-md border-b border-gray-300/20 dark:border-slate-700/40 py-[0.75vh] mb-[1vh] w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[0.5vw] w-full">
          {/* Başlık ve Saat */}
          <div className="min-w-0">
            <h1 className="text-[clamp(1.2rem,1.1vw,2.5rem)] font-semibold tracking-tight truncate">Çağrı Takip</h1>
            <div className="flex items-center gap-[0.25vw] text-[clamp(0.7rem,0.5vw,1.2rem)] text-gray-600 dark:text-gray-400 mt-[0.25vh]">
              <span>🕒</span>
              <span>
                {time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} -
                {time.toLocaleDateString("tr-TR")}
              </span>
            </div>
          </div>
          {/* Kullanıcı Bilgisi ve İşlemler */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-[1vw] text-[clamp(1rem,0.8vw,1.8rem)] w-full sm:w-auto">
            <div className="text-right sm:text-left w-full sm:w-auto">
              <p className="text-gray-800 dark:text-gray-200 truncate">
                Hoş geldin, <span className="font-semibold text-blue-600 dark:text-blue-400">{userName || "Kullanıcı"}</span>
              </p>
              {auth.currentUser?.email === "muhammedalibekir@gmail.com" && (
                <a
                  href="/admin"
                  className="inline-block mt-[0.5vh] text-[clamp(0.7rem,0.5vw,1.2rem)] text-blue-500 hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  🔧 Admin Panel
                </a>
              )}
            </div>
            <div className="flex items-center gap-[0.6vw] mt-[1vh] sm:mt-0 w-full sm:w-auto">
              <button
                onClick={() => signOut(auth)}
                aria-label="Çıkış Yap"
                className="p-[0.8vw] rounded hover:bg-red-100 dark:hover:bg-red-900 transition text-red-600 dark:text-red-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-[1.6vw] h-[1.6vw] min-w-[24px] min-h-[24px]">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Çağrı Listesi ve Kayıtlar */}
      <div>
        <div className="flex flex-nowrap justify-between items-center mt-[1vh] gap-[1vw] w-full overflow-x-auto">
          {/* Sol tarafta çağrı butonları */}
          <div className="flex gap-[0.3vw] items-center">
            <button
              onClick={() => {
                const yeniSayi = callCount + 1;
                setCallCount(yeniSayi);
                guncelleFirebase({ callCount: yeniSayi });
              }}
              className={`px-[1vw] py-[0.6vh] rounded-md font-semibold text-white shadow-md transition text-[clamp(1rem,0.8vw,1.8rem)] w-auto ${
                blink ? "bg-red-600 animate-pulse" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              Çağrı ({callCount})
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
              className={`px-[0.4vw] py-[0.6vh] rounded-md font-semibold text-white shadow-md transition text-[clamp(1rem,0.8vw,1.8rem)] w-auto ${
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

          {/* Sağ tarafta bilgi kısmı */}
          <div className="flex-1 flex justify-center">
            <div className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded px-[1vw] py-[0.6vh] text-[clamp(0.7rem,1vw,1.1rem)] font-medium shadow-sm text-center whitespace-nowrap">
              Sıradaki kişi: <span className="font-bold">{siradakiKisi()}</span>. Size sıra gelmesine <span className="font-bold">{kalanKisiSayisi()}</span> kişi var.
            </div>
          </div>
        </div>
      </div>  
      <div className="flex-1 flex flex-col lg:flex-row w-full gap-[1.5vw] mt-[2vh] overflow-hidden">
        <div className="w-full lg:w-[75%] pr-0 lg:pr-[1.5vw] space-y-[0.5vh] overflow-visible">
          <div className="space-y-[0.6vh]">
            {activeList.map((emp, i) => (
              <div
                key={emp.uid}
                className={clsx(
                  "flex flex-col gap-[0.4vh] bg-white rounded-[0.4vw] shadow-sm p-[0.6vw] duration-200",
                  i === siradakiMusaitIndex() && "border-2 border-green-500"
                )}
              >
                {/* Üst Satır: Durum rengi ve isim */}
                <div className="flex items-center justify-between flex-wrap gap-[0.5vw] min-h-[3vh]">
                  <div className="flex items-center gap-[0.6vw]">
                    {/* Durum Dairesi */}
                    <div
                      className={clsx(
                        "w-[1vw] h-[1vw] min-w-[0.8vw] min-h-[0.8vw] rounded-full",
                        emp.status === "Müsait" && "bg-green-500",
                        emp.status === "Molada" && "bg-yellow-400",
                        emp.status === "İzinli" && "bg-gray-400",
                        emp.status === "Çalışıyor" && "bg-orange-500"
                      )}
                    ></div>
                    <p className="text-[clamp(0.9rem,0.7vw,1.1rem)] font-semibold truncate max-w-[50vw]">{emp.name}</p>
                  </div>

                  {/* Durum veya butonlar */}
                  {emp.uid === auth.currentUser?.uid ? (
                    <div className="flex flex-wrap gap-[0.3vw]">
                      <button
                        onClick={() => durumGuncelle(i, "Molada")}
                        className="px-[0.7vw] py-[0.3vh] bg-yellow-200 dark:bg-yellow-400 text-black rounded text-[clamp(0.6rem,0.6vw,0.8rem)]"
                      >
                        Moladayım
                      </button>
                      <button
                        onClick={() => durumGuncelle(i, "İzinli")}
                        className="px-[0.7vw] py-[0.3vh] bg-gray-300 dark:bg-gray-500 text-black dark:text-white rounded text-[clamp(0.6rem,0.6vw,0.8rem)]"
                      >
                        İzinliyim
                      </button>
                      <button
                        onClick={() => durumGuncelle(i, "Çalışıyor")}
                        className="px-[0.7vw] py-[0.3vh] bg-orange-400 dark:bg-orange-600 text-black rounded text-[clamp(0.6rem,0.6vw,0.8rem)]"
                      >
                        Çalışıyorum
                      </button>
                      <button
                        onClick={() => durumGuncelle(i, "Müsait")}
                        className="px-[0.7vw] py-[0.3vh] bg-green-400 dark:bg-green-600 text-black dark:text-white rounded text-[clamp(0.6rem,0.6vw,0.8rem)]"
                      >
                        Müsaitim
                      </button>
                    </div>
                  ) : (
                    <p className="italic text-[clamp(0.6rem,0.6vw,0.8rem)]">Durum: {emp.status}</p>
                  )}
                </div>

                {/* "Çağrı Aldım" butonu */}
                {emp.uid === auth.currentUser?.uid && emp.status === "Müsait" && i === siradakiMusaitIndex() && (
                  <div className="flex justify-start mt-[0.4vh]">
                    <button
                      onClick={ileriAl}
                      className="bg-green-500 text-white px-[0.7vw] py-[0.3vh] rounded hover:bg-green-600 transition text-[clamp(0.7rem,0.7vw,0.9rem)] min-w-[7vw] min-h-[2.5vh]"
                    >
                      ✅ Çağrı Aldım
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/4 flex flex-col">
          <div className="border-l-0 lg:pl-[1.5vw] pr-0" style={{height: 'calc(104vh - 18vw)'}}>
            <div className="bg-white dark:bg-white border border-gray-300 dark:border-gray-700 rounded-[0.7vw] shadow-sm px-[1vw] pt-[1vh] pb-[1vh] mr-0 lg:mr-[1vw] h-full flex flex-col">
              <h2 className="text-[clamp(1rem,1vw,1.5rem)] font-semibold mb-[0.8vh]">📋 Bugünkü Çağrı Kayıtları</h2>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ul className="list-disc pl-[1vw] sm:pl-[1.5vw] text-[clamp(0.65rem,0.7vw,1rem)] space-y-[0.4vh]">
                  {(logByDate[todayKey] || []).map((entry, index) => (
                    <li key={index}>{entry.time} - {entry.person} {entry.action ? entry.action : "çağrıyı aldı"}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="w-full text-center py-2 mt-auto text-[10px] sm:text-xs text-gray-400 border-t border-gray-200 dark:border-slate-700 bg-inherit">
        <span>Created by Ali Bekir Özer</span>
      </footer>
    </div>
  );
}
