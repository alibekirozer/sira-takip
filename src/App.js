// App.js
import { useState, useEffect } from "react";
import clsx from "clsx";
import { ref, set, onValue } from "firebase/database";
import { db } from "./firebase";

const initialEmployees = [
  "Oğuz", "Mustafa", "Beyza", "Havva", "Nurefşan", "Betül",
  "Yaren", "Ali", "Yasin", "Tuğçe", "Tuna", "Emre"
];

export default function SiraTakip() {
  const [allEmployees, setAllEmployees] = useState(initialEmployees);
  const [selectedNames, setSelectedNames] = useState(initialEmployees);
  const [activeList, setActiveList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callCount, setCallCount] = useState(0);
  const [blink, setBlink] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [newName, setNewName] = useState("");
  const [log, setLog] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [time, setTime] = useState(new Date());
  const [firebaseLoaded, setFirebaseLoaded] = useState(false);
  const [benimAdim, setBenimAdim] = useState("");
  const [logByDate, setLogByDate] = useState({});
  const todayKey = new Date().toISOString().split("T")[0];

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
    const dataRef = ref(db, "siraTakip");
    onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActiveList(data.activeList || []);
        setCurrentIndex(data.currentIndex || 0);
        setCallCount(data.callCount || 0);
        setAllEmployees(data.allEmployees || initialEmployees);
        setSelectedNames(data.selectedNames || initialEmployees);
        setLogByDate(data.logByDate || {});
        if (!data.logByDate?.[todayKey]) {
          const updated = { ...data.logByDate, [todayKey]: [] };
          set(ref(db, "siraTakip/logByDate"), updated);
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
    set(ref(db, "siraTakip"), {
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

  const addNewName = () => {
    if (newName && !allEmployees.includes(newName)) {
      const updatedAll = [...allEmployees, newName];
      const updatedSelected = [...selectedNames, newName];
      const updatedList = [...activeList, { name: newName, status: "Çalışıyor" }];
      setAllEmployees(updatedAll);
      setSelectedNames(updatedSelected);
      setActiveList(updatedList);
      guncelleFirebase({ allEmployees: updatedAll, selectedNames: updatedSelected, activeList: updatedList });
    }
    setNewName("");
  };

  const removeName = (name) => {
    const updatedAll = allEmployees.filter((n) => n !== name);
    const updatedSelected = selectedNames.filter((n) => n !== name);
    const updatedList = activeList.filter((emp) => emp.name !== name);
    setAllEmployees(updatedAll);
    setSelectedNames(updatedSelected);
    setActiveList(updatedList);
    guncelleFirebase({ allEmployees: updatedAll, selectedNames: updatedSelected, activeList: updatedList });
  };

  return (
    <div className={`${darkMode ? "bg-slate-900 text-white" : "bg-white text-black"} min-h-screen p-6 space-y-4`}>
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">Koçsistem Çağrı Takip</h1>
        <div className="flex flex-col items-end space-y-2">
          <div className="text-base font-medium">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - {time.toLocaleDateString()}
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="px-3 py-1 rounded border border-gray-400 text-sm">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sm:space-x-4 space-y-2 sm:space-y-0">
        <select value={benimAdim} onChange={(e) => setBenimAdim(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Çalışan (seçiniz)</option>
          {allEmployees.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button onClick={() => setShowSelector(!showSelector)} className="bg-blue-500 text-white px-4 py-2 rounded">
          {showSelector ? "Çalışan Seçimini Gizle" : "Çalışan Listesi"}
        </button>
        <button
          onClick={() => {
            const yeniSayi = callCount + 1;
            setCallCount(yeniSayi);
            guncelleFirebase({ callCount: yeniSayi });
          }}
          className={`px-4 py-2 rounded font-semibold text-white ${blink ? "bg-red-600" : "bg-red-400"}`}
        >📞 Çağrı! ({callCount})</button>
      </div>

      {showSelector && (
        <div className={`mb-4 p-4 border rounded ${darkMode ? "bg-slate-800 border-gray-600" : "bg-gray-50"}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
            {allEmployees.map((name) => (
              <label key={name} className="flex items-center space-x-2">
                <input type="checkbox" checked={selectedNames.includes(name)} onChange={() => toggleName(name)} />
                <span>{name}</span>
                <button onClick={() => removeName(name)} className="text-red-500 text-xs font-bold ml-2" title="Kalıcı olarak sil">-</button>
              </label>
            ))}
          </div>
          <div className="flex space-x-2 mt-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Yeni isim" className="border p-1 rounded" />
            <button onClick={addNewName} className="bg-green-500 text-white px-2 rounded">Ekle</button>
          </div>
        </div>
      )}

      <div className="flex">
        <div className="w-3/4 pr-4 space-y-4">
          {activeList.map((emp, i) => (
            <div key={emp.name} className={clsx("border-2 rounded p-1.5 shadow-sm transition-all duration-200 w-full text-sm", durumRengi(emp.status),
              i === siradakiIndex() && (darkMode ? "scale-[1.02] border-4 border-green-600 bg-slate-800" : "scale-[1.02] border-4 border-green-600 bg-gray-50"))}>
              <div className="flex items-center justify-between mb-2">
              <p className="text-lg font-semibold mr-4">{emp.name}</p>
                <button onClick={() => durumGuncelle(i, "Molada")} className="text-sm px-2 py-1 bg-yellow-200 text-black rounded">Molada</button>
                <button onClick={() => durumGuncelle(i, "İzinli")} className="text-sm px-2 py-1 bg-gray-300 text-black rounded">İzinli</button>
                <button onClick={() => durumGuncelle(i, "Çalışıyor")} className="text-sm px-2 py-1 bg-orange-300 text-black rounded">Çalışıyor</button>
                <button onClick={() => durumGuncelle(i, "Müsait")} className="text-sm px-2 py-1 bg-green-300 text-black rounded mr-4">Müsait</button>
              <p className="text-sm italic">Durum: {emp.status}</p>
              </div>
              {i === siradakiIndex() && <button onClick={ileriAl} className="mt-3 block bg-green-500 text-white px-2 py-1 rounded">Çağrı Aldım</button>}
            </div>
          ))}
        </div>
        <div className="w-1/4 overflow-y-auto h-[900px] pl-4">
          <h2 className="text-xl font-semibold mb-2">📋 Bugünkü Çağrı Kayıtları</h2>
          <ul className="list-disc pl-6 text-sm">
            {(logByDate[todayKey] || []).map((entry, index) => (
              <li key={index}>{entry.time} - {entry.person} çağrıyı aldı</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
