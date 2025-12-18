export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Eventura OS</h1>
      <p style={{ marginBottom: 20 }}>
        Internal operating system for Eventura (CEO + Staff).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Card title="Dashboard" desc="Company overview & KPIs" />
        <Card title="Events" desc="Pipeline, status, budgets" />
        <Card title="Finance" desc="Income, expense, reports" />
        <Card title="HR" desc="Team, roles, performance" />
        <Card title="Vendors" desc="Vendor management" />
        <Card title="Reports" desc="Exports & analytics" />
      </div>
    </main>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 14, color: "#4b5563" }}>{desc}</div>
    </div>
  );
}
