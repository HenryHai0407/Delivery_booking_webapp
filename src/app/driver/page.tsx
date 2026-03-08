export default function DriverPage() {
  return (
    <main>
      <h1>Driver PWA Page</h1>
      <div className="card">
        <p>Driver jobs endpoint: GET /api/driver/jobs?date=today</p>
        <p>Status update endpoint: POST /api/driver/jobs/:id/status</p>
        <p>POD upload signed URL endpoint: POST /api/uploads/presign</p>
      </div>
    </main>
  );
}
