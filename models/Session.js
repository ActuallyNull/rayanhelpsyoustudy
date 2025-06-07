// models/Session.js
import mongoose from 'mongoose';

const FlashcardSchema = new mongoose.Schema({ // Define a sub-schema for flashcards
    front: { type: String, required: true },
    back: { type: String, required: true }
}, { _id: false }); // No separate _id for sub-documents unless needed

const SessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    pdfText: {
        type: String,
        required: true,
    },
    categories: {
        type: [String],
        required: true,
    },
    lastDifficulty: {
        type: String,
        default: 'medium',
    },
    flashcards: { // New field
        type: [FlashcardSchema], // Array of flashcard objects
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);