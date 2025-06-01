import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  const faviconSvg = `data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23007bff'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='60' fill='white'>R</text><circle cx='50' cy='50' r='40' stroke='white' stroke-width='3' fill='none'/><path d='M 30 50 Q 50 30 70 50' stroke='white' stroke-width='2' fill='none'/><path d='M 30 50 Q 50 70 70 50' stroke='white' stroke-width='2' fill='none'/></svg>"
  )}`;

  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <link rel="icon" href={faviconSvg} type="image/svg+xml" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* pdf.js worker script - Next.js will handle serving this from public if placed there,
            but pdfjs-dist usually bundles its own worker.
            The webpack alias in next.config.js helps with this.
            We will set workerSrc dynamically in the component.
        */}
      </Head>
      <body className="bg-gray-100 font-sans">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}