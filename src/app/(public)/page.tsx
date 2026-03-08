export default function HomePage() {
  return (
    <main>
      <h1>Delivery Booking Platform</h1>
      <p>Book a pickup/dropoff request and track status via magic link.</p>
      <div className="card">
        <h2>Customer booking request</h2>
        <form action="/api/bookings" method="post" className="grid">
          <input name="pickupText" placeholder="Pickup address" required />
          <input name="dropoffText" placeholder="Dropoff address" required />
          <input name="requestedWindowStart" type="datetime-local" required />
          <input name="requestedWindowEnd" type="datetime-local" required />
          <textarea name="notes" placeholder="Notes (optional)" />
          <button type="submit">Submit booking request</button>
        </form>
      </div>
      <p className="small">MVP: quote is request-only, admin will confirm later.</p>
    </main>
  );
}
