import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { auth, realtimeDB } from "./firebase";
import { formatTime } from "./timeUtils";

export default function PermissionPage() {
  const [activeList, setActiveList] = useState([]);
  const todayKey = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchList = async () => {
      const snap = await get(ref(realtimeDB, "siraTakip/activeList"));
      setActiveList(snap.val() || []);
    };
    fetchList();
  }, []);

  const setIzinStatus = async (emp, status) => {
    const activeRef = ref(realtimeDB, "siraTakip/activeList");
    const snap = await get(activeRef);
    const list = snap.val() || [];
    const idx = list.findIndex((e) => e.uid === emp.uid);
    if (idx === -1) return;

    if (list[idx].status === status) return; // no change

    list[idx].status = status;
    await set(activeRef, list);
    setActiveList(list);

    const changerUid = auth.currentUser?.uid;
    const changerName =
      list.find((e) => e.uid === changerUid)?.name ||
      auth.currentUser?.displayName ||
      "Kullanıcı";

    const logRef = ref(realtimeDB, "siraTakip/logByDate");
    const logSnap = await get(logRef);
    const logData = logSnap.val() || {};
    const entry = {
      person: changerName,
      time: formatTime(),
      action:
        status === "İzinli"
          ? `${emp.name} izinli yapıldı`
          : `${emp.name} izinden çıkarıldı`,
    };
    const updatedForToday = [
      entry,
      ...(logData[todayKey] || []),
    ].slice(0, 200);
    const updatedLogs = { ...logData, [todayKey]: updatedForToday };
    await set(logRef, updatedLogs);
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl mb-4">İzin Yönetimi</h1>
      <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left border-b">Ad</th>
            <th className="px-3 py-2 text-center border-b">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {activeList.map((emp) => (
            <tr key={emp.uid} className="hover:bg-gray-50">
              <td className="p-2 border flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    emp.status === "İzinli" ? "bg-gray-400" : "bg-green-500"
                  }`}
                ></span>
                {emp.name}
              </td>
              <td className="p-2 border text-center space-x-2">
                <button
                  onClick={() => setIzinStatus(emp, "İzinli")}
                  className={`px-2 py-1 rounded ${
                    emp.status === "İzinli"
                      ? "bg-gray-400 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  İzinli
                </button>
                <button
                  onClick={() => setIzinStatus(emp, "Müsait")}
                  className={`px-2 py-1 rounded ${
                    emp.status === "Müsait"
                      ? "bg-green-500 text-white"
                      : "bg-green-200 text-green-800"
                  }`}
                >
                  Müsait
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

