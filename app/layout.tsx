import "./globals.css";
import OsShell from "./components/OsShell";

export const metadata = {
  title: "Eventura OS",
  description: "Eventura internal operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OsShell>{children}</OsShell>
      </body>
    </html>
  );
}
