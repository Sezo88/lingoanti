/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export', // Vercel Server Actions ve Admin paneli icin statik export kapatildi
    images: {
        unoptimized: true,
        domains: [],
    },
}

module.exports = nextConfig
