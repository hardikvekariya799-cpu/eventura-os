import "./globals.css";
import React from "react";

export const metadata = {
  title: "Eventura OS",
  description: "Eventura OS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
