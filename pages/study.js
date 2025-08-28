// pages/study.js
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';
import { useRouter } from 'next/router';

// We no longer need pdfjsLib, JSZip, or client-side PDF/PPTX extraction here.
// The upload function from @vercel/blob/client is handled implicitly by handleUploadUrl in /api/media/upload.

export default function StudyPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authToken, setAuthToken] = useState(null); // New state to store Firebase ID token

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const [fileName, setFileName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setUserId(currentUser.uid);
        const token = await currentUser.getIdToken();
        setAuthToken(token);
      } else {
        setUserId(null);
        setAuthToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const handleGenerate = async () => {
    if (!userId || !authToken) {
      showModal("Login Required", "Please sign in to upload files.");
      return;
    }

    const file = fileInputRef.current?.files[0];

    if (!file && !youtubeUrl) {
      showModal("Input Required", "Please select a file or enter a YouTube URL.");
      return;
    }

    setIsLoading(true);

    if (youtubeUrl) {
      setLoadingMessage('Processing YouTube URL...');
      await processMediaAndCreateJob({ type: 'youtube', identifier: youtubeUrl });
    } else if (file) {
      setFileName(file.name);
      setLoadingMessage('Uploading file...');
      await processMediaAndCreateJob({ type: 'file', file });
    }
  };

  const processMediaAndCreateJob = async ({ type, identifier, file }) => {
    try {
        let jobId = null;

        if (type === 'file') {
            // For file uploads, we call our /api/media/upload endpoint
            // The /api/media/upload endpoint will then call /api/media/process
            // It needs the raw file data and the auth token.
            const uploadHeaders = new Headers();
            uploadHeaders.set('Authorization', `Bearer ${authToken}`);

            const response = await fetch('/api/media/upload', {
                method: 'POST',
                headers: uploadHeaders,
                body: file, // Send the raw file directly
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload file.');
            }

            // The /api/media/upload response contains blob info, but not the jobId directly
            // The jobId will be established in /api/media/process, which is triggered by /api/media/upload
            // We'll need to poll for status using the blob URL or wait for the process API to return a jobId
            // For simplicity, we'll assume /api/media/upload returns a jobId from its internal call to process.js
            // Or we will poll the user's jobs for a pending/processing job matching this identifier
            // (Current setup for process.js means it creates the job and returns jobId, but upload.js doesn't forward it directly yet.)
            // Let's modify upload.js to return the jobId from process.js's response.
            // For now, we will poll for the status of ALL user jobs and look for one with matching identifier
            setLoadingMessage('File uploaded. Waiting for processing to start...');
            // This is a temporary polling strategy, the ideal is for /api/media/upload to return jobId
            jobId = await findJobIdByUrlPolling(identifier.name || file.name, authToken); // Pass the original file name/identifier
            if (!jobId) throw new Error("Could not find a matching job to poll.");


        } else if (type === 'youtube') {
            // For YouTube URLs, directly call /api/media/process
            setLoadingMessage('Submitting YouTube URL for processing...');
            const processResponse = await fetch('/api/media/process', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type, identifier }),
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || 'Failed to start YouTube processing.');
            }
            const data = await processResponse.json();
            jobId = data.jobId;
        }

        if (jobId) {
            pollJobStatus(jobId, authToken);
        } else {
            throw new Error("No job ID received to start polling.");
        }

    } catch (error) {
        console.error('Error initiating media job:', error);
        showModal("Processing Error", `An error occurred: ${error.message}`);
        setIsLoading(false);
    } finally {
        if(fileInputRef.current) fileInputRef.current.value = null; // Clear file input
        setYoutubeUrl(''); // Clear YouTube URL input
    }
  };


  // Helper to find jobId for uploaded files if /api/media/upload doesn't return it directly
  const findJobIdByUrlPolling = async (originalIdentifier, token) => {
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 3000; // Poll every 3 seconds

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(null);
          return;
        }
        attempts++;
        try {
          const res = await fetch(`/api/user-media-jobs?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to fetch user jobs for polling.');
          const { success, data: jobs } = await res.json();
          if (success && jobs) {
            // Look for a job that is 'pending' or 'processing' with the matching identifier
            // The identifier from /api/media/process will be the Vercel Blob URL, not the original filename
            // We need a way to link them, or pass jobId back from /api/media/upload
            // For now, let's assume 'identifier' might contain the original fileName in its URL or we match by fileName.
            // A more robust solution would be to have /api/media/upload return the jobId.
            const matchedJob = jobs.find(job =>
                (job.type === 'file' && job.fileName === originalIdentifier) &&
                (job.status === 'pending' || job.status === 'processing')
            );

            if (matchedJob) {
              clearInterval(interval);
              resolve(matchedJob._id);
            }
          }
        } catch (error) {
          console.error("Polling for jobId failed:", error);
        }
      }, pollInterval);
    });
  };


  const pollJobStatus = async (jobId, token) => {
    setLoadingMessage('Starting processing...');
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/media/status?jobId=${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Could not fetch job status.');

            const data = await res.json();
            setLoadingMessage(data.status);

            if (data.status === 'completed' || data.status === 'failed') {
                clearInterval(interval);
                setIsLoading(false);
                if (data.status === 'completed') {
                    router.push(`/document/${jobId}`); // Redirect to the new document detail page
                } else {
                    showModal("Processing Failed", "Failed to process the media.");
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            clearInterval(interval);
            setIsLoading(false);
            showModal("Polling Error", "Error checking job status.");
        }
    }, 3000); // Poll every 3 seconds
  };

  return (
    <>
      <Head>
        <title>Upload & Study - Rayan Helps You Study</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-xl min-h-[60vh]">
          {isLoading && <LoadingSpinner message={loadingMessage} />}

          {!isLoading && !user && (
            <p className="text-red-600 text-center p-10">⚠️ Please sign in to upload and process documents.</p>
          )}

          {!isLoading && user && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">Upload Your Notes or Media</h2>
              <input
                type="file"
                accept=".pdf,.pptx,.mp3,.mp4,.webm" // Added webm for video
                onChange={(e) => setFileName(e.target.files[0]?.name || '')}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
              />
              {fileName && <p className="mt-3 text-sm text-gray-600">Selected: {fileName}</p>}<div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-white px-2 text-sm text-gray-500">Or</span>
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700">YouTube URL</label>
                    <input type="url" name="youtube-url" id="youtube-url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="https://www.youtube.com/watch?v=..." />
                </div>

              <button
                onClick={handleGenerate}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={isLoading}
              >
                Generate Study Material
              </button>

              <div className="mt-6 text-center">
                <Link href="/dashboard" legacyBehavior>
                  <a className="text-blue-600 hover:underline">View Your Documents Dashboard</a>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        {modalMessage}
      </Modal>
    </>
  );
}