// pages/api/media/status.js
import dbConnect from '@/lib/dbConnect';
import MediaJob from '@/models/MediaJob';
import admin from '@/lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

        const { jobId } = req.query;

        if (!jobId) {
            return res.status(400).json({ error: 'Job ID is required.' });
        }

        const job = await MediaJob.findById(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.userId !== uid) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const response = {
            status: job.status,
            data: null,
        };

        if (job.status === 'completed') {
            response.data = job.generatedContent;
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching job status:', error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired, please sign in again.' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}
