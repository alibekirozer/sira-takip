// src/MainApp.js
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import App from "./App";
import Login from "./Login";
import AdminPanel from "./AdminPanel";
import Stats from "./Stats";

export default function MainApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center mt-10">Yükleniyor...</div>;

  return (
    <Router>
      <Routes>
        {!user ? (
          <>
            <Route path="*" element={<Login />} />
          </>
        ) : (
          <>
            <Route path="/" element={<App />} />
            <Route
              path="/admin"
              element={
                user.email === "muhammedalibekir@gmail.com" ? (
                  <AdminPanel />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/admin/stats"
              element={
                user.email === "muhammedalibekir@gmail.com" ? (
                  <Stats />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}
