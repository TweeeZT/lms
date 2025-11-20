// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBU_sC-hrHw-E_7-6TsTUfFmqpTTazZxVg",
  authDomain: "lms-afterschola.firebaseapp.com",
  projectId: "lms-afterschola",
  storageBucket: "lms-afterschola.firebasestorage.app",
  messagingSenderId: "517906479002",
  appId: "1:517906479002:web:682f8bd4b3888d384f2c23",
  measurementId: "G-V33RYWR0Z0",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
