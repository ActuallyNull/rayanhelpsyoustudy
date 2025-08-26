// pages/study.js
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';
import { useRouter } from 'next/router';
import JSZip from 'jszip';

// For PDF.js
let pdfjsLib = null; // Renaming to avoid confusion with the module object
let pdfjsWorker = null;

if (typeof window !== 'undefined') {
  // Attempt to import the main PDF.js library
  import('pdfjs-dist/build/pdf.js') // <--- VERIFY THIS PATH EXISTS IN YOUR node_modules/pdfjs-dist/
    .then(module => {
      pdfjsLib = module; // The entire module, getDocument should be on this
      console.log('PDF.js library loaded successfully:', pdfjsLib);

      // Set up the worker.
      // The `pdf.worker.entry.js` is often for when you want Webpack to bundle the worker.
      // If you rely on a CDN, you can directly set workerSrc.
      if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
        // Make sure to use the version from the loaded library if available
        const version = pdfjsLib.version || '2.6.347'; // Fallback to your installed version
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
        console.log(`PDF.js workerSrc set to CDN: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
      } else {
        console.warn('pdfjsLib.GlobalWorkerOptions not available after library load.');
      }
    })
    .catch(error => {
      console.error("Failed to load 'pdfjs-dist/build/pdf.js'. Error:", error);
      // You could try a fallback import here if necessary, e.g., 'pdfjs-dist/legacy/build/pdf.js'
      // or just 'pdfjs-dist' if the package.json main points correctly.
      // For now, let's focus on getting the primary path working.
    });
}

// Function to extract text from PPTX
async function extractTextFromPptx(file) {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  let fullText = "";

  // Regex to find text nodes in slide XML: <a:t>TEXT_HERE</a:t>
  // This is a simplified approach and might need refinement for complex PPTX files
  // (e.g., text in shapes, tables, SmartArt, notes pages)
  const textNodeRegex = /<a:t.*?>(.*?)<\/a:t>/g;
  const notesTextNodeRegex = /<p:txBody>.*?<a:t.*?>(.*?)<\/a:t>.*?<\/p:txBody>/gs; // More specific for notes

  const slidePromises = [];
  const notesPromises = [];

  // Iterate over slide files (e.g., ppt/slides/slide1.xml, slide2.xml, etc.)
  for (const filePath in content.files) {
    if (filePath.startsWith("ppt/slides/slide") && filePath.endsWith(".xml")) {
      slidePromises.push(content.files[filePath].async("string"));
    }
    if (filePath.startsWith("ppt/notesSlides/notesSlide") && filePath.endsWith(".xml")) {
        notesPromises.push(content.files[filePath].async("string"));
    }
  }

  const slideContents = await Promise.all(slidePromises);
  slideContents.forEach(slideXml => {
    let match;
    while ((match = textNodeRegex.exec(slideXml)) !== null) {
      // Basic unescaping for common XML entities, can be expanded
      const textContent = match[1]
                            .replace(/</g, '<')
                            .replace(/>/g, '>')
                            .replace(/&/g, '&')
                            .replace(/"/g, '"')
                            .replace(/'/g, "'");
      fullText += textContent + " ";
    }
    fullText += "\n"; // Add a newline after each slide's text
  });

  const notesContents = await Promise.all(notesPromises);
  if (notesContents.length > 0) {
    fullText += "\n--- Speaker Notes ---\n";
    notesContents.forEach(notesXml => {
        let match;
        // A more robust way to get all text within txBody for notes
        const txBodyRegex = /<p:txBody>(.*?)<\/p:txBody>/gs;
        while((match = txBodyRegex.exec(notesXml)) !== null) {
            let textContent = "";
            let innerMatch;
            while((innerMatch = textNodeRegex.exec(match[1])) !== null) {
                textContent += innerMatch[1] + " ";
            }
            if (textContent.trim()) {
                 fullText += textContent.trim()
                                .replace(/</g, '<')
                                .replace(/>/g, '>')
                                .replace(/&/g, '&')
                                .replace(/"/g, '"')
                                .replace(/'/g, "'") + "\n";
            }
        }
    });
  }

  return fullText.trim();
}

export default function StudyPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);

  const [currentStep, setCurrentStep] = useState('upload'); // 'upload', 'category', 'mcq'
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);
  const [currentPdfText, setCurrentPdfText] = useState(null);
  const [extractedCategories, setExtractedCategories] = useState([]);
  const [currentSelectedCategory, setCurrentSelectedCategory] = useState(null);

  // State for current MCQ display
  const [currentMcq, setCurrentMcq] = useState(null); // Holds the current MCQ object
  const [currentMcqBatch, setCurrentMcqBatch] = useState([]); // Holds the fetched batch
  const [currentMcqIndex, setCurrentMcqIndex] = useState(-1); // Index within the batch

  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null); // To style the user's choice
  const [feedbackText, setFeedbackText] = useState('');
  const [explanationText, setExplanationText] = useState('');
  const [questionsAnsweredInCategory, setQuestionsAnsweredInCategory] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setUserId(currentUser ? currentUser.uid : null);
      if (currentUser && router.query.sessionId && !currentSessionId) { // Prevent re-loading if already loaded
        loadSession(router.query.sessionId, currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [router.query.sessionId, currentSessionId]); // Add currentSessionId to dependencies

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const getSetLastDifficulty = (newDifficulty) => {
    if (typeof window !== 'undefined') {
        let lastDifficulty = localStorage.getItem('lastDifficulty');
        if (newDifficulty) {
            localStorage.setItem('lastDifficulty', newDifficulty);
            lastDifficulty = newDifficulty;
        } else if (!lastDifficulty) {
            lastDifficulty = "medium";
        }
        return lastDifficulty;
    }
    return "medium";
  };

  const loadSession = async (sessionId, uid) => {
    if (!sessionId || !uid) return;
    setIsLoading(true);
    setLoadingMessage("Loading session...");
    try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Session not found or error fetching.");
        const {success, data: session} = await res.json();

        if (!success || !session) throw new Error("Failed to load session data.");

        if (session.userId !== uid) {
            showModal("Access Denied", "This session does not belong to you.");
            router.push('/');
            return;
        }
        // Assuming session.pdfText now stores generic file text
        setCurrentPdfText(session.pdfText); // Use setCurrentPdfText (or rename to setCurrentFileText)
        
        let sessionCategories = session.categories || [];
        if (!sessionCategories.includes("All")) {
            sessionCategories = ["All", ...sessionCategories];
        }
        setExtractedCategories(sessionCategories);
        setCurrentSessionId(session._id);
        setFileName(session.fileName);
        if (session.lastDifficulty) getSetLastDifficulty(session.lastDifficulty);

        setCurrentStep('category');
    } catch (error) {
        console.error("Failed to load session:", error);
        showModal("Session Error", `Could not load session: ${error.message}`);
        router.push('/');
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    if (!userId) {
      showModal("Login Required", "Please sign in to upload files.");
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    let extractedText = "";
    let fileTypeForAI = "document"; // Generic term for AI prompt

    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setLoadingMessage(`Extracting text from PDF: ${file.name}...`);
        if (!pdfjsLib || !pdfjsLib.getDocument) {
            showModal("PDF Library Error", "PDF.js library is not ready. Please wait and try again.");
            setIsLoading(false); return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          extractedText += textContent.items.map(item => item.str).join(" ") + "\n";
        }
        fileTypeForAI = "PDF document";
      } else if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.name.toLowerCase().endsWith(".pptx")) {
        setLoadingMessage(`Extracting text from PowerPoint: ${file.name}...`);
        extractedText = await extractTextFromPptx(file);
        fileTypeForAI = "PowerPoint presentation";
      } else {
        showModal("Unsupported File Type", "Please upload a PDF (.pdf) or PowerPoint (.pptx) file.");
        setIsLoading(false); return;
      }

      setCurrentPdfText(extractedText); // Use this state for the extracted text, regardless of source

      if (!extractedText || extractedText.trim().length < 20) { // Lowered threshold a bit for PPTX
        showModal("Extraction Error", `Could not extract sufficient text from the ${fileTypeForAI}. It might be image-based or have minimal text content.`);
        setIsLoading(false); return;
      }

      setLoadingMessage(`Identifying categories from ${fileTypeForAI}...`);
      const catResponse = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText }),
      });
      let categoriesFromServer = [];
      if (catResponse.ok) {
        const catData = await catResponse.json();
        categoriesFromServer = catData.categories || [];
      } else {
        console.warn("AI categorization failed or returned no categories. Defaulting to 'All'.");
      }

      const finalCategories = ["All", ...categoriesFromServer];
      setExtractedCategories(finalCategories);

      // --- NEW: Generate flashcards right after categorization ---
      setLoadingMessage("Generating flashcards...");
      let flashcards = [];
      try {
        const flashRes = await fetch('/api/ai/generate-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: extractedText, count: 15 }),
        });
        if (flashRes.ok) {
          const { flashcards: generated } = await flashRes.json();
          if (Array.isArray(generated)) flashcards = generated;
        } else {
          const err = await flashRes.json().catch(() => ({}));
          console.warn("Flashcard generation failed:", err.error || "Unknown error");
        }
      } catch (err) {
        console.warn("Flashcard generation error:", err);
      }
      // --- END NEW ---

      setLoadingMessage("Saving session...");
      const sessionData = {
        userId,
        fileName: file.name,
        pdfText: extractedText,
        categories: finalCategories,
        lastDifficulty: getSetLastDifficulty(),
        flashcards, // <-- Save flashcards in the session!
      };
      const saveRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
      if (!saveRes.ok) throw new Error('Failed to save session.');
      const {data: savedSession} = await saveRes.json();
      setCurrentSessionId(savedSession._id);

      setCurrentStep('category');

    } catch (error) {
      console.error("Error during upload and processing:", error);
      showModal("Processing Error", `An error occurred: ${error.message}`);
      setCurrentStep('upload');
    } finally {
      setIsLoading(false);
      if(fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleSelectCategory = (category) => {
    console.log("Category selected:", category);
    setCurrentSelectedCategory(category);
    setQuestionsAnsweredInCategory(0);
    setCurrentMcq(null); // Clear any previous MCQ
    setCurrentMcqBatch([]);
    setCurrentMcqIndex(-1);
    setIsAnswered(false);
    setSelectedAnswerIndex(null);
    setFeedbackText('');
    setExplanationText('');
    setCurrentStep('mcq');
    // User will click a difficulty button to fetch MCQs
  };

  const fetchAndDisplayMcqs = async (difficulty) => {
    console.log("Fetching MCQs for category:", currentSelectedCategory, "difficulty:", difficulty);
    if (!currentPdfText || !currentSelectedCategory) {
      showModal("Error", "Missing extracted text or category selection.");
      setCurrentStep('category'); // Sensible fallback
      return;
    }
    setIsLoading(true);
    setLoadingMessage(`Fetching questions for "${currentSelectedCategory}" (${difficulty})...`);
    setIsAnswered(false);
    setSelectedAnswerIndex(null);
    setCurrentMcq(null); // Clear current MCQ while loading

    const categoryForPrompt = currentSelectedCategory === "All" ? "the entire document" : currentSelectedCategory;
    const requestBody = {
        text: currentPdfText,
        // If "All" is selected, tell the AI to use the whole document context.
        // Otherwise, use the specific category.
        category: categoryForPrompt,
        difficulty,
        count: 3
    };

    console.log("Requesting MCQs with body:", requestBody); // For debugging

    try {
      const mcqResponse = await fetch('/api/ai/generate-mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody), // Use the modified requestBody
      });

      if (!mcqResponse.ok) {
        const errData = await mcqResponse.json().catch(() => ({ error: 'Failed to generate MCQs and parse error response.' }));
        throw new Error(errData.error || 'Failed to generate MCQs.');
      }
      const { mcqs } = await mcqResponse.json();

      if (mcqs && mcqs.length > 0) {
        console.log("Fetched MCQs:", mcqs);
        setCurrentMcqBatch(mcqs);
        setCurrentMcqIndex(0);
        setCurrentMcq(mcqs[0]); // Set the first MCQ from the new batch
      } else {
        console.log("No MCQs returned from API.");
        setCurrentMcqBatch([]);
        setCurrentMcqIndex(-1);
        setCurrentMcq(null);
        showModal("No More Questions", "AI couldn't generate new questions for this category/difficulty. Try another option or category.");
      }
    } catch (error) {
      console.error("Error fetching MCQs:", error);
      showModal("AI Error", `Failed to get MCQs: ${error.message}`);
      setCurrentMcq(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (selectedIndex) => {
    if (isAnswered || !currentMcq) return;

    setIsAnswered(true);
    setSelectedAnswerIndex(selectedIndex);

    if (selectedIndex === currentMcq.correctOptionIndex) {
      setFeedbackText("Correct!");
    } else {
      setFeedbackText("Incorrect!");
    }
    setExplanationText(`Explanation: ${currentMcq.explanation}`);
    setQuestionsAnsweredInCategory(prev => prev + 1);
  };

  const handleNextQuestion = () => {
    if (!isAnswered && currentMcqIndex >= 0 && currentMcqBatch.length > 0) {
        showModal("Answer Required", "Please select an answer first.");
        return;
    }

    const nextIndex = currentMcqIndex + 1;
    if (nextIndex >= currentMcqBatch.length) {
      console.log("End of batch, fetching more.");
      const currentDifficulty = getSetLastDifficulty();
      fetchAndDisplayMcqs(currentDifficulty);
    } else {
      console.log("Displaying next MCQ from batch, index:", nextIndex);
      setCurrentMcqIndex(nextIndex);
      setCurrentMcq(currentMcqBatch[nextIndex]);
      // Reset for the new question
      setIsAnswered(false);
      setSelectedAnswerIndex(null);
      setFeedbackText('');
      setExplanationText('');
    }
  };

  console.log("Rendering page. Current step:", currentStep, "isLoading:", isLoading, "currentMcq:", currentMcq);

  return (
    <>
      <Head>
        <title>Study Dashboard - Rayan Helps You Study</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-xl min-h-[60vh]"> {/* min-h for consistent size */}
          {isLoading && <LoadingSpinner message={loadingMessage} />}

          {/* Upload Step */}
          {!isLoading && currentStep === 'upload' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">Upload Your Notes (PDF or PPTX)</h2>
              <input
                type="file"
                accept=".pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
              />
              {fileName && <p className="mt-3 text-sm text-gray-600">Selected: {fileName}</p>}
            </div>
          )}

          {/* Category Step */}
          {!isLoading && currentStep === 'category' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">Select a Category</h2>
              {extractedCategories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {extractedCategories.map(cat => (
                    <button key={cat} onClick={() => handleSelectCategory(cat)}
                      className="w-full bg-white hover:bg-blue-50 text-blue-700 font-semibold py-3 px-4 border border-blue-200 rounded-lg shadow transition duration-150 ease-in-out text-left">
                      {cat}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No categories identified. Please try a different file or check the console for errors during processing.</p>
              )}
              <button onClick={() => {
                setCurrentStep('upload');
                setFileName('');
                setCurrentPdfText(null);
                setExtractedCategories([]);
                setCurrentSessionId(null);
                setCurrentMcq(null);
                setCurrentMcqBatch([]);
                setCurrentMcqIndex(-1);
                setQuestionsAnsweredInCategory(0);
                setIsAnswered(false);
                setFeedbackText('');
                setExplanationText('');
              }} className="mt-6 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">
                Upload New File
              </button>

              {/* --- FLASHCARDS BUTTON IN CATEGORY STEP (Stays Here) --- */}
              {currentSessionId && currentPdfText && (
                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                  <Link href={`/flashcards?sessionId=${currentSessionId}`} legacyBehavior>
                    <a className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-150 ease-in-out">
                      🧠 Generate Flashcards for This Document
                    </a>
                  </Link>
                </div>
              )}
              {/* --- END FLASHCARDS BUTTON IN CATEGORY STEP --- */}
            </div>
          )}

          {/* MCQ Step */}
          {!isLoading && currentStep === 'mcq' && (
              <div id="mcq-step">
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-semibold text-gray-700">
                          MCQs: {currentSelectedCategory || "No Category Selected"}
                      </h2>
                      <button onClick={() => {
                          setCurrentMcq(null);
                          setCurrentMcqBatch([]);
                          setCurrentMcqIndex(-1);
                          setIsAnswered(false);
                          setSelectedAnswerIndex(null);
                          setFeedbackText('');
                          setExplanationText('');
                          setQuestionsAnsweredInCategory(0);
                          setCurrentStep('category');
                      }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm">
                          Change Category
                      </button>
                  </div>

                  <div className="flex space-x-2 mt-4 mb-6 justify-center">
                      {["easy", "medium", "hard", "ministerial"].map(diff => (
                          <button
                              key={diff}
                              onClick={() => {
                                  getSetLastDifficulty(diff);
                                  fetchAndDisplayMcqs(diff);
                              }}
                              className={`font-medium py-2 px-4 rounded-lg shadow-sm transition-colors
                                  ${getSetLastDifficulty() === diff
                                      ? (diff === "easy" ? "bg-green-500 text-white" :
                                        diff === "medium" ? "bg-yellow-500 text-white" :
                                        diff === "hard" ? "bg-red-500 text-white" :
                                        "bg-purple-500 text-white")
                                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                  }
                              `}
                          >
                              {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </button>
                      ))}
                  </div>

                  {currentMcq && (
                      <div id="mcq-content" className="p-6 bg-gray-50 rounded-lg shadow">
                          <p className="text-lg font-medium text-gray-800 mb-6">{currentMcq.questionText}</p>
                          <div className="space-y-3 mb-6">
                              {currentMcq.options.map((option, index) => (
                                  <button
                                      key={index}
                                      onClick={() => handleAnswer(index)}
                                      disabled={isAnswered}
                                      className={`w-full option-button text-left py-3 px-4 border rounded-lg shadow-sm transition-all
                                          ${isAnswered ?
                                              (index === currentMcq.correctOptionIndex ? 'bg-green-500 !text-white border-green-600' : 
                                              (index === selectedAnswerIndex ? 'bg-red-500 !text-white border-red-600' : 
                                              'bg-gray-100 text-gray-800 border-gray-300')) 
                                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
                                          }
                                          ${isAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}
                                      `}
                                  >
                                      {option}
                                  </button>
                              ))}
                          </div>
                          <div className="mb-4 min-h-[2.5em]">
                              <p className={`text-md font-medium ${feedbackText === "Correct!" ? "text-green-600" : "text-red-600"}`}>{feedbackText}</p>
                              {explanationText && <p className="text-sm text-gray-600 mt-1">{explanationText}</p>}
                          </div>
                          <button
                              onClick={handleNextQuestion}
                              disabled={!isAnswered && currentMcqIndex >=0 && currentMcqBatch.length > 0}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-150 ease-in-out disabled:opacity-50"
                          >
                              Next Question
                          </button>
                      </div>
                  )}
                  {!isLoading && currentStep === 'mcq' && !currentMcq && (
                      <p className="text-center text-gray-500 mt-10">
                          Please select a difficulty level above to generate questions for "{currentSelectedCategory || 'the selected category'}".
                      </p>
                  )}

                  {currentStep === 'mcq' && ( 
                      <p className="text-sm text-gray-500 mt-4 text-center">
                          Questions answered in this category: {questionsAnsweredInCategory}
                      </p>
                  )}
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
