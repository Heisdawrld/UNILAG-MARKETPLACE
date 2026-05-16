import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6B1D2A",
};

export const metadata: Metadata = {
  title: "UNILAG Marketplace",
  description: "The campus marketplace for University of Lagos students",
  keywords: ["UNILAG", "marketplace", "students", "University of Lagos", "campus", "buy", "sell"],
  authors: [{ name: "UNILAG Marketplace" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "UNILAG Marketplace",
    description: "The campus marketplace for University of Lagos students",
    type: "website",
  },
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  if (clerkKey && clerkKey !== 'undefined' && clerkKey.trim() !== '') {
    try {
      // Dynamic require to avoid crash when Clerk isn't configured
      const { ClerkProvider } = require("@clerk/nextjs");
      return <ClerkProvider>{children}</ClerkProvider>;
    } catch {
      // Clerk not available, render without auth
      return <>{children}</>;
    }
  }
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
