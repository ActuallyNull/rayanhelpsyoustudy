// pages/api/media-job/[id].js
import dbConnect from '@/lib/dbConnect';
import MediaJob from '@/models/MediaJob';

// IMPORTANT: Increase body parser limit for this route due to potentially large notes content
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Adjust as needed for very large notes
    },
  },
};

export default async function handler(req, res) {
  const {
    query: { id, userId }, // Get job ID and userId from query parameters
    method,
  } = req;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        if (!userId) {
          return res.status(400).json({ success: false, error: 'User ID is required' });
        }
        if (!id) {
            return res.status(400).json({ success: false, error: 'Media Job ID is required' });
        }

        const mediaJob = await MediaJob.findOne({ _id: id, userId: userId });

        if (!mediaJob) {
          return res.status(404).json({ success: false, error: 'Media Job not found or not accessible by user' });
        }
        res.status(200).json({ success: true, data: mediaJob });
      } catch (error) {
        console.error('Error fetching media job by ID:', error);
        res.status(500).json({ success: false, error: error.message });
      }
      break;

    case 'PUT': // Case for updating notes
      try {
        const { userId: bodyUserId, notes } = req.body;

        if (!id || !bodyUserId || notes === undefined) {
          return res.status(400).json({ success: false, error: 'Media Job ID, User ID, and notes content are required' });
        }

        const mediaJob = await MediaJob.findOneAndUpdate(
          { _id: id, userId: bodyUserId },
          { 'generatedContent.notes': notes },
          { new: true, runValidators: true }
        );

        if (!mediaJob) {
          return res.status(404).json({ success: false, error: 'Media Job not found or not accessible by user' });
        }

        res.status(200).json({ success: true, data: mediaJob });
      } catch (error) {
        console.error('Error updating media job notes:', error);
        res.status(500).json({ success: false, error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}