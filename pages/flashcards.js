// pages/flashcards.js
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';

const WORDS_PER_CHUNK = 2000;

function splitTextIntoChunks(text, maxWordsPerChunk) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
    }
    console.log(`Document split into ${chunks.length} chunks of approx ${maxWordsPerChunk} words each.`);
    return chunks;
}

export default function FlashcardsPage() {
    const router = useRouter();
    const { sessionId } = router.query;

    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Verifying session...");
    const [documentText, setDocumentText] = useState(null);
    const [documentTitle, setDocumentTitle] = useState("Document");

    const [allFlashcards, setAllFlashcards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');

    const showModal = (title, message) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalOpen(true);
    };

    // Effect for user authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                showModal("Authentication Required", "Please sign in.");
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Effect for fetching session data once user and sessionId are available
    useEffect(() => {
        if (user && sessionId) {
            fetchSessionData(sessionId, user.uid);
        } else if (!sessionId && user) {
            showModal("Error", "No session ID. Please select a document.");
            setIsLoading(false);
        }
    }, [user, sessionId]);

    const fetchSessionData = async (sId, uid) => {
        setIsLoading(true);
        setLoadingMessage("Fetching document...");
        setAllFlashcards([]);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        try {
            const res = await fetch(`/api/sessions/${sId}`);
            if (!res.ok) throw new Error("Failed to fetch session.");
            const { success, data: session } = await res.json();
            if (!success || !session) throw new Error("Session data not found.");
            if (session.userId !== uid) {
                showModal("Access Denied", "This session isn't yours.");
                router.push('/'); return;
            }

            setDocumentText(session.pdfText);
            setDocumentTitle(session.fileName || "Document");

            if (session.flashcards && session.flashcards.length > 0) {
                console.log("Loading existing flashcards:", session.flashcards.length);
                setAllFlashcards(session.flashcards);
                setIsLoading(false);
            } else if (session.pdfText) {
                // Will trigger generation in useEffect below
            } else {
                showModal("Error", "Document text not found in session.");
                setIsLoading(false);
            }
        } catch (error) {
            showModal("Error", `Could not load document: ${error.message}`);
            setDocumentText(null);
            setIsLoading(false);
        }
    };

    const generateAllFlashcards = useCallback(async () => {
        if (!documentText || !sessionId || !user || isGenerating || allFlashcards.length > 0) {
            if (allFlashcards.length > 0 && !isGenerating) setIsLoading(false);
            return;
        }

        setIsGenerating(true);
        setIsLoading(true);
        setLoadingMessage("Preparing to generate flashcards...");

        const textChunks = splitTextIntoChunks(documentText, WORDS_PER_CHUNK);
        if (textChunks.length === 0) {
            showModal("Error", "Document text is empty or could not be chunked.");
            setIsLoading(false);
            setIsGenerating(false);
            return;
        }

        let collectedFlashcards = [];
        let anyChunkFailed = false;

        for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            setLoadingMessage(`Generating flashcards for section ${i + 1} of ${textChunks.length}...`);
            console.log(`[Client] Sending chunk ${i+1} to API...`);
            try {
                const res = await fetch('/api/ai/generate-flashcards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: chunk }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({ error: `Failed to generate flashcards for section ${i + 1}. Server responded with ${res.status}` }));
                    console.error(`Error for chunk ${i + 1}:`, errData.error);
                    showModal("Chunk Error", `Problem with section ${i + 1}: ${errData.error.substring(0,100)}... Some flashcards may be missing.`);
                    anyChunkFailed = true;
                } else {
                    const { flashcards: chunkFlashcards } = await res.json();
                    if (chunkFlashcards && chunkFlashcards.length > 0) {
                        collectedFlashcards = [...collectedFlashcards, ...chunkFlashcards];
                        setAllFlashcards(prev => [...prev, ...chunkFlashcards]);
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                    } else {
                        console.log(`No flashcards generated for chunk ${i+1}.`);
                    }
                }
            } catch (error) {
                console.error(`Network or critical error for chunk ${i + 1}:`, error);
                showModal("Generation Error", `Failed for section ${i + 1}: ${error.message}. Some flashcards may be missing.`);
                anyChunkFailed = true;
            }
            if (i < textChunks.length -1) await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (collectedFlashcards.length > 0) {
            setLoadingMessage("Saving all flashcards to session...");
            try {
                const saveRes = await fetch(`/api/sessions/${sessionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ flashcards: collectedFlashcards }),
                });
                if (!saveRes.ok) {
                    const saveErrData = await saveRes.json().catch(() => ({error: "Failed to save flashcards and parse error."}));
                    showModal("Save Error", `Flashcards generated, but failed to save to session: ${saveErrData.error}.`);
                } else {
                    console.log("All generated flashcards saved to session successfully.");
                    if (anyChunkFailed) {
                        showModal("Partial Success", "Some sections may have failed during flashcard generation. The generated cards have been saved.");
                    } else {
                        showModal("Success", "Flashcards generated and saved!");
                    }
                }
            } catch (saveError) {
                showModal("Save Error", `Flashcards generated, but failed to save: ${saveError.message}.`);
            }
        } else if (!anyChunkFailed) {
            showModal("No Flashcards", "AI could not generate any flashcards for this document.");
        }

        setIsLoading(false);
        setIsGenerating(false);
    }, [documentText, sessionId, user, isGenerating, allFlashcards.length]);

    // Effect for generating flashcards if documentText is loaded and no flashcards are set yet
    useEffect(() => {
        if (documentText && allFlashcards.length === 0 && !isLoading && user && !isGenerating) {
            generateAllFlashcards();
        }
    }, [documentText, allFlashcards.length, user, isLoading, isGenerating, generateAllFlashcards]);

    const handleNextCard = () => {
        if (currentCardIndex < allFlashcards.length - 1) {
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

    const currentCard = allFlashcards[currentCardIndex];

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (allFlashcards.length === 0 || !currentCard) return;
            if (event.key === 'ArrowRight') handleNextCard();
            else if (event.key === 'ArrowLeft') handlePrevCard();
            else if ([' ', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                setIsFlipped(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentCardIndex, allFlashcards, currentCard]);

    return (
        <>
            <Head>
                <title>Flashcards {documentTitle !== "Document" ? `- ${documentTitle}` : ''}</title>
            </Head>
            <div className="container mx-auto px-4 py-8 flex flex-col items-center">
                <div className="w-full max-w-2xl">
                    {/* Header Section */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-blue-600">
                            Flashcards: <span className="font-normal text-gray-700 break-all">{documentTitle}</span>
                        </h1>
                        {/* Link to go back to the specific document page if a session is active, otherwise to home */}
                        <Link href={sessionId ? `/?sessionId=${sessionId}` : "/"} legacyBehavior>
                            <a className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                                {sessionId ? "← Back to Document" : "← Home"}
                            </a>
                        </Link>
                    </div>

                    {isLoading && <LoadingSpinner message={loadingMessage} />}

                    {/* Conditional Rendering Logic */}
                    {!isLoading && !user && (
                        <p className="text-red-500 text-center p-10">Please sign in to view or generate flashcards.</p>
                    )}

                    {!isLoading && user && !sessionId && (
                        <p className="text-gray-600 text-center p-10">No document session specified. Please go back and select a document from the main page or "My Sessions".</p>
                    )}

                    {!isLoading && user && sessionId && !documentText && !isGenerating && (
                        <p className="text-red-600 text-center p-10">Could not load document text for this session.</p>
                    )}

                    {!isLoading && user && documentText && allFlashcards.length === 0 && !isGenerating && (
                        <p className="text-gray-600 text-center p-10">No flashcards currently available. AI might not have been able to generate any, or generation failed. You can try reloading the page if you suspect an issue.</p>
                    )}

                    {!isLoading && user && allFlashcards.length > 0 && currentCard && (
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
                                    {currentCardIndex + 1} / {allFlashcards.length}
                                </p>
                                <button
                                    onClick={handleNextCard}
                                    disabled={currentCardIndex === allFlashcards.length - 1}
                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out"
                                >
                                    Next →
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-4">Use Arrow Keys (←/→) to navigate, Space/Enter/↑/↓ to flip.</p>
                        </div>
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