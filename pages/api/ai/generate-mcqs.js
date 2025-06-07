const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_TEXT = "gemini-2.0-flash";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured on server." });
    }

    const { text, category, difficulty, count = 10 } = req.body;

    if (!text || !category || !difficulty) {
        return res.status(400).json({ error: "Text, category, and difficulty are required." });
    }

    const focusInstruction = (category && category.toLowerCase() !== "the entire document" && category.toLowerCase() !== "all")
        ? `focusing on the category "${category}"`
        : `based on the entire document provided`;

    let detailedDifficultyInstruction = "";
    switch (difficulty.toLowerCase()) {
        case "easy":
            detailedDifficultyInstruction = "The questions should test basic recall and understanding of key facts or definitions directly stated in the text. Options should be clearly distinct.";
            break;
        case "medium":
            detailedDifficultyInstruction = "The questions should require some interpretation or application of information from the text. Distractors can be more similar to the correct answer, testing closer understanding. Some questions may require connecting two closely related pieces of information from the text.";
            break;
        case "hard":
            detailedDifficultyInstruction = `
The questions must be challenging and require significant analytical or inferential skills. They should go beyond simple recall. Consider these types:
1.  **Inference:** The answer is not explicitly stated but can be logically deduced from the text.
2.  **Analysis:** Require breaking down information or identifying relationships between different parts of the text.
3.  **Synthesis:** Might require combining information from different sentences or paragraphs to arrive at the correct answer.
4.  **Evaluation:** (Use sparingly) Ask to judge the validity or significance of a statement based on the text.
Distractors must be highly plausible and common misconceptions related to the text. Avoid trick questions, but ensure the user must think critically. Some questions may require careful distinction between similar concepts presented in the text.
`;
            break;
        case "ministerial":
            detailedDifficultyInstruction = `
The questions must mimic the style and complexity of questions found in a rigorous secondary school Ministry exam (e.g., Quebec Secondary 4). This means:
1.  **High Complexity:** Questions often involve multiple steps of reasoning or integrating information from various parts of the text.
2.  **Analytical Focus:** Emphasize questions that require deep analysis, comparison, contrast, or evaluation of the provided text.
3.  **Nuance and Subtlety:** Answers and distractors may be nuanced, requiring careful reading and understanding of subtle distinctions.
4.  **Application of Concepts:** Questions may require applying concepts learned from the text to new (but related) scenarios, if such scenarios can be strictly derived from the text's information.
Distractors must be very strong, reflecting common errors or sophisticated misunderstandings. The correct answer should be unambiguously supported by the text, even if it requires deep inference.
`;
            break;
        default:
            detailedDifficultyInstruction = "The questions should be of moderate difficulty, requiring some interpretation of the text.";
    }

    const prompt = `
You are an expert AI assistant tasked with creating high-quality educational multiple-choice questions (MCQs) based on provided text. Your goal is to generate questions that an experienced teacher would create to effectively assess understanding.

**Strict Rules & Guidelines:**
1.  **Text-Bound Accuracy:** YOU MUST ONLY use information explicitly present or directly and unambiguously inferable from the provided "Text context". DO NOT introduce external knowledge, hallucinate facts, or provide information not supported by the text.
2.  **Correctness of Answer and Index:** The "correctOptionIndex" MUST accurately point to the correct answer within the "options" array. The "explanation" MUST clearly justify why that option is correct, referencing the provided text. Double-check this.
3.  **Plausible Distractors:** All incorrect options (distractors) must be plausible and relevant to the text's content, ideally targeting common misunderstandings. Avoid obviously wrong or silly distractors.
4.  **Question Clarity:** Questions must be clear, unambiguous, and grammatically correct.
5.  **Avoid Trivial Questions:** Even for 'easy' difficulty, avoid questions that are trivially simple or based on insignificant details unless those details are explicitly highlighted as key.
6.  **JSON Output Only:** Your entire response MUST be a single JSON array containing ${count} MCQ objects. Do not include any introductory text, explanations, or any other text outside this JSON array.

**Question Generation Task:**
Based on the "Text context" below, and ${focusInstruction}, generate ${count} MCQs.

**Difficulty Level: ${difficulty}** 
${detailedDifficultyInstruction}

**MCQ Object Structure (per question):**
{
  "questionText": "string (The question itself)",
  "options": ["string A", "string B", "string C", "string D"],
  "correctOptionIndex": "number (0 for A, 1 for B, 2 for C, 3 for D)",
  "explanation": "string (Brief explanation why the chosen option is correct, based on the text. If inferential, explain the inference path from the text.)"
}

**Text context:**
---
${text}
---

Generate the JSON array now.
`;

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
            console.error("Gemini API Error (MCQ):", errorBody);
            throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody}`);
        }

        const result = await apiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const mcqs = JSON.parse(result.candidates[0].content.parts[0].text);
            return res.status(200).json({ mcqs });
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}. Details: ${JSON.stringify(result.promptFeedback.safetyRatings)}`);
        } else {
            console.error("Unexpected Gemini API response structure (MCQ):", JSON.stringify(result, null, 2));
            throw new Error("AI response structure was unexpected or content is missing.");
        }
    } catch (error) {
        console.error("Error calling Gemini API (MCQ):", error.message);
        return res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
}