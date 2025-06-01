/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // If you need to increase body parser limit for specific API routes for large pdfText:
  // api: {
  //   bodyParser: {
  //     sizeLimit: '5mb', // or more if needed
  //   },
  // },
  webpack: (config) => {
    // Required for pdf.js to work correctly with Next.js
    config.resolve.alias['pdfjs-dist/build/pdf.js$'] = 'pdfjs-dist/build/pdf.js';
    return config;
  }
}

export default nextConfig;