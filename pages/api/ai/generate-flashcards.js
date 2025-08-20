// pages/api/ai/generate-flashcards.js
export const maxDuration = 60; // Max duration for processing ONE CHUNK (adjust for your Vercel plan)
                               // For Hobby plan, this won't go beyond 10-15s effectively for sync functions.
                               // If you have a Pro plan, 60 or 120 might be feasible per chunk.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_TEXT = "gemini-1.5-flash";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY not configured on server.");
        return res.status(500).json({ error: "Gemini API key not configured on server." });
    }

    const { text } = req.body; // This 'text' will be a CHUNK from the client

    if (!text) {
        return res.status(400).json({ error: "Text chunk is required for flashcard generation." });
    }

    const wordCount = text.split(/\s+/).length;
    console.log(`[API] Received text chunk of approx ${wordCount} words for flashcard generation.`);

    // The prompt is good for a chunk – it will try to be comprehensive *for that chunk*
    const prompt = `
    You are an AI assistant specializing in creating concise and effective study flashcards from a given text.

    **Task:**
    Based on the "Text context" (which is a segment of a larger document) provided below, generate as many high-quality flashcards as needed to thoroughly cover all key concepts, definitions, important facts, and questions that can be answered from THIS SPECIFIC TEXT SEGMENT. Do not omit any significant information FROM THIS SEGMENT.

    **Flashcard Structure (per card):**
    Each flashcard must be a JSON object with the following fields:
    {
    "front": "string (This is the question, term, or prompt on the front of the card. Keep it concise.)",
    "back": "string (This is the answer, definition, or explanation on the back of the card. Be accurate and concise, directly supported by THIS TEXT SEGMENT.)"
    }

    **Strict Rules:**
    1.  **Text-Bound:** All information on both the "front" and "back" MUST be derived solely from the provided "Text context" (THIS SEGMENT). Do not introduce external knowledge or hallucinate.
    2.  **Conciseness:** Both "front" and "back" should be as brief as possible while conveying the essential information for effective recall from THIS SEGMENT.
    3.  **Key Information:** Focus on generating flashcards for the most important pieces of information, key terms, definitions, and core concepts within THIS SEGMENT.
    4.  **Question/Answer Format:** The "front" can be a question, and the "back" its answer. Or, the "front" can be a term/concept, and the "back" its definition/explanation.
    5.  **JSON Output Only:** Your entire response MUST be a single JSON array containing all flashcard objects generated from THIS SEGMENT. Do not include any introductory text or anything outside this JSON array.

    **Text context (Segment of a larger document):**
    ---
    ${text} 
    ---

    Generate the JSON array of flashcards for THIS SEGMENT now.
    `;

    const flashcardSchema = {
        type: "OBJECT",
        properties: {
            front: { type: "STRING", description: "The question or term on the front of the card." },
            back: { type: "STRING", description: "The answer or explanation on the back of the card." }
        },
        required: ["front", "back"]
    };
    const arraySchema = { type: "ARRAY", items: flashcardSchema };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_TEXT}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: arraySchema,
            // You might consider adding a temperature setting if needed, e.g., temperature: 0.7
        },
    };

    try {
        const startTime = Date.now();
        console.log(`[API] Calling Gemini for chunk (approx ${wordCount} words)...`);
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const duration = Date.now() - startTime;
        console.log(`[API] Gemini API call for chunk took ${duration}ms. Status: ${apiResponse.status}`);


        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("[API] Gemini API Error (Flashcards Chunk):", errorBody.substring(0, 500)); // Log part of error
            throw new Error(`API request failed with status ${apiResponse.status}. Response: ${errorBody.substring(0,100)}...`);
        }

        const result = await apiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const raw = result.candidates[0].content.parts[0].text;
            let flashcards;
            try {
                flashcards = JSON.parse(raw);
                console.log(`[API] Successfully parsed ${flashcards.length} flashcards from Gemini for chunk.`);
            } catch (e) {
                console.error("[API] Failed to parse Gemini response as JSON. Raw response snippet:", raw.substring(0, 500) + "...");
                throw new Error("AI did not return valid JSON for chunk. The response might have been cut off or malformed.");
            }
            return res.status(200).json({ flashcards });
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            console.error("[API] Gemini request blocked. Reason:", result.promptFeedback.blockReason, "Ratings:", result.promptFeedback.safetyRatings);
            throw new Error(`Request for chunk blocked by API: ${result.promptFeedback.blockReason}.`);
        } else {
            console.error("[API] Unexpected Gemini API response structure (Flashcards Chunk):", JSON.stringify(result, null, 2).substring(0, 500));
            throw new Error("AI response structure for chunk was unexpected or content is missing.");
        }
    } catch (error) {
        console.error("[API] Error in flashcard generation for chunk:", error.message);
        return res.status(500).json({ error: `Failed to get/process response from AI for chunk: ${error.message}` });
    }
}