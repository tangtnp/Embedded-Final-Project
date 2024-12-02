import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_REACT_APP_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_REACT_APP_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_REACT_APP_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_REACT_APP_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_REACT_APP_STORAGE_BUCKET,

  // messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  // appId: process.env.REACT_APP_APP_ID,

  // apiKey: "AIzaSyANdU9ClF-Ew1KdQZrsd-0ZYh6dv_mcf8",
  // authDomain: "fishtank-2b906.firebaseapp.com",
  // databaseURL: "https://fishtank-2b906-default-rtdb.asia-southeast1.firebasedatabase.app/",
  // projectId: "fishtank-2b906",
  // storageBucket: "fishtank-2b906.appspot.com",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, onValue, update };
