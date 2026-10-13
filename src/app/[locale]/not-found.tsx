import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-28 text-center">
      <div className="font-display text-7xl">404</div>
      <h1 className="mt-4 text-xl">Страница не найдена · Бет табылмады</h1>
      <Link href="/" className="btn-primary mt-8">M‑TREND</Link>
    </div>
  );
}
