export default function VendorsPage() {
  return (
    <div className="os-card">
      <h1 className="os-title">Vendors</h1>
      <p className="os-sub">Add vendor directory, pricing, availability, and preferred partners.</p>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Vendor Directory</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Photographers, Decor, Catering, Venue, DJ, Makeup…</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Quote Comparison</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Compare prices, ratings, response time.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Contracts & Payments</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Store advance, balance, invoices.</div>
        </div>
      </div>
    </div>
  );
}
