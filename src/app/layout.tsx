import type { Metadata } from "next";
import "./globals.css";
import "@livekit/components-styles";
import "@livekit/components-styles/prefabs";

export const metadata: Metadata = {
  title: "WorkSphere Goal Portal",
  description: "In-house goal setting and tracking portal for WorkSphere",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
