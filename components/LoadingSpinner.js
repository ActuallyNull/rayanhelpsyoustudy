export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex flex-col items-center justify-center z-50">
      <div className="loader border-5 border-t-5 border-gray-200 border-t-blue-600 rounded-full w-16 h-16 animate-spin"></div>
      <p className="text-white text-lg mt-4">{message}</p>
      <style jsx>{`
        .loader {
          border-width: 5px; /* Tailwind uses theme values, direct CSS for simplicity here */
        }
      `}</style>
    </div>
  );
}