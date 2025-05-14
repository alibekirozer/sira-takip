// src/components/Signup.js
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { dbf } from "./firebase"; 


export default function Signup({ onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);

      // İsim ekle (displayName)
      await updateProfile(auth.currentUser, {
        displayName: name
      });
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        name,
        email,
        createdAt: new Date(),
        role: "user" // admin / user gibi ileride ayrıştırmak için
      });
      alert("Kayıt başarılı! Giriş yapabilirsiniz.");
      onBack(); // Giriş ekranına dön
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4 max-w-sm mx-auto mt-10 p-4 border rounded shadow">
      <h2 className="text-xl font-semibold text-center">Kayıt Ol</h2>

      <input
        type="text"
        placeholder="Ad Soyad"
        className="w-full p-2 border rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <input
        type="email"
        placeholder="Email"
        className="w-full p-2 border rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Şifre"
        className="w-full p-2 border rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="text-blue-500 text-sm underline"
        >
          Girişe dön
        </button>
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
          Kayıt Ol
        </button>
      </div>
    </form>
  );
}
