import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, subscribeToUserProfile, createUserProfile, getUserProfile } from '../firebase';
import { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // First check if profile exists, if not create it
          const p = await getUserProfile(u.uid);
          if (!p) {
            await createUserProfile(u);
          }
          
          // Subscribe for real-time updates
          unsubscribeProfile = subscribeToUserProfile(u.uid, (p) => {
            setProfile(p);
            setLoading(false);
          });
        } catch (err: any) {
          console.error("Auth error:", err);
          setError(err.message || "Failed to load user profile.");
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return { user, profile, loading, error };
}
