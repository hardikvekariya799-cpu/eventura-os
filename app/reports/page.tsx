export default function ReportsPage() {
  return (
    <div className="os-card">
      <h1 className="os-title">Reports & Analysis</h1>
      <p className="os-sub">Performance, pipeline, revenue, expense breakdown, and team productivity.</p>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Event Pipeline</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Tentative → Confirmed → Completed conversion.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Profit by Event</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Income vs expense per event (CEO sees full).</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Team Utilization</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Workload, ratings, events handled per month.</div>
        </div>
      </div>
    </div>
  );
}
