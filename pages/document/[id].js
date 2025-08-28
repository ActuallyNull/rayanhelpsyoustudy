// pages/document/[id].js
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';

// Import MDXEditor and its plugins
import {
  MDXEditor,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  linkPlugin,
  UndoRedo,
  codeBlockPlugin,
  tablePlugin,
  quotePlugin,
  InsertTable,
  CodeToggle,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

// NEW IMPORTS for CodeMirror languages
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { css } from '@codemirror/lang-css'; // Assuming you have installed this

export default function DocumentDetailPage() {
  const router = useRouter();
  const { id } = router.query; // Get the document ID from the URL

  const [user, setUser] = useState(null);
  const [mediaJob, setMediaJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeContent, setActiveContent] = useState('notes'); // 'notes', 'mcqs', 'flashcards'
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  // New state for Flashcard display
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && id) {
        fetchMediaJob(currentUser.uid, id);
      } else if (!currentUser) {
        setIsLoading(false);
        setMediaJob(null);
      }
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    // Initialize editedNotes when mediaJob or activeContent changes to 'notes'
    if (mediaJob && activeContent === 'notes' && mediaJob.generatedContent?.notes) {
      setEditedNotes(mediaJob.generatedContent.notes);
    }
    // Reset flashcard state when switching tabs
    if (activeContent !== 'flashcards') {
      setCurrentFlashcardIndex(0);
      setIsFlashcardFlipped(false);
    }
  }, [mediaJob, activeContent]);

  const fetchMediaJob = async (userId, jobId) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/media-job/${jobId}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch document details');
      const { success, data } = await res.json();
      if (success) {
        setMediaJob(data);
        // Set default active content based on what's available
        if (data.generatedContent?.notes) setActiveContent('notes');
        else if (data.generatedContent?.mcqs?.length > 0) setActiveContent('mcqs');
        else if (data.generatedContent?.flashcards?.length > 0) setActiveContent('flashcards');
        else setActiveContent('notes'); // Fallback if no content
      } else {
        throw new Error(data.error || 'Unknown error fetching document details');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsLoading(true); // Keep global loading spinner active during save
    setError(null);
    try {
      const res = await fetch(`/api/media-job/${mediaJob._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid, notes: editedNotes }),
      });

      if (!res.ok) throw new Error('Failed to save notes');
      const { success, data } = await res.json();
      if (success) {
        setMediaJob(data); // Update the mediaJob state with the new notes
        setIsEditingNotes(false); // Exit edit mode
        // Optionally, show a success message
      } else {
        throw new Error(data.error || 'Unknown error saving notes');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      // Optionally, show an error message
    } finally {
      setIsLoading(false); // Hide global loading spinner
    }
  };

  const handleCancelEdit = () => {
    setEditedNotes(mediaJob.generatedContent.notes); // Revert to original notes
    setIsEditingNotes(false); // Exit edit mode
  };

  // Flashcard Navigation Handlers
  const handleNextFlashcard = useCallback(() => {
    if (mediaJob?.generatedContent?.flashcards && currentFlashcardIndex < mediaJob.generatedContent.flashcards.length - 1) {
      setCurrentFlashcardIndex(prev => prev + 1);
      setIsFlashcardFlipped(false);
    }
  }, [currentFlashcardIndex, mediaJob]);

  const handlePrevFlashcard = useCallback(() => {
    if (currentFlashcardIndex > 0) {
      setCurrentFlashcardIndex(prev => prev - 1);
      setIsFlashcardFlipped(false);
    }
  }, [currentFlashcardIndex]);

  // Keyboard navigation for flashcards, only when 'flashcards' tab is active
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (activeContent !== 'flashcards' || !mediaJob?.generatedContent?.flashcards || mediaJob.generatedContent.flashcards.length === 0) return;

      if (event.key === 'ArrowRight') handleNextFlashcard();
      else if (event.key === 'ArrowLeft') handlePrevFlashcard();
      else if ([' ', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        setIsFlashcardFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContent, mediaJob, handleNextFlashcard, handlePrevFlashcard]); // Added dependencies

  const renderContent = () => {
    if (!mediaJob || !mediaJob.generatedContent) {
      return <p className="text-gray-600">No AI-generated content available for this document.</p>;
    }

    const { notes, mcqs, flashcards } = mediaJob.generatedContent;

    switch (activeContent) {
      case 'notes':
        return (
          <div>
            {isEditingNotes ? (
              <div>
                <MDXEditor
                  markdown={editedNotes}
                  onChange={setEditedNotes}
                  contentEditableClassName="prose"
                  plugins={[
                    toolbarPlugin({
                      toolbarContents: () => (
                        <>
                          {' '}
                          <UndoRedo />
                          <BlockTypeSelect />
                          <BoldItalicUnderlineToggles />
                          <CreateLink />
                          <CodeToggle />
                          <InsertTable />
                        </>
                      ),
                    }),
                    headingsPlugin(),
                    listsPlugin(),
                    linkPlugin(),
                    codeBlockPlugin(),
                    tablePlugin(),
                    quotePlugin(),
                  ]}
                  className="light:bg-gray-800 light:text-gray-100"
                />
                <div className="mt-4 space-x-2">
                  <button
                    onClick={handleSaveNotes}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    Save Notes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {notes ? (
                  <div className="prose lg:prose-lg max-w-none">
                    <ReactMarkdown>{notes}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-600">No AI-generated notes available for this document.</p>
                )}
                {/* Edit Notes button moved to top utility bar */}
              </div>
            )}
          </div>
        );
      case 'mcqs':
        return mcqs && mcqs.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Multiple Choice Questions</h2>
            {mcqs.map((mcq, index) => (
              <div key={index} className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <p className="font-semibold text-lg mb-3 leading-relaxed">{index + 1}. {mcq.questionText}</p>
                <div className="space-y-2 mb-4">
                  {mcq.options.map((option, optIndex) => (
                    <p
                      key={optIndex}
                      className={`p-3 rounded-md text-base ${
                        optIndex === mcq.correctOptionIndex
                          ? 'bg-green-100 text-green-800 font-medium border border-green-300'
                          : 'bg-white text-gray-700 border border-gray-200'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + optIndex)}.</span> {option}
                    </p>
                  ))}
                </div>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Explanation:</span> {mcq.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No AI-generated multiple-choice questions available for this document.</p>
        );
      case 'flashcards':
        const currentCard = flashcards?.[currentFlashcardIndex];
        return flashcards && flashcards.length > 0 && currentCard ? (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Interactive Flashcards</h2>
            {/* Flashcard Area */}
            <div
              className={`w-full max-w-xl h-80 sm:h-96 p-6 rounded-xl shadow-xl flex items-center justify-center text-center cursor-pointer transition-transform duration-500 preserve-3d ${isFlashcardFlipped ? 'rotate-y-180' : ''} bg-white border border-gray-200`}
              onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
              style={{ perspective: '1000px' }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsFlashcardFlipped(!isFlashcardFlipped);}}
            >
              <div className={`absolute w-full h-full p-6 flex items-center justify-center backface-hidden ${!isFlashcardFlipped ? 'z-10' : 'z-0'}`}>
                <p className="text-xl sm:text-2xl font-semibold text-gray-800">{currentCard.front}</p>
              </div>
              <div className={`absolute w-full h-full p-6 flex items-center justify-center backface-hidden rotate-y-180 ${isFlashcardFlipped ? 'z-10' : 'z-0'} bg-blue-50`}>
                <p className="text-lg sm:text-xl text-gray-700 whitespace-pre-line">{currentCard.back}</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-8 flex justify-between items-center w-full max-w-xl">
              <button
                onClick={handlePrevFlashcard}
                disabled={currentFlashcardIndex === 0}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out"
              >
                ← Previous
              </button>
              <p className="text-gray-600 text-lg">
                {currentFlashcardIndex + 1} / {flashcards.length}
              </p>
              <button
                onClick={handleNextFlashcard}
                disabled={currentFlashcardIndex === flashcards.length - 1}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out"
              >
                Next →
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-4">Use Arrow Keys (←/→) to navigate, Space/Enter/↑/↓ to flip.</p>
          </div>
        ) : (
          <p className="text-gray-600">No AI-generated flashcards available for this document.</p>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading document content..." />;
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-600">⚠️ Please sign in to view this document.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">❌ Failed to load document: {error}</p>
        <Link href="/dashboard" legacyBehavior>
          <a className="text-blue-500 hover:underline">Go back to Dashboard</a>
        </Link>
      </div>
    );
  }

  if (!mediaJob) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Document not found or you don't have access.</p>
        <Link href="/dashboard" legacyBehavior>
          <a className="text-blue-500 hover:underline">Go back to Dashboard</a>
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{mediaJob.fileName || mediaJob.identifier} - Details</title>
      </Head>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{mediaJob.fileName || mediaJob.identifier}</h1>
          <Link href="/dashboard" legacyBehavior>
            <a className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              ← Back to Documents
            </a>
          </Link>
        </div>

        {/* Utility Bar */}
        <div className="flex space-x-4 mb-6 border-b pb-4">
          <button
            onClick={() => {
              setActiveContent('notes');
              setIsEditingNotes(false); // Ensure we exit edit mode when switching content
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeContent === 'notes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            📝 Notes
          </button>
          {activeContent === 'notes' && !isEditingNotes && mediaJob?.generatedContent?.notes && (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600 text-white"
            >
              ✏️ Edit Notes
            </button>
          )}
          <button
            onClick={() => {
              setActiveContent('mcqs');
              setIsEditingNotes(false); // Ensure we exit edit mode when switching content
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeContent === 'mcqs' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            ❓ MCQs
          </button>
          <button
            onClick={() => {
              setActiveContent('flashcards');
              setIsEditingNotes(false); // Ensure we exit edit mode when switching content
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeContent === 'flashcards' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            🧠 Flashcards
          </button>
        </div>

        {/* Content Display Area */}
        <div className="bg-white shadow-md rounded-lg p-6">
          {renderContent()}
        </div>
      </div>
      <style jsx>{`
        .preserve-3d { transform-style: preserve-3d; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      `}</style>
    </>
  );
}