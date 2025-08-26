// components/Layout.js
import { useState } from 'react';
import Sidebar from './Sidebar';
import AuthStatus from './AuthStatus';
// import { FaBars, FaTimes } from 'react-icons/fa'; // Example for menu icon

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-4"> {/* Reduced padding a bit */}
            <div className="flex justify-between items-center">
              {/* Mobile Menu Button */}
              <button
                onClick={toggleSidebar}
                className="text-gray-600 focus:outline-none lg:hidden"
                aria-label="Open sidebar"
              >
                {/* Using a simple SVG for menu icon, replace with  FaBars if you install react-icons */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              
              {/* Can have a title here or keep it clean if sidebar has main title */}
              <h1 className="text-xl font-semibold text-gray-700 hidden lg:block">
                Rayan's Study App
              </h1>

              <AuthStatus />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow p-4 sm:p-6 overflow-y-auto"> 
          {/* Children (the current page) will be rendered here */}
          {children}
        </main>

        {/* Footer (Optional in this kind of layout, or simpler) */}
        {/* 
        <footer className="bg-white shadow-md mt-auto border-t">
          <div className="container mx-auto px-4 py-3 text-center text-gray-500 text-xs">
            © {new Date().getFullYear()} Rayan Helps You Study.
          </div>
        </footer>
        */}
      </div>
    </div>
  );
}