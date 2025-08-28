// models/MediaJob.js
import mongoose from 'mongoose';

const MCQSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: { type: [String], required: true },
    answer: { type: String, required: true },
}, { _id: false });

const FlashcardSchema = new mongoose.Schema({
    front: { type: String, required: true },
    back: { type: String, required: true },
}, { _id: false });

const MediaJobSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['file', 'youtube'],
        required: true,
    },
    identifier: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
    },
    // NEW FIELDS FOR STORING ORIGINAL TEXT CONTENT
    originalContentText: { // Stores the extracted text from PDF, YouTube transcript, or audio transcription
        type: String,
        required: false, // Not required immediately, as processing is async
    },
    transcriptionSource: { // e.g., 'pdf_extraction', 'youtube_transcript', 'audio_transcription'
        type: String,
        required: false,
    },
    generatedContent: {
        notes: { type: String },
        mcqs: { type: [MCQSchema] },
        flashcards: { type: [FlashcardSchema] },
    },
}, { timestamps: true });

export default mongoose.models.MediaJob || mongoose.model('MediaJob', MediaJobSchema);
