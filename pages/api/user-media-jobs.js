// pages/api/user-media-jobs.js
import dbConnect from '@/lib/dbConnect';
import MediaJob from '@/models/MediaJob';

export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const { userId } = req.query;
        if (!userId) {
          return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        // Find MediaJob documents for the user that have completed and have generated content
        const mediaJobs = await MediaJob.find({
          userId: userId,
          status: 'completed',
          $or: [
            { 'generatedContent.notes': { $exists: true, $ne: null, $ne: '' } },
            { 'generatedContent.mcqs': { $exists: true, $ne: [], $ne: null } },
            { 'generatedContent.flashcards': { $exists: true, $ne: [], $ne: null } }
          ]
        }).sort({ createdAt: -1 }); // Sort by creation date, newest first

        res.status(200).json({ success: true, data: mediaJobs });
      } catch (error) {
        console.error('Error fetching user media jobs:', error);
        res.status(500).json({ success: false, error: error.message });
      }
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}