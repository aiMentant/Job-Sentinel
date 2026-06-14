import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ProfileProvider } from "@/components/ProfileContext";
import ProfileTabs from "@/components/ProfileTabs";

import { ThemeProvider } from "@/components/ThemeContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Job Sentinel | Autonomous Application Agent",
  description: "Advanced AI-driven job search and application automation for high-impact roles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased flex`}>
        <ThemeProvider>
          <ProfileProvider>
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden h-screen bg-background border-l border-card-border">
              <div className="flex-1 overflow-y-auto">
                <ProfileTabs />
                {children}
              </div>
            </main>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
