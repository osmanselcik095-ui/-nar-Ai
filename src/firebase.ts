import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile
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
      // Allow any successfully logged-in user (Google, Email/Password, or Guest)
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken || "");
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
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken || "" };
  } catch (error: any) {
    console.error("Firebase Signin Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Register with Email and Password
export const registerWithEmail = async (email: string, password: string, displayName: string): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    return userCredential.user;
  } catch (error: any) {
    console.error("Firebase Sign up Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Login with Email and Password
export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error("Firebase Login Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Sign In as Guest (Anonymous) or local simulated fallback
export const loginAsGuest = async (): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await signInAnonymously(auth);
    if (!userCredential.user.displayName) {
      await updateProfile(userCredential.user, { displayName: "Misafir Kullanıcı" });
    }
    return userCredential.user;
  } catch (error: any) {
    console.warn("Firebase Anonymous Signin failed, falling back to clean local Guest:", error);
    // Return a self-mocked firebase-like user structure to ensure guest mode ALWAYS works without throwing
    const mockGuestUser: any = {
      uid: `guest_${Date.now()}`,
      email: "misafir@cinarai.local",
      displayName: "Misafir Kullanıcı",
      isAnonymous: true,
      photoURL: null,
    };
    return mockGuestUser;
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
