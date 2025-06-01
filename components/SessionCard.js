import Link from 'next/link';
import { shortenCategories } from '@/lib/utils'; // Assuming you have this utility

export default function SessionCard({ session, onDelete }) {
  return (
    <div className="session-card bg-white p-4 rounded-lg shadow border border-gray-200">
      <p><strong>📄 File:</strong> {session.fileName}</p>
      <p><strong>🧠 Categories:</strong> {shortenCategories(session.categories)}</p>
      <p><strong>📅 Created At:</strong> {new Date(session.createdAt).toLocaleString()}</p>
      <div className="flex space-x-2 mt-3">
        <Link href={`/?sessionId=${session._id}`} legacyBehavior>
          <a className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
            ▶ Load
          </a>
        </Link>
        <button 
          onClick={() => onDelete(session._id)}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm delete-button"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}