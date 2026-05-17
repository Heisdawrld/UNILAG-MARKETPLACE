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
  themeColor: [{media: '(prefers-color-scheme: light)', color: '#f97316'}, {media: '(prefers-color-scheme: dark)', color: '#0a0a0a'}],
};

export const metadata: Metadata = {
  title: "UNILAG Marketplace",
  description: "Buy, sell & run errands on campus — University of Lagos",
  keywords: ["UNILAG", "marketplace", "students", "University of Lagos", "campus", "buy", "sell", "errands"],
  authors: [{ name: "UNILAG Marketplace" }],
  icons: { icon: "/logo.png", apple: "/logo.png" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
