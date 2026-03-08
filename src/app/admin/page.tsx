export default function AdminPage() {
  return (
    <main>
      <h1>Admin Console</h1>
      <div className="card">
        <p>Use API endpoints for full workflow:</p>
        <ul>
          <li>GET /api/admin/bookings?page=1&pageSize=20</li>
          <li>PATCH /api/admin/bookings/:id</li>
          <li>POST /api/admin/bookings/:id/assign</li>
          <li>POST /api/admin/bookings/:id/status</li>
        </ul>
      </div>
    </main>
  );
}
