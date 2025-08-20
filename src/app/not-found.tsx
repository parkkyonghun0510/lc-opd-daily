export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl">🔍</div>
      <h1 className="text-2xl font-semibold">Page Not Found</h1>
      <p className="text-muted-foreground max-w-md">
        The page you are looking for doesn’t exist or has been moved.
      </p>
      <a href="/" className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
        Go Home
      </a>
    </div>
  );
}