// next.config.mjs
const nextConfig = {
  serverExternalPackages: [
    'pdfkit', 'fontkit', 'unicode-properties', 'unicode-trie', 'base64-js',
    'pdf-parse', 'puppeteer', 'puppeteer-core'
  ],
};

export default nextConfig;