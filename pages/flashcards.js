// pages/flashcards.js
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';

export default function FlashcardsPage() {
    const router = useRouter();
    const { sessionId } = router.query;

    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Start true to load session
    const [loadingMessage, setLoadingMessage] = useState("Verifying session...");
    const [documentText, setDocumentText] = useState(null);
    const [documentTitle, setDocumentTitle] = useState("Document");
    const [flashcards, setFlashcards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');

    const [sessionsList, setSessionsList] = useState([]);
    const [selectedSessionForFlashcards , setSelectedSessionForFlashcards ] = useState(null)

    const showModal = (title, message) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalOpen(true);
    };

    // Effect for user authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                showModal("Authentication Required", "Please sign in to use flashcards.");
                setIsLoading(false);
                // Optionally redirect to login or home page after a delay or on modal close
                // setTimeout(() => router.push('/'), 3000);
            }
            // Session fetching will be triggered by the sessionId and user state
        });
        return () => unsubscribe();
    }, []);

    // Effect for fetching session data once user and sessionId are available
    useEffect(() => {
        if (user) {
            if (sessionId) { // If sessionId is in URL, fetch that specific session
                fetchSessionData(sessionId, user.uid);
                setSelectedSessionForFlashcards(sessionId); // Mark it as selected
            } else { // No sessionId in URL, fetch all sessions for the user to choose from
                fetchAllUserSessions(user.uid);
                setIsLoading(false); // Not loading a specific session yet
            }
        } else if (!user && !isLoading) { // Ensure we don't overwrite loading from auth
             setIsLoading(false);
        }
    }, [user, sessionId]);

    const fetchAllUserSessions = async (uid) => {
        setIsLoading(true);
        setLoadingMessage("Loading your study sessions...");
        try {
            const res = await fetch(`/api/sessions?userId=${uid}`); // API to get all sessions for user
            if (!res.ok) throw new Error("Failed to fetch your sessions.");
            const { success, data } = await res.json();
            if (success) {
                setSessionsList(data);
            } else {
                throw new Error(data.error || "Could not load sessions.");
            }
        } catch (error) {
            console.error("Error fetching all user sessions:", error);
            showModal("Error", `Could not load your sessions: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSessionData = async (sId, uid) => {
        setIsLoading(true);
        setLoadingMessage("Fetching document & existing flashcards...");
        try {
            const res = await fetch(`/api/sessions/${sId}`);
            const json = await res.json(); // Only call once!
            if (!res.ok) {
                throw new Error(json.error || "Failed to fetch session data.");
            }
            const { success, data: session } = json;

            if (!success || !session) throw new Error("Session data not found.");
            if (session.userId !== uid) {
                showModal("Access Denied", "This session does not belong to you.");
                setIsLoading(false);
                router.push('/');
                return;
            }

            setDocumentText(session.pdfText);
            setDocumentTitle(session.fileName || "Document");
            setSelectedSessionForFlashcards(sId);

            if (session.flashcards && session.flashcards.length > 0) {
                setFlashcards(session.flashcards);
                setCurrentCardIndex(0);
                setIsFlipped(false);
                setIsLoading(false); 
            } else {
                setFlashcards([]);
                if (session.pdfText) {
                    // generateFlashcards will be called by its useEffect
                } else {
                    showModal("Error", "Document text not found in session.");
                    setIsLoading(false);
                }
            }
        } catch (error) {
            console.error("Error fetching session data:", error);
            showModal("Error", `Could not load document: ${error.message}`);
            setDocumentText(null);
            setIsLoading(false);
        }
    };

    // Effect for generating flashcards if documentText is loaded and no flashcards are set yet
    useEffect(() => {
        // Check user to prevent generation if logged out during async operations
        if (documentText && flashcards.length === 0 && !isLoading && user) {
            generateFlashcards();
        }
    }, [documentText, user, isLoading]); // Add user & isLoading to ensure it runs at the right time


    const generateFlashcards = async () => {
        // Use selectedSessionForFlashcards instead of sessionId directly here
        if (!documentText || !selectedSessionForFlashcards || !user) return;
        // ... (rest of generateFlashcards function is the same, using selectedSessionForFlashcards for the PUT request)
        setIsLoading(true);
        setLoadingMessage("Generating flashcards with AI...");
        try {
            const res = await fetch('/api/ai/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: documentText, count: 15 }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({error: "Failed to generate flashcards from AI."}));
                throw new Error(errData.error);
            }
            const { flashcards: generatedFlashcards } = await res.json();

            if (generatedFlashcards && generatedFlashcards.length > 0) {
                setFlashcards(generatedFlashcards);
                setCurrentCardIndex(0);
                setIsFlipped(false);

                setLoadingMessage("Saving flashcards to session...");
                const saveRes = await fetch(`/api/sessions/${selectedSessionForFlashcards}`, { // Use selectedSessionForFlashcards
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ flashcards: generatedFlashcards }),
                });
                if (!saveRes.ok) {
                    const saveErrData = await saveRes.json().catch(() => ({error: "Failed to save flashcards and parse error."}));
                    showModal("Save Error", `Flashcards generated, but failed to save to session: ${saveErrData.error}. You can still use them for now.`);
                    console.error("Error saving flashcards to session:", saveErrData.error);
                } else {
                    console.log("Flashcards saved to session successfully.");
                }
            } else {
                showModal("No Flashcards", "AI could not generate flashcards for this document at the moment.");
            }
        } catch (error) {
            console.error("Error in generateFlashcards process:", error);
            showModal("AI Error", `Failed to generate or process flashcards: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNextCard = () => {
        if (currentCardIndex < flashcards.length - 1) {
            setCurrentCardIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const handlePrevCard = () => {
        if (currentCardIndex > 0) {
            setCurrentCardIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const currentCard = flashcards[currentCardIndex];

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (flashcards.length === 0 || !currentCard) return; // Ensure card is loaded
            if (event.key === 'ArrowRight') {
                handleNextCard();
            } else if (event.key === 'ArrowLeft') {
                handlePrevCard();
            } else if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                setIsFlipped(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentCardIndex, flashcards, currentCard]); // Added currentCard to dependencies

    const handleSessionSelectForFlashcards = (sId) => {
        // Navigate to the same page but with sessionId query param
        // This will trigger the useEffect that calls fetchSessionData
        router.push(`/flashcards?sessionId=${sId}`, undefined, { shallow: false });
        // No need to call fetchSessionData directly, useEffect will handle it
    };

    const pageTitle = `Flashcards${documentTitle && documentTitle !== "Document" ? ` - ${documentTitle}` : ''}`;

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
            </Head>
            <div className="container mx-auto px-4 py-8 flex flex-col items-center">
                <div className="w-full max-w-2xl">
                    {/* Header Section */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-blue-600">
                            Flashcards
                            {selectedSessionForFlashcards && documentTitle !== "Document" && (
                                <>: <span className="font-normal text-gray-700 break-all">{documentTitle}</span></>
                            )}
                        </h1>
                        {/* Link to go back to the specific document page if a session is active, otherwise to home */}
                        <Link href={selectedSessionForFlashcards ? `/?sessionId=${selectedSessionForFlashcards}` : "/"} legacyBehavior>
                            <a className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                                {selectedSessionForFlashcards ? "← Back to Document" : "← Home"}
                            </a>
                        </Link>
                    </div>

                    {isLoading && <LoadingSpinner message={loadingMessage} />}

                    {/* Conditional Rendering Logic */}
                    {!isLoading && !user && (
                        <p className="text-red-500 text-center p-10">Please sign in to view or generate flashcards.</p>
                    )}

                    {/* If user is logged in but no session is selected (e.g., came from sidebar direct link) */}
                    {!isLoading && user && !selectedSessionForFlashcards && sessionsList.length > 0 && (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold mb-4">Select a Study Session for Flashcards:</h2>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {sessionsList.map(session => (
                                    <button
                                        key={session._id}
                                        onClick={() => handleSessionSelectForFlashcards(session._id)}
                                        className="w-full max-w-md mx-auto bg-white hover:bg-blue-50 text-blue-700 font-medium py-3 px-4 border border-blue-200 rounded-lg shadow transition duration-150"
                                    >
                                        {session.fileName} (Created: {new Date(session.createdAt).toLocaleDateString()})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {!isLoading && user && !selectedSessionForFlashcards && sessionsList.length === 0 && (
                        <p className="text-gray-600 text-center p-10">
                            You have no study sessions. Please{' '}
                            <Link href="/" legacyBehavior>
                                <a className="text-blue-500 hover:underline">upload a document</a>
                            </Link>
                            {' '}first.
                        </p>
                    )}


                    {/* If a session IS selected and flashcards are ready or being generated */}
                    {!isLoading && user && selectedSessionForFlashcards && (
                        <>
                            {/* This covers case where text might exist but AI fails or returns no cards */}
                            {documentText && flashcards.length === 0 && !isLoading && (
                                 <p className="text-gray-600 text-center p-10">No flashcards currently available for this session. If generation failed, you can try again by reloading or re-selecting the session if applicable.</p>
                            )}

                            {flashcards.length > 0 && currentCard && (
                                <div className="flex flex-col items-center">
                                    {/* Flashcard Area */}
                                    <div
                                        className={`w-full h-80 sm:h-96 p-6 rounded-xl shadow-xl flex items-center justify-center text-center cursor-pointer transition-transform duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''} bg-white border border-gray-200`}
                                        onClick={() => setIsFlipped(!isFlipped)}
                                        style={{ perspective: '1000px' }}
                                        role="button" tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsFlipped(!isFlipped);}}
                                    >
                                        <div className={`absolute w-full h-full p-6 flex items-center justify-center backface-hidden ${!isFlipped ? 'z-10' : 'z-0'}`}>
                                            <p className="text-xl sm:text-2xl font-semibold text-gray-800">{currentCard.front}</p>
                                        </div>
                                        <div className={`absolute w-full h-full p-6 flex items-center justify-center backface-hidden rotate-y-180 ${isFlipped ? 'z-10' : 'z-0'} bg-blue-50`}>
                                            <p className="text-lg sm:text-xl text-gray-700 whitespace-pre-line">{currentCard.back}</p>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="mt-8 flex justify-between items-center w-full">
                                        <button
                                            onClick={handlePrevCard}
                                            disabled={currentCardIndex === 0}
                                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out"
                                        >
                                            ← Previous
                                        </button>
                                        <p className="text-gray-600 text-lg">
                                            {currentCardIndex + 1} / {flashcards.length}
                                        </p>
                                        <button
                                            onClick={handleNextCard}
                                            disabled={currentCardIndex === flashcards.length - 1}
                                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-4">Use Arrow Keys (←/→) to navigate, Space/Enter/↑/↓ to flip.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
                {modalMessage}
            </Modal>
            <style jsx>{`
                .preserve-3d { transform-style: preserve-3d; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
            `}</style>
        </>
    );
}