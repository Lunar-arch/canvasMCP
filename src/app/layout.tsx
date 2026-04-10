import type { Metadata } from "next";
import { AuthProvider } from "@/hooks/useAuth";
import { AppProvider } from "@/hooks/useAppData";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyFlow — Canvas Study Tool",
  description: "Your personal study dashboard synced with Canvas LMS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppProvider>{children}</AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
