import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import SessionCard from '@/components/SessionCard'; // We'll create this
import Modal from '@/components/Modal';

export default function SessionsPage() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchSessions(currentUser.uid);
      } else {
        setIsLoading(false);
        setSessions([]); // Clear sessions if user logs out
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchSessions = async (userId) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions?userId=${userId}`); // Use query param
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const { success, data } = await res.json();
      if (success) {
        setSessions(data);
      } else {
        throw new Error(data.error || 'Unknown error fetching sessions');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || "Failed to delete session.");
      }
      // Refresh sessions list
      setSessions(prevSessions => prevSessions.filter(s => s._id !== sessionId));
      showModal("Success", "Session deleted successfully.");
    } catch (err) {
      console.error(err);
      showModal("Error", `Failed to delete session: ${err.message}`);
    }
  };

  return (
    <>
      <Head>
        <title>My Study Sessions</title>
      </Head>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-blue-600">📚 Your Saved Study Sessions</h1>
          <Link href="/" legacyBehavior>
            <a className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              ← Back to Study
            </a>
          </Link>
        </div>

        {isLoading && <LoadingSpinner message="Loading sessions..." />}
        {!isLoading && !user && (
          <p className="text-red-600">⚠️ Please sign in to view your sessions.</p>
        )}
        {!isLoading && user && error && (
          <p className="text-red-600">❌ Failed to load sessions: {error}</p>
        )}
        {!isLoading && user && !error && sessions.length === 0 && (
          <p className="text-gray-600">You have no saved sessions yet.</p>
        )}
        {!isLoading && user && !error && sessions.length > 0 && (
          <div className="space-y-4">
            {sessions.map(session => (
              <SessionCard 
                key={session._id} 
                session={session} 
                onDelete={handleDeleteSession} 
              />
            ))}
          </div>
        )}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        {modalMessage}
      </Modal>
    </>
  );
}