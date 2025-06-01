const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_TEXT = "gemini-1.5-flash";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured on server." });
    }

    const { text, category, difficulty, count = 3 } = req.body;

    if (!text || !category || !difficulty) {
        return res.status(400).json({ error: "Text, category, and difficulty are required." });
    }

    let difficultyPrompt = "";
    switch (difficulty) {
        case "easy": difficultyPrompt = "Easy"; break;
        case "medium": difficultyPrompt = "Medium"; break;
        case "hard": difficultyPrompt = "Hard"; break;
        case "ministerial": difficultyPrompt = "Mimicking the style and complexity of questions found in the Quebec Secondary 4 Ministry exam. (i.e. Very complex questions, make sure your questions are very complex, extremely hard and they can be analytical of the text you've been given)"; break;
        default: difficultyPrompt = "Medium"; // Default difficulty
    }

    const prompt = `Based on the provided text (YOU CAN ONLY USE INFORMATION IN THE TEXT DO NOT HALLUCINATE OR PROVIDE FALSE INFORMATION) and focusing on the category "${category}", generate ${count} multiple-choice questions of ${difficultyPrompt} difficulty (YOU ARE ALLOWED TO CREATE QUESTIONS TO WHICH THEIR ANSWER ARE NOT DIRECTLY IN THE GIVEN TEXT BUT THE USER NEEDS TO BE ABLE TO INFER THE ANSWER, DONT ASK THESE TYPES OF QUESETIONS 100% OF THE TIME). Each MCQ must be a JSON object with the following fields: "questionText" (string), "options" (array of 4 strings), "correctOptionIndex" (number from 0 to 3), and "explanation" (string, a brief explanation for why the correct answer is correct, based on the text). Return a JSON array containing these ${count} MCQ objects. Only return the JSON array.  Text context: --- ${text} --- Category: ${category} Difficulty: ${difficultyPrompt}`;
    
    const mcqSchema = {
        type: "OBJECT",
        properties: {
            questionText: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" }, minItems: 4, maxItems: 4 },
            correctOptionIndex: { type: "INTEGER", minimum: 0, maximum: 3 },
            explanation: { type: "STRING" }
        },
        required: ["questionText", "options", "correctOptionIndex", "explanation"]
    };
    const arraySchema = { type: "ARRAY", items: mcqSchema };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_TEXT}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [ /* ... same safety settings as categorize ... */ ],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: arraySchema,
        },
    };
     // Add safety settings for consistency
    payload.safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ];


    try {
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error (MCQ):", errorBody);
            throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody}`);
        }

        const result = await apiResponse.json();
        
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const mcqs = JSON.parse(result.candidates[0].content.parts[0].text);
            return res.status(200).json({ mcqs });
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`);
        } else {
            console.error("Unexpected Gemini API response structure (MCQ):", result);
            throw new Error("AI response structure was unexpected or content is missing.");
        }
    } catch (error) {
        console.error("Error calling Gemini API (MCQ):", error);
        return res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
}