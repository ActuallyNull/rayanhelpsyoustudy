import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AuthStatus() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-in error:", error);
      // Handle specific errors like 'auth/popup-closed-by-user' if needed
      alert(`Google sign-in failed: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (user) {
    let displayNameText = "Welcome, ";
    if (user.email === "thenewgamerpro76@gmail.com") {
        displayNameText += "Rayan, Hope you get 100%!";
    } else {
        displayNameText += user.displayName || user.email.split('@')[0];
    }

    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">{displayNameText}</span>
        <button 
          onClick={handleSignOut}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={handleSignIn}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
    >
      Sign In with Google
    </button>
  );
}