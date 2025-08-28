// pages/dashboard.js
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [mediaJobs, setMediaJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchMediaJobs(currentUser.uid);
      } else {
        setIsLoading(false);
        setMediaJobs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchMediaJobs = async (userId) => {
    setIsLoading(true);
    setError(null);
    try {
      // This API endpoint will be created in the next step
      const res = await fetch(`/api/user-media-jobs?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch media jobs');
      const { success, data } = await res.json();
      if (success) {
        setMediaJobs(data);
      } else {
        throw new Error(data.error || 'Unknown error fetching media jobs');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>My Documents Dashboard</title>
      </Head>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-blue-600">📚 Your Documents</h1>
          <Link href="/" legacyBehavior>
            <a className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              ← Back to Upload
            </a>
          </Link>
        </div>

        {isLoading && <LoadingSpinner message="Loading your documents..." />}
        {!isLoading && !user && (
          <p className="text-red-600">⚠️ Please sign in to view your documents.</p>
        )}
        {!isLoading && user && error && (
          <p className="text-red-600">❌ Failed to load documents: {error}</p>
        )}
        {!isLoading && user && !error && mediaJobs.length === 0 && (
          <p className="text-gray-600">You have not uploaded any documents yet, or none have completed processing with AI content.</p>
        )}
        {!isLoading && user && !error && mediaJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaJobs.map((job) => (
              <Link key={job._id} href={`/document/${job._id}`} legacyBehavior>
                <a className="bg-white shadow-md rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{job.fileName || job.identifier}</h2>
                  <p className="text-gray-600 text-sm">Type: {job.type}</p>
                  <p className="text-gray-600 text-sm">Status: {job.status}</p>
                  {job.generatedContent?.notes && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2 mr-2">Notes</span>
                  )}
                  {job.generatedContent?.mcqs && job.generatedContent.mcqs.length > 0 && (
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-2 mr-2">MCQs</span>
                  )}
                  {job.generatedContent?.flashcards && job.generatedContent.flashcards.length > 0 && (
                    <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mt-2">Flashcards</span>
                  )}
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}