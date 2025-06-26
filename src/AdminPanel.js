import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { firestoreDB, auth, realtimeDB, functions } from "./firebase";
import { ref, get, set } from "firebase/database";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { httpsCallable } from "firebase/functions";

const maskPassword = (len = 6) => "*".repeat(len);

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [editedPassword, setEditedPassword] = useState("");
  const [activeList, setActiveList] = useState([]);
  const [logByDate, setLogByDate] = useState({});
  const todayKey = new Date().toISOString().split("T")[0];

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(firestoreDB, "users"));
    const userList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(userList);
    setLoading(false);
  };

  const fetchActiveList = async () => {
    const snap = await get(ref(realtimeDB, "siraTakip"));
    const data = snap.val() || {};
    setActiveList(data.activeList || []);
    setLogByDate(data.logByDate || {});
  };

  useEffect(() => {
    fetchUsers();
    fetchActiveList();
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

  const updateStatus = async (user, status) => {
    const activeRef = ref(realtimeDB, "siraTakip/activeList");
    const snap = await get(activeRef);
    const list = snap.val() || [];
    const idx = list.findIndex((emp) => emp.uid === user.uid);
    const oldStatus = idx !== -1 ? list[idx].status : "";
    const updatedList = idx !== -1
      ? list.map((emp) =>
          emp.uid === user.uid ? { ...emp, status } : emp
        )
      : [...list, { uid: user.uid, name: user.name, status }];
    await set(activeRef, updatedList);
    setActiveList(updatedList);

    const logRef = ref(realtimeDB, "siraTakip/logByDate");
    const logSnap = await get(logRef);
    const logData = logSnap.val() || {};
    const entry = {
      person: user.name,
      time: new Date().toLocaleTimeString(),
      action: `Durum: ${oldStatus || "-"} → ${status}`,
    };
    const updatedForToday = [
      entry,
      ...(logData[todayKey] || []),
    ].slice(0, 200);
    const updatedLogs = { ...logData, [todayKey]: updatedForToday };
    await set(logRef, updatedLogs);
    setLogByDate(updatedLogs);
  };

  const startEdit = (user) => {
    setEditingId(user.uid);
    setEditedName(user.name);
    setEditedEmail(user.email);
    setEditedPassword("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedName("");
    setEditedEmail("");
    setEditedPassword("");
  };

  const saveChanges = async (user) => {
    try {
      await updateDoc(doc(firestoreDB, "users", user.uid), {
        name: editedName,
        email: editedEmail,
        ...(editedPassword && { passwordLength: editedPassword.length }),
      });

      const activeRef = ref(realtimeDB, "siraTakip/activeList");
      const snap = await get(activeRef);
      const list = snap.val() || [];
      const updatedList = list.map((emp) =>
        emp.uid === user.uid ? { ...emp, name: editedName } : emp
      );
      await set(activeRef, updatedList);

      if (editedEmail !== user.email || editedPassword) {
        const updateCred = httpsCallable(functions, "updateUserCredentials");
        await updateCred({
          uid: user.uid,
          email: editedEmail !== user.email ? editedEmail : undefined,
          password: editedPassword || undefined,
          passwordLength: editedPassword ? editedPassword.length : undefined,
        });
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                name: editedName,
                email: editedEmail,
                ...(editedPassword && { passwordLength: editedPassword.length }),
              }
            : u
        )
      );
      cancelEdit();
    } catch (err) {
      console.error("User update error", err);
    }
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
        passwordLength: password.length,
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
            <th className="p-2 border">Şifre</th>
            <th className="p-2 border">Rol</th>
            <th className="p-2 border">Durum</th>
            <th className="p-2 border">Düzenle</th>
            <th className="p-2 border">Admin Yap</th>
            <th className="p-2 border">Sil</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid} className="hover:bg-gray-50">
              <td className="p-2 border">
                {editingId === user.uid ? (
                  <input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="border p-1"
                  />
                ) : (
                  user.name
                )}
              </td>
              <td className="p-2 border">
                {editingId === user.uid ? (
                  <input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="border p-1"
                  />
                ) : (
                  user.email
                )}
              </td>
              <td className="p-2 border">
                {editingId === user.uid ? (
                  <input
                    type="password"
                    value={editedPassword}
                    placeholder={maskPassword(user.passwordLength)}
                    onChange={(e) => setEditedPassword(e.target.value)}
                    onFocus={(e) => (e.target.placeholder = "")}
                    className="border p-1"
                  />
                ) : (
                  maskPassword(user.passwordLength)
                )}
              </td>
              <td className="p-2 border capitalize">{user.role}</td>
              <td className="p-2 border">
                <select
                  value={
                    activeList.find((emp) => emp.uid === user.uid)?.status || ""
                  }
                  onChange={(e) => updateStatus(user, e.target.value)}
                  className="border p-1"
                >
                  <option value="">Seç...</option>
                  <option value="Molada">Molada</option>
                  <option value="İzinli">İzinli</option>
                  <option value="Çalışıyor">Çalışıyor</option>
                  <option value="Müsait">Müsait</option>
                </select>
              </td>
              <td className="p-2 border text-center">
                {editingId === user.uid ? (
                  <>
                    <button
                      onClick={() => saveChanges(user)}
                      className="text-green-600 hover:underline"
                    >
                      💾 Kaydet
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-gray-600 hover:underline ml-2"
                    >
                      Vazgeç
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(user)}
                    className="text-blue-600 hover:underline"
                  >
                    ✏️ Düzenle
                  </button>
                )}
              </td>
              <td className="p-2 border text-center">
                <button
                  onClick={() => toggleRole(user)}
                  className="text-blue-600 hover:underline"
                >
                  🔁 {user.role === "admin" ? "User" : "Admin"} yap
                </button>
              </td>
              <td className="p-2 border text-center">
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
