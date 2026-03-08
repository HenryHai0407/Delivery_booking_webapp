interface PortalProps {
  params: { publicId: string };
  searchParams: { token?: string };
}

export default function PortalPage({ params, searchParams }: PortalProps) {
  return (
    <main>
      <h1>Booking Portal</h1>
      <p>Public ID: {params.publicId}</p>
      <p>Token provided: {searchParams.token ? "yes" : "no"}</p>
      <p className="small">Fetch details via GET /api/bookings/{params.publicId}?token=...</p>
    </main>
  );
}
