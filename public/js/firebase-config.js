// firebase-config.js
// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD2f1_pHxKL8A58w25VJ1ioi89Gm421LP4",
    authDomain: "leather-gellery.firebaseapp.com",
    projectId: "leather-gellery",
    storageBucket: "leather-gellery.firebasestorage.app",
    messagingSenderId: "513483062348",
    appId: "1:513483062348:web:2c54aa3be068fd24f4cce9",
    measurementId: "G-5RDL2PFMBL"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
  
  // Global variable for current customer code
  let currentCustomerCode = null;