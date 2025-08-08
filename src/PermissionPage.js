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

  const toggleIzin = async (emp) => {
    const activeRef = ref(realtimeDB, "siraTakip/activeList");
    const snap = await get(activeRef);
    const list = snap.val() || [];
    const idx = list.findIndex((e) => e.uid === emp.uid);
    if (idx === -1) return;
    const newStatus = list[idx].status === "İzinli" ? "Müsait" : "İzinli";
    list[idx].status = newStatus;
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
        newStatus === "İzinli"
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
            <th className="px-3 py-2 text-center border-b">İzinli</th>
            <th className="px-3 py-2 text-left border-b">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {activeList.map((emp) => (
            <tr key={emp.uid} className="hover:bg-gray-50">
              <td className="p-2 border">{emp.name}</td>
              <td className="p-2 border text-center">
                {emp.status === "İzinli" ? "✅" : "❌"}
              </td>
              <td className="p-2 border text-left">
                <button
                  onClick={() => toggleIzin(emp)}
                  className="text-blue-600 hover:underline"
                >
                  {emp.status === "İzinli" ? "İzni Kaldır" : "İzin Ver"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

