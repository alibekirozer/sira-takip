import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8JAzcgLPRP0MXYO3iC49vTpQFxSW-6K4",
  authDomain: "sira-takip.firebaseapp.com",
  databaseURL: "https://sira-takip-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sira-takip",
  storageBucket: "sira-takip.firebasestorage.app",
  messagingSenderId: "886629696694",
  appId: "1:886629696694:web:6bb16773cf15307b511217"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const dbf = getFirestore(app);
