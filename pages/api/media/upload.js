// pages/api/media/upload.js
import { handleUpload, upload } from '@vercel/blob/client'; // Import 'upload' as well if you need direct upload, though handleUpload is for token generation.
import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure the user's ID token is present for authentication when calling /api/media/process
  const authToken = req.headers.authorization;
  if (!authToken) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  // NOTE: handleUpload expects a specific request body structure.
  // We're parsing the raw body to access it here.
  const bodyBuffer = await buffer(req);
  const body = JSON.parse(bodyBuffer.toString());

  try {
    const jsonResponse = await handleUpload({
      body,
      request: {
        ...req,
        // The json() method is expected by handleUpload internally for some setups, ensure it's provided.
        json: async () => body,
      },
      onBeforeGenerateToken: async (pathname) => {
        // You might want to pass the userId from the frontend here if you want to associate the token with a user
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'audio/mpeg',
            'audio/mp4',
            'video/mp4',
            'video/webm', // Add webm if needed
          ],
          addRandomSuffix: true,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Blob upload completed', blob, tokenPayload);
        // Extract filename from the blob path
        const fileName = blob.pathname.split('/').pop();
        const fileType = blob.contentType;

        // Determine the MediaJob type based on content type
        let mediaJobType = 'file';
        // You can add more specific logic here if 'file' type needs further distinction (e.g., 'pdf_file', 'audio_file')
        // For now, we'll keep it simple as 'file' for all uploaded files.

        try {
          // Now, trigger the media processing API route
          const processRes = await fetch(`${req.headers.origin}/api/media/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken, // Pass the original auth token
            },
            body: JSON.stringify({
              type: mediaJobType,
              identifier: blob.url, // The URL of the uploaded blob
              fileName: fileName,
              fileType: fileType, // Optionally pass the content type for more info
            }),
          });

          if (!processRes.ok) {
            const errorBody = await processRes.json();
            console.error('Error triggering media processing:', errorBody);
            // Consider logging this error or handling it for the user
            // This error won't stop the blob upload from being reported as successful to the frontend
          } else {
            const processData = await processRes.json();
            console.log('Media processing job triggered:', processData.jobId);
          }
        } catch (processError) {
          console.error('Network error triggering media processing:', processError);
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error handling blob upload:', error);
    return res.status(400).json({ error: error.message });
  }
}