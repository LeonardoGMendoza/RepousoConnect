import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, increment } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

const firebaseConfig = {
  apiKey: "AIzaSyAs5x6nWIIMbqJ-KXaLJew400MsTxi1wUM",
  authDomain: "repousoconnect.firebaseapp.com",
  projectId: "repousoconnect",
  storageBucket: "repousoconnect.firebasestorage.app",
  messagingSenderId: "559910943640",
  appId: "1:559910943640:web:656045929cc8275e4c09ed"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

const WEB_CLIENT_ID = "794570861236-rkldud2jcr6qhjbvg0thbv7n438ts8gp.apps.googleusercontent.com";

let socialLoginInitialized = false;
const ensureSocialLoginInitialized = async () => {
  if (socialLoginInitialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: WEB_CLIENT_ID,
    }
  });
  socialLoginInitialized = true;
};

const ensureUserProfile = async (user) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      points: 0,
      joinedAt: new Date().toISOString()
    });
  }
};

export const loginWithGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await ensureSocialLoginInitialized();
      const res = await SocialLogin.login({ provider: "google", options: {} });
      const idToken = res.result?.idToken;
      if (!idToken) {
        throw new Error("No idToken returned from native Google Sign-In");
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await ensureUserProfile(result.user);
      return result.user;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      return result.user;
    }
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const addPoints = async (uid, amount) => {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { points: increment(amount) }, { merge: true });
};

export const updateUserData = async (uid, data) => {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, data, { merge: true });
};
