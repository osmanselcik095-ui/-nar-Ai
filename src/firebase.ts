import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/userinfo.profile");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Google yetkilendirme anahtarı alınamadı.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Firebase Signin Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log out
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};
