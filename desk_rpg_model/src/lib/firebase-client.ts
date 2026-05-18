// src/lib/firebase-client.ts — Firebase Client SDK initialization (browser only)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// AI Office Agents — user's own Firebase project (desk-rpg-a2edb)
const firebaseConfig = {
  apiKey: "AIzaSyBIIfQGK4vii1yaCxUyP36Zu2kiIsN0ceg",
  authDomain: "desk-rpg-a2edb.firebaseapp.com",
  projectId: "desk-rpg-a2edb",
  storageBucket: "desk-rpg-a2edb.firebasestorage.app",
  messagingSenderId: "540813976664",
  appId: "1:540813976664:web:10b816aa2d0c57dc65562d",
  measurementId: "G-YE578G2ZR3",
};

// Prevent re-initialization in HMR / multiple imports
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth = getAuth(app);
export default app;
