// pages/api/media/process.js
import dbConnect from '@/lib/dbConnect';
import MediaJob from '@/models/MediaJob';
import ytdl from 'ytdl-core';
import admin from '@/lib/firebase-admin';
import { Writable, Readable } from 'stream';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse'; // Import pdf-parse
import { del } from '@vercel/blob';

// IMPORTANT: Increase body parser limit for this route due to large audio/video buffers
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust as needed, e.g., '50mb' or '100mb' for very large files
    },
  },
};

// Initialize the Google AI SDK once
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Trigger background job (demo – runs inline, not scalable on Vercel)
async function triggerBackgroundTask(jobId) {
  console.log(`Triggering background task for job: ${jobId}`);
  processJobInBackground(jobId);
}

async function processJobInBackground(jobId) {
  try {
    await dbConnect();
    const job = await MediaJob.findById(jobId);
    if (!job) {
      console.error(`Job not found: ${jobId}`);
      return;
    }

    job.status = 'processing';
    await job.save();

    let originalDocumentText = '';
    let transcriptionSource = '';
    let mediaBuffer; // To hold the content of the file for processing

    if (job.type === 'file') {
      const response = await fetch(job.identifier); // job.identifier is the Blob URL
      if (!response.ok) {
        throw new Error(`Failed to fetch file from Blob URL: ${job.identifier}`);
      }
      const mimeType = response.headers.get('content-type') || 'application/octet-stream';
      mediaBuffer = await response.buffer(); // Get entire file as buffer

      if (mimeType === 'application/pdf') {
        const pdf = await pdfParse(mediaBuffer);
        originalDocumentText = pdf.text;
        transcriptionSource = 'pdf_extraction';
        console.log(`[Job ${jobId}] PDF text extracted successfully.`);
      } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        // Handle audio/video transcription
        const audioPart = {
          inlineData: {
            data: mediaBuffer.toString('base64'),
            mimeType: mimeType,
          },
        };
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const transcriptResult = await model.generateContent(['Please transcribe this audio/video.', audioPart]);
        originalDocumentText = transcriptResult.response.text();
        transcriptionSource = 'audio_transcription';
        console.log(`[Job ${jobId}] Audio/Video transcribed successfully.`);
      } else {
        console.warn(`[Job ${jobId}] Unsupported file type for text extraction: ${mimeType}`);
        originalDocumentText = `Could not extract text from file type: ${mimeType}.`;
        transcriptionSource = 'unsupported_file_type';
      }

    } else if (job.type === 'youtube') {
      if (!ytdl.validateURL(job.identifier)) {
        throw new Error('Invalid YouTube URL');
      }

      const audioStream = ytdl(job.identifier, { filter: 'audioonly', quality: 'highestaudio' });
      const chunks = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await new Promise((resolve, reject) => {
        audioStream.pipe(writable);
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });

      mediaBuffer = Buffer.concat(chunks); // Get YouTube audio as buffer
      
      const audioPart = {
        inlineData: {
          data: mediaBuffer.toString('base64'),
          mimeType: 'audio/mp4', // ytdl streams as mp4
        },
      };
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const transcriptResult = await model.generateContent(['Please transcribe this audio.', audioPart]);
      originalDocumentText = transcriptResult.response.text();
      transcriptionSource = 'youtube_transcript';
      console.log(`[Job ${jobId}] YouTube audio transcribed successfully.`);
    }

    // Save the original extracted text and its source
    job.originalContentText = originalDocumentText;
    job.transcriptionSource = transcriptionSource;

    // Generate Notes based on the original content text
    // MCQs and Flashcards will be generated on-demand from the frontend
    if (originalDocumentText) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const notesResult = await model.generateContent(
        `Based on the following text, generate detailed notes, formatted in markdown:\\n\\n${originalDocumentText}`
      );
      const notes = notesResult.response.text();
      job.generatedContent = { notes, mcqs: [], flashcards: [] }; // Initialize with notes, empty for others
      console.log(`[Job ${jobId}] Notes generated successfully.`);
    } else {
        job.generatedContent = { notes: "No original content text was available for note generation.", mcqs: [], flashcards: [] };
        console.warn(`[Job ${jobId}] No original content text, notes set to default message.`);
    }

    job.status = 'completed';
    await job.save();
    console.log(`Job completed: ${jobId}`);

    // IMPLEMENT BLOB DELETION LOGIC HERE
    if (job.type === 'file' && job.identifier) { // Check if it's a file type and has an identifier (blob URL)
      try {
        await del(job.identifier); // Delete the blob using its URL
        console.log(`[Job ${jobId}] Blob deleted successfully: ${job.identifier}`);
      } catch (deletionError) {
        console.error(`[Job ${jobId}] Error deleting blob ${job.identifier}:`, deletionError);
        // Log the error but don't fail the job if text extraction was successful
      }
    }
    // END BLOB DELETION LOGIC

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    try {
      const job = await MediaJob.findById(jobId);
      if (job) {
        job.status = 'failed';
        await job.save();
      }
    } catch (saveError) {
      console.error(`Error saving failed status for job ${jobId}:`, saveError);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await dbConnect();

  try {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, identifier, fileName } = req.body; // Added fileName for better display
    if (!type || !identifier) {
      return res.status(400).json({ error: 'Type and identifier are required.' });
    }

    const newJob = new MediaJob({
      userId: uid,
      type,
      identifier, // This will be the Blob URL for files, or YouTube URL
      fileName: fileName || identifier, // Store original file name
      status: 'pending',
    });

    await newJob.save();

    // Kick off background job
    await triggerBackgroundTask(newJob._id);

    res.status(201).json({ jobId: newJob._id });
  } catch (error) {
    console.error('Error creating media job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}