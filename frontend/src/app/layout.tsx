import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proxy — AI Meetup Negotiation",
  description:
    "Stop arguing in group chats. Let your AI proxy negotiate the perfect meetup for everyone.",
  keywords: ["AI", "meetup", "negotiation", "group planning", "proxy"],
  openGraph: {
    title: "Proxy — AI Meetup Negotiation",
    description: "Your AI representative negotiates group meetup plans for you.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-[#0a0a0f] text-[#e2e8f0] antialiased font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a2e",
              color: "#e2e8f0",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: {
                primary: "#34d399",
                secondary: "#0a0a0f",
              },
            },
            error: {
              iconTheme: {
                primary: "#f87171",
                secondary: "#0a0a0f",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
