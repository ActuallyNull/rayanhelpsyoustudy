// pages/api/sessions/[id].js
import dbConnect from '@/lib/dbConnect';
import Session from '@/models/Session';

export default async function handler(req, res) {
  const {
    query: { id }, // Session ID
    method,
    body,       // Request body for PUT
  } = req;

  await dbConnect();

  switch (method) {
    case 'GET':
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

    case 'PUT': // Update session (e.g., to add flashcards)
      try {
        // body should contain the fields to update, e.g., { flashcards: [...] }
        const session = await Session.findByIdAndUpdate(id, body, {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators
        });
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.status(200).json({ success: true, data: session });
      } catch (error) {
        console.error("Error updating session:", error);
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    case 'DELETE':
      try {
        const deletedSession = await Session.findByIdAndDelete(id);
        if (!deletedSession) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.status(200).json({ success: true, data: {} });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}