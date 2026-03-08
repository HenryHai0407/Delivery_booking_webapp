import { BookingForm } from "./booking-form";

export default function HomePage() {
  return (
    <main>
      <h1>Delivery Booking Platform</h1>
      <p>Book a pickup/dropoff request and track status via magic link.</p>
      <p className="small">
        Staff sign-in: <a href="/login">/login</a>
      </p>
      <div className="card">
        <h2>Customer booking request</h2>
        <BookingForm />
      </div>
      <p className="small">MVP: quote is request-only, admin will confirm later.</p>
    </main>
  );
}
