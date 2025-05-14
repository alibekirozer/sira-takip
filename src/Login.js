import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import Signup from "./Signup";
import { sendPasswordResetEmail } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);

  if (showSignup) {
    return <Signup onBack={() => setShowSignup(false)} />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError("");
      alert("Giriş başarılı!");
    } catch (err) {
      setError("Giriş başarısız: " + err.message);
    }
  };

  const handleResetPassword = async () => {
   if (!email) {
      setError("Lütfen önce e-posta adresinizi girin.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
     alert("Parola sıfırlama bağlantısı e-posta adresinize gönderildi.");
   } catch (err) {
      setError("Hata: " + err.message);
    }
  };

  return (
  <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto mt-10 p-4 border rounded shadow">
    <h2 className="text-xl font-semibold text-center">Giriş Yap</h2>
    
    <input
      type="email"
      placeholder="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="w-full p-2 border rounded"
      required
    />
    
    <input
      type="password"
      placeholder="Şifre"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full p-2 border rounded"
      required
    />
    
    {error && <p className="text-red-500 text-sm">{error}</p>}

    <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
      Giriş Yap
    </button>

    {/* ✅ Kayıt bağlantısı */}
    <p className="text-sm text-center">
      Hesabın yok mu?{" "}
      <button
        type="button"
        onClick={() => setShowSignup(true)}
        className="text-blue-500 underline"
      >
        Kayıt Ol
      </button>
    </p>

    {/* ✅ Parola sıfırlama bağlantısı */}
    <p className="text-sm text-center">
      Şifreni mi unuttun?{" "}
      <button
        type="button"
        onClick={handleResetPassword}
        className="text-blue-500 underline"
      >
        Parolamı Sıfırla
      </button>
    </p>
  </form>
);
}
