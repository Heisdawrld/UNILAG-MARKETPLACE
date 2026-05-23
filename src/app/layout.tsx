import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [{media: '(prefers-color-scheme: light)', color: '#6B1D2A'}, {media: '(prefers-color-scheme: dark)', color: '#09090b'}],
};

export const metadata: Metadata = {
  title: "UNILAG Marketplace",
  description: "Buy, sell & run errands on campus — University of Lagos",
  keywords: ["UNILAG", "marketplace", "students", "University of Lagos", "campus", "buy", "sell", "errands"],
  authors: [{ name: "UNILAG Marketplace" }],
  icons: {
    icon: [
      { url: "/logo.png", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UNILAG Market",
  },
  openGraph: {
    title: "UNILAG Marketplace",
    description: "Buy, sell & run errands on campus — University of Lagos",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Explicit apple-touch-icon for iOS home screen */}
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="apple-touch-icon" sizes="152x152" href="/apple-icon-152.png" />
          <link rel="apple-touch-icon" sizes="120x120" href="/apple-icon-120.png" />
        </head>
        <body className={`${inter.variable} font-sans antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
