const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_TEXT = "gemini-1.5-flash"; // Or your preferred model

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured on server." });
    }

    const { text, count = 10 } = req.body; // `count` for number of flashcards

    if (!text) {
        return res.status(400).json({ error: "Text is required for flashcard generation." });
    }

    // Prompt Engineering for Flashcards
    const prompt = `
    You are an AI assistant specializing in creating concise and effective study flashcards from a given text.

    **Task:**
    Based on the "Text context" provided below, generate as many flashcards as needed to thoroughly cover all key concepts, definitions, important facts, and questions that can be answered from the text. Do not omit any significant information.

    **Flashcard Structure (per card):**
    Each flashcard must be a JSON object with the following fields:
    {
    "front": "string (This is the question, term, or prompt on the front of the card. Keep it concise.)",
    "back": "string (This is the answer, definition, or explanation on the back of the card. Be accurate and concise, directly supported by the text.)"
    }

    **Strict Rules:**
    1.  **Text-Bound:** All information on both the "front" and "back" MUST be derived solely from the provided "Text context". Do not introduce external knowledge or hallucinate.
    2.  **Conciseness:** Both "front" and "back" should be as brief as possible while conveying the essential information for effective recall. Avoid lengthy paragraphs.
    3.  **Key Information:** Focus on generating flashcards for the most important pieces of information, key terms, definitions, and core concepts within the text.
    4.  **Question/Answer Format:** The "front" can be a question, and the "back" its answer. Or, the "front" can be a term/concept, and the "back" its definition/explanation.
    5.  **JSON Output Only:** Your entire response MUST be a single JSON array containing all flashcard objects. Do not include any introductory text or anything outside this JSON array.

    **Text context:**
    ---
    ${text}
    ---

    Generate the JSON array of flashcards now.
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
        },
    };

    try {
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error (Flashcards):", errorBody);
            throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody}`);
        }

        const result = await apiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const raw = result.candidates[0].content.parts[0].text;
            let flashcards;
            try {
                flashcards = JSON.parse(raw);
            } catch (e) {
                console.error("Failed to parse Gemini response as JSON:", raw);
                throw new Error("AI did not return valid JSON. Try again or adjust your prompt.");
            }
            return res.status(200).json({ flashcards });
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}. Details: ${JSON.stringify(result.promptFeedback.safetyRatings)}`);
        } else {
            console.error("Unexpected Gemini API response structure (Flashcards):", JSON.stringify(result, null, 2));
            throw new Error("AI response structure was unexpected or content is missing for flashcards.");
        }
    } catch (error) {
        console.error("Error calling Gemini API (Flashcards):", error.message);
        return res.status(500).json({ error: `Failed to get response from AI for flashcards: ${error.message}` });
    }
}