export default function AIPage() {
  return (
    <div className="os-card">
      <h1 className="os-title">AI Studio</h1>
      <p className="os-sub">Smart tools for proposals, timelines, vendor suggestions, and client messages.</p>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Proposal Generator</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Auto-create a client proposal from event details.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Budget Optimizer</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Suggest best vendor mix under budget.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Timeline Builder</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Auto tasks + checklist for wedding / corporate events.</div>
        </div>
      </div>
    </div>
  );
}
