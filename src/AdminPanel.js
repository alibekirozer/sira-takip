// src/components/AdminPanel.js
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestoreDB } from "./firebase";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(firestoreDB, "users"));
      const userList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Yükleniyor...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Kayıtlı Kullanıcılar</h2>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Ad Soyad</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Rol</th>
            <th className="p-2 border">Kayıt Tarihi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="p-2 border">{user.name}</td>
              <td className="p-2 border">{user.email}</td>
              <td className="p-2 border capitalize">{user.role}</td>
              <td className="p-2 border">
                {user.createdAt?.toDate?.().toLocaleString() || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
