// components/Sidebar.js
import Link from 'next/link';
import { useRouter } from 'next/router';
// import { FaFileUpload, FaListAlt, FaChalkboardTeacher, FaHome } from 'react-icons/fa';

const navItems = [
  { href: '/', label: 'Home', /*icon: <FaHome />*/ },
  { href: '/study', label: 'Study Dashboard', /*icon: <FaFileUpload />*/ },
  { href: '/sessions', label: 'My Sessions', /*icon: <FaListAlt />*/ },
  { href: '/flashcards', label: 'Flashcards', /*icon: <FaChalkboardTeacher />*/ },
];

export default function Sidebar({ isOpen, toggleSidebar }) {
  const router = useRouter();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black opacity-50 lg:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 bg-gray-800 text-white transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="p-5 border-b border-gray-700">
          {/* FIX: Using legacyBehavior */}
          <Link href="/" legacyBehavior>
            <a
              className="text-2xl font-bold text-white hover:text-blue-300"
              onClick={isOpen && toggleSidebar ? toggleSidebar : undefined}
            >
              Rayan's Study App
            </a>
          </Link>
        </div>
        <nav className="mt-4">
          {navItems.map((item) => (
            // FIX: Using legacyBehavior
            <Link href={item.href} key={item.label} legacyBehavior>
              <a
                onClick={isOpen && toggleSidebar ? toggleSidebar : undefined}
                className={`flex items-center py-3 px-5 hover:bg-gray-700 transition-colors ${
                  (router.pathname === item.href || (item.href === '/flashcards' && router.pathname.startsWith('/flashcards')))
                    ? 'bg-blue-600 font-semibold' : ''
                }`}
              >
                {/* {item.icon && <span className="mr-3">{item.icon}</span>} */}
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}