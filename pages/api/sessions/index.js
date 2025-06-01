import dbConnect from '@/lib/dbConnect';
import Session from '@/models/Session';

// To increase body size limit for this specific route if pdfText is large
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust as needed
    },
  },
};

export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  switch (method) {
    case 'GET': // Get sessions for a specific user
      try {
        const { userId } = req.query; // Expect userId as a query parameter
        if (!userId) {
          return res.status(400).json({ success: false, error: 'User ID is required' });
        }
        const sessions = await Session.find({ userId: userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: sessions });
      } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ success: false, error: error.message });
      }
      break;
    case 'POST': // Create a new session
      try {
        // Ensure pdfText is not excessively large if it's part of the body
        // The body parser limit is set above in `config`
        const session = await Session.create(req.body);
        res.status(201).json({ success: true, data: session });
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(400).json({ success: false, error: error.message });
      }
      break;
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}