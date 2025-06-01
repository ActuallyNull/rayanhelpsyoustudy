import dbConnect from '@/lib/dbConnect';
import Session from '@/models/Session';

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  await dbConnect();

  switch (method) {
    case 'GET': /* Get a specific session by ID */
      try {
        const session = await Session.findById(id);
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.status(200).json({ success: true, data: session });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
      break;

    case 'DELETE': /* Delete a specific session by ID */
      try {
        const deletedSession = await Session.findByIdAndDelete(id);
        if (!deletedSession) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.status(200).json({ success: true, data: {} }); // Or send back the deleted session
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}