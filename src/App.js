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
    const index = siradakiIndex();
    if (index !== -1) {
      const person = activeList[index].name;
      const timestamp = new Date().toLocaleTimeString();
      const yeniLog = [{ person, time: timestamp }, ...(logByDate[todayKey] || [])].slice(0, 200);
      const updatedLogByDate = { ...logByDate, [todayKey]: yeniLog };
      const yeniIndex = (index + 1) % activeList.length;
      const yeniCall = callCount > 0 ? callCount - 1 : 0;
      setCurrentIndex(yeniIndex);
      setCallCount(yeniCall);
      setLogByDate(updatedLogByDate);
      guncelleFirebase({ currentIndex: yeniIndex, callCount: yeniCall, logByDate: updatedLogByDate });
    }
  };

  const durumGuncelle = (index, status) => {
    const updated = [...activeList];
    updated[index].status = status;
    setActiveList(updated);
    guncelleFirebase({ activeList: updated, logByDate });
    //if (index === siradakiIndex()) ileriAl();
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
      const updatedList = [...activeList, { name, status: "Çalışıyor" }];
      setSelectedNames(updated);
      setActiveList(updatedList);
      guncelleFirebase({ selectedNames: updated, activeList: updatedList });
    }
  };

return (
  <div className={`${darkMode ? "bg-slate-900 text-white" : "bg-white text-black"} min-h-screen px-6 py-4 space-y-6`}>
    {/* Üst Bar */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
      {/* Başlık ve Saat */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KoçSistem Çağrı Takip</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <span>🕒</span>
          <span>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - {time.toLocaleDateString()}</span>
        </div>
      </div>

      {/* Kullanıcı Bilgisi ve İşlemler */}
      <div className="flex flex-col items-end space-y-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Hoş geldin, <span className="font-semibold text-blue-600">{userName}</span>
        </p>
        {/* Tema Butonu */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1 rounded border text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
        {auth.currentUser?.email === "muhammedalibekir@gmail.com" && (
          <a
            href="/admin"
            className="text-xs text-blue-500 underline hover:text-blue-600"
          >
            🔧 Admin Panel
          </a>
        )}
        <button
          onClick={() => signOut(auth)}
          className="mt-1 px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-sm transition"
        >
          🔓 Çıkış Yap
        </button>
      </div>
    </div>

    {/* Çağrı Butonu */}
    <div className="flex justify-center sm:justify-start mt-4">
      <button
        onClick={() => {
          const yeniSayi = callCount + 1;
          setCallCount(yeniSayi);
          guncelleFirebase({ callCount: yeniSayi });
        }}
        className={`px-6 py-2 rounded-md font-semibold text-white shadow-md transition ${
          blink ? "bg-red-600 animate-pulse" : "bg-red-500 hover:bg-red-600"
        }`}
      >
        📞 Yeni Çağrı ({callCount})
      </button>
    </div>

    <div className="flex">
      <div className="w-3/4 pr-4 space-y-4">
        {activeList.map((emp, i) => (
          <div
            key={emp.uid}
            className={clsx(
              "border-2 rounded-lg p-4 shadow-sm transition-all duration-200 text-sm",
              durumRengi(emp.status),
              i === siradakiIndex() &&
                (darkMode
                  ? "scale-[1.02] border-4 border-green-600 bg-slate-800"
                  : "scale-[1.02] border-4 border-green-600 bg-gray-50")
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold">{emp.name}</p>

              {emp.uid === auth.currentUser?.uid ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => durumGuncelle(i, "Molada")} className="text-sm px-2 py-1 bg-yellow-200 text-black rounded">Moladayım</button>
                  <button onClick={() => durumGuncelle(i, "İzinli")} className="text-sm px-2 py-1 bg-gray-300 text-black rounded">İzinliyim</button>
                  <button onClick={() => durumGuncelle(i, "Çalışıyor")} className="text-sm px-2 py-1 bg-orange-300 text-black rounded">Çalışıyorum</button>
                  <button onClick={() => durumGuncelle(i, "Müsait")} className="text-sm px-2 py-1 bg-green-300 text-black rounded">Müsaitim</button>
                </div>
              ) : (
                <p className="text-sm italic">Durum: {emp.status}</p>
              )}
            </div>

            {i === siradakiIndex() && emp.uid === auth.currentUser?.uid && (
              <button
                onClick={ileriAl}
                className="mt-3 block bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition"
              >
                ✅ Çağrı Aldım
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="lg:w-1/4 max-h-[900px] overflow-y-auto border-l pl-4">
        <h2 className="text-xl font-semibold mb-2">📋 Bugünkü Çağrı Kayıtları</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          {(logByDate[todayKey] || []).map((entry, index) => (
            <li key={index}>{entry.time} - {entry.person} çağrıyı aldı</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);
}