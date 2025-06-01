import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    pdfText: { // Consider if this can be very large. Might need separate storage for huge files.
        type: String,
        required: true,
    },
    categories: {
        type: [String],
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastDifficulty: {
        type: String,
        default: 'medium',
    }
});

// To prevent recompilation of model in dev environment
export default mongoose.models.Session || mongoose.model('Session', SessionSchema);