// pages/index.js
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';
import { useRouter } from 'next/router';

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const handleGetStarted = () => {
    if (!user) {
      showModal("Login Required", "Please sign in to start studying!");
      return;
    }
    router.push('/study');
  };

  const features = [
    {
      icon: "📄",
      title: "Upload Any Document",
      description: "Upload PDF or PowerPoint files and let AI extract all the important content automatically."
    },
    {
      icon: "🧠",
      title: "Smart Categorization",
      description: "AI automatically identifies and categorizes topics from your study materials."
    },
    {
      icon: "❓",
      title: "Generate MCQs",
      description: "Create multiple choice questions with different difficulty levels: Easy, Medium, Hard, and Ministerial."
    },
    {
      icon: "🃏",
      title: "Flashcards",
      description: "Generate interactive flashcards to help you memorize key concepts and definitions."
    },
    {
      icon: "📊",
      title: "Track Progress",
      description: "Monitor your study sessions and track your performance across different topics."
    },
    {
      icon: "🎯",
      title: "Personalized Learning",
      description: "Adaptive difficulty levels and personalized study recommendations based on your performance."
    }
  ];

  const stats = [
    { number: "1000+", label: "Study Sessions" },
    { number: "50K+", label: "Questions Generated" },
    { number: "95%", label: "User Satisfaction" },
    { number: "24/7", label: "AI Support" }
  ];

  return (
    <>
      <Head>
        <title>Rayan Helps You Study - AI-Powered Study Assistant</title>
        <meta name="description" content="Transform your study materials into interactive quizzes and flashcards with AI. Upload PDFs and PowerPoints to generate MCQs and study aids." />
      </Head>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Study Smarter, Not Harder
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 leading-relaxed">
              Transform your study materials into interactive quizzes and flashcards with AI-powered learning assistance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGetStarted}
                className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-4 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 shadow-lg"
              >
                {user ? 'Start Studying' : 'Get Started Free'}
              </button>
              <Link href="/sessions" legacyBehavior>
                <a className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-bold py-4 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105">
                  View Sessions
                </a>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Why Choose Rayan's Study App?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI-powered platform makes studying more effective and engaging than ever before.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:-translate-y-2">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get started in just three simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">1</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Upload Your Materials</h3>
              <p className="text-gray-600">Upload your PDF or PowerPoint files. Our AI will extract and analyze all the content.</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">2</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Choose Your Study Mode</h3>
              <p className="text-gray-600">Select from multiple choice questions, flashcards, or browse by topic categories.</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">3</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Study & Improve</h3>
              <p className="text-gray-600">Practice with adaptive difficulty levels and track your progress over time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Study Experience?</h2>
          <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Join thousands of students who are already studying smarter with AI-powered assistance.
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-4 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 shadow-lg"
          >
            {user ? 'Continue Studying' : 'Start Your Free Trial'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Rayan's Study App</h3>
              <p className="text-gray-300">
                AI-powered study assistance to help you learn more effectively and achieve your academic goals.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link href="/study" legacyBehavior><a className="text-gray-300 hover:text-white transition duration-300">Study Dashboard</a></Link></li>
                <li><Link href="/sessions" legacyBehavior><a className="text-gray-300 hover:text-white transition duration-300">My Sessions</a></Link></li>
                <li><Link href="/flashcards" legacyBehavior><a className="text-gray-300 hover:text-white transition duration-300">Flashcards</a></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-300">
                <li>PDF & PPTX Upload</li>
                <li>AI Question Generation</li>
                <li>Interactive Flashcards</li>
                <li>Progress Tracking</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-300">
            <p>&copy; {new Date().getFullYear()} Rayan's Study App. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        {modalMessage}
      </Modal>
    </>
  );
}