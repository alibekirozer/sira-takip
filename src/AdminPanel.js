import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { firestoreDB, auth, realtimeDB } from "./firebase";
import { ref, get, set } from "firebase/database";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(firestoreDB, "users"));
    const userList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleRole = async (user) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    await updateDoc(doc(firestoreDB, "users", user.uid), { role: newRole });
    setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, role: newRole } : u)));
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`${user.name} adlı kullanıcı silinsin mi?`)) return;

    await deleteDoc(doc(firestoreDB, "users", user.uid));

    // Realtime DB'den de kaldır
    const snapshot = await get(ref(realtimeDB, "siraTakip/activeList"));
    const list = snapshot.val() || [];
    const updatedList = list.filter((emp) => emp.uid !== user.uid);
    await set(ref(realtimeDB, "siraTakip/activeList"), updatedList);

    setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const secondaryApp = initializeApp(auth.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await updateProfile(cred.user, { displayName: name });

      await setDoc(doc(firestoreDB, "users", cred.user.uid), {
        uid: cred.user.uid,
        name,
        email,
        createdAt: new Date(),
        role: "user",
      });

      const activeRef = ref(realtimeDB, "siraTakip/activeList");
      const snap = await get(activeRef);
      const list = snap.val() || [];
      await set(activeRef, [...list, { name, uid: cred.user.uid, status: "Çalışıyor" }]);

      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      setName("");
      setEmail("");
      setPassword("");
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-4 text-center">Yükleniyor...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Kullanıcı Yönetimi</h2>
      <form onSubmit={handleCreateUser} className="mb-6 space-x-2">
        <input
          type="text"
          placeholder="Ad Soyad"
          className="border p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          className="border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
          Ekle
        </button>
      </form>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Ad Soyad</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Rol</th>
            <th className="p-2 border">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid} className="hover:bg-gray-50">
              <td className="p-2 border">{user.name}</td>
              <td className="p-2 border">{user.email}</td>
              <td className="p-2 border capitalize">{user.role}</td>
              <td className="p-2 border space-x-2">
                <button
                  onClick={() => toggleRole(user)}
                  className="text-blue-600 hover:underline"
                >
                  🔁 Rolü {user.role === "admin" ? "user" : "admin"} yap
                </button>
                <button
                  onClick={() => deleteUser(user)}
                  className="text-red-600 hover:underline"
                >
                  🗑 Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
