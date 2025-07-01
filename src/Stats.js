import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { realtimeDB } from "./firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function computeStats(logByDate, activeUsers, startDate, endDate) {
  const stats = {};
  const activeSet = new Set((activeUsers || []).map((u) => u.name));
  const start = new Date(startDate);
  const end = new Date(endDate);

  activeUsers.forEach((u) => {
    stats[u.name] = {
      name: u.name,
      callCount: 0,
      durations: { Molada: 0, "Çalışıyor": 0, Müsait: 0, İzinli: 0 },
    };
  });

  for (const [date, logs] of Object.entries(logByDate || {})) {
    const day = new Date(date);
    if (isNaN(day) || day < start || day > end) continue;
    const workStart = new Date(`${date}T08:30:00`);
    const workEnd = new Date(`${date}T17:30:00`);
    const sorted = [...logs].sort(
      (a, b) =>
        new Date(`${date}T${a.time}`) - new Date(`${date}T${b.time}`)
    );
    const daily = {};
    sorted.forEach((entry) => {
      const person = entry.person;
      if (!activeSet.has(person)) return;
      if (!stats[person])
        stats[person] = {
          name: person,
          callCount: 0,
          durations: { Molada: 0, "Çalışıyor": 0, Müsait: 0, İzinli: 0 },
        };
      let now = new Date(`${date}T${entry.time}`);
      if (!daily[person]) {
        const statusMatch = entry.action?.match(/(Molada|İzinli|Çalışıyor|Müsait)/);
        const startTime = now < workStart ? workStart : now;
        daily[person] = { lastStatus: statusMatch ? statusMatch[1] : null, lastTime: startTime };
        if (now < workStart) return;
      }
      const prev = daily[person];
      const periodStart = Math.max(prev.lastTime.getTime(), workStart.getTime());
      const periodEnd = Math.min(now.getTime(), workEnd.getTime());
      const diff = (periodEnd - periodStart) / 60000;
      if (diff > 0 && prev.lastStatus && stats[person].durations[prev.lastStatus] !== undefined) {
        stats[person].durations[prev.lastStatus] += diff;
      }
      let newStatus = prev.lastStatus;
      const callMatch = entry.action?.match(/çağrıyı aldı.*: (.*) → Çalışıyor/);
      const statusMatch = entry.action?.match(/Durum: (.*) → (.*)/);
      if (callMatch && now >= workStart && now <= workEnd) {
        newStatus = "Çalışıyor";
        stats[person].callCount += 1;
      } else if (statusMatch) {
        newStatus = statusMatch[2].trim();
      }
      daily[person] = { lastStatus: newStatus, lastTime: now };
    });
    Object.entries(daily).forEach(([person, data]) => {
      if (!activeSet.has(person)) return;
      const periodStart = Math.max(data.lastTime.getTime(), workStart.getTime());
      const periodEnd = workEnd.getTime();
      const diff = (periodEnd - periodStart) / 60000;
      if (diff > 0 && data.lastStatus && stats[person].durations[data.lastStatus] !== undefined) {
        stats[person].durations[data.lastStatus] += diff;
      }
    });
  }

  return Object.values(stats);
}

export default function Stats() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState({});
  const [activeList, setActiveList] = useState([]);
  const [filter, setFilter] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const logSnap = await get(ref(realtimeDB, "siraTakip/logByDate"));
      setLogs(logSnap.val() || {});
      const activeSnap = await get(ref(realtimeDB, "siraTakip/activeList"));
      setActiveList(activeSnap.val() || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (loading) return;
    const today = new Date();
    let s = new Date(today);
    let e = new Date(today);
    if (filter === "weekly") {
      s.setDate(e.getDate() - 6);
    } else if (filter === "monthly") {
      s.setDate(e.getDate() - 29);
    } else if (filter === "custom") {
      if (!startDate || !endDate) return;
      s = new Date(startDate);
      e = new Date(endDate);
    }
    setData(computeStats(logs, activeList, s, e));
  }, [logs, activeList, filter, startDate, endDate, loading]);

  if (loading) return <div className="p-4">Yükleniyor...</div>;

  let titleRange = "";
  if (filter === "daily") titleRange = "Bugün";
  else if (filter === "weekly") titleRange = "Son 7 Gün";
  else if (filter === "monthly") titleRange = "Son 30 Gün";
  else if (filter === "custom" && startDate && endDate)
    titleRange = `${startDate} - ${endDate}`;

  const chartData = {
    labels: data.map((d) => d.name),
    datasets: [
      {
        label: "Çağrı Sayısı",
        data: data.map((d) => d.callCount),
        backgroundColor: "rgba(75, 192, 192, 0.5)",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Kullanıcı İstatistikleri {titleRange && `(${titleRange})`}</h2>
        <div className="flex items-center gap-2 mb-4">
          <select
            className="border rounded p-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
            <option value="custom">Özel</option>
          </select>
          {filter === "custom" && (
            <>
              <input
                type="date"
                className="border rounded p-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="border rounded p-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="mb-8">
          <Bar data={chartData} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left border-b">Ad Soyad</th>
                <th className="px-3 py-2 text-left border-b">Molada (dk)</th>
                <th className="px-3 py-2 text-left border-b">Çalışıyor (dk)</th>
                <th className="px-3 py-2 text-left border-b">Müsait (dk)</th>
                <th className="px-3 py-2 text-left border-b">İzinli (dk)</th>
                <th className="px-3 py-2 text-left border-b">Çağrı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((d) => (
                <tr key={d.name} className="hover:bg-gray-50">
                  <td className="p-2 border">{d.name}</td>
                  <td className="p-2 border">{Math.round(d.durations.Molada)}</td>
                  <td className="p-2 border">{Math.round(d.durations["Çalışıyor"])} </td>
                  <td className="p-2 border">{Math.round(d.durations.Müsait)}</td>
                  <td className="p-2 border">{Math.round(d.durations.İzinli)}</td>
                  <td className="p-2 border">{d.callCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
