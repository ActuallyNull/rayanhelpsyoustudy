import Link from 'next/link';
import AuthStatus from './AuthStatus'; // Create this component

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" legacyBehavior>
            <a className="text-3xl font-bold text-blue-600">Rayan Helps You Study</a>
          </Link>
          <div className="flex items-center space-x-4">
            <AuthStatus />
            <Link href="/sessions" legacyBehavior>
              <a className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
                View My Sessions
              </a>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-white shadow-md mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} Rayan Helps You Study. All rights reserved.
        </div>
      </footer>
    </div>
  );
}