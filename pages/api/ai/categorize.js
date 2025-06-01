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

    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Text is required for categorization." });
    }

    const prompt = `Analyze the following text extracted from class notes and identify the main topics or chapters. Return these topics as a JSON array of strings. For example: ["Introduction to Topic A", "Key Concepts of Topic B", "Advanced Topic C"]. Only return the JSON array. Text:\n\n${text}`;
    const schema = { type: "ARRAY", items: { type: "STRING" } };

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
            responseSchema: schema,
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
            console.error("Gemini API Error (Categorize):", errorBody);
            throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody}`);
        }

        const result = await apiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const categories = JSON.parse(result.candidates[0].content.parts[0].text);
            return res.status(200).json({ categories });
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`);
        } else {
            console.error("Unexpected Gemini API response structure (Categorize):", result);
            throw new Error("AI response structure was unexpected or content is missing.");
        }
    } catch (error) {
        console.error("Error calling Gemini API (Categorize):", error);
        return res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
}