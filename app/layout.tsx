import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* SIDEBAR */}
          <aside
            style={{
              width: 240,
              background: "#0b1020",
              color: "white",
              padding: 16,
            }}
          >
            <h2 style={{ fontWeight: 800, marginBottom: 20 }}>
              Eventura OS
            </h2>

            <nav style={{ display: "grid", gap: 10 }}>
              <Nav href="/">Home</Nav>
              <Nav href="/login">Login</Nav>
              <Nav href="/dashboard">Dashboard</Nav>
              <Nav href="/events">Events</Nav>
              <Nav href="/finance">Finance</Nav>
              <Nav href="/hr">HR</Nav>
            </nav>

            <div style={{ marginTop: 30, fontSize: 12, opacity: 0.7 }}>
              CEO: Hardik Vekariya
              <br />
              Cofounder: Shubh Parekh
              <br />
              Digital Head: Dixit Bhuva
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main style={{ flex: 1, background: "#f5f7fb" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Nav({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.08)",
        color: "white",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
