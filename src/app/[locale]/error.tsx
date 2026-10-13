"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-28 text-center">
      <h1 className="font-display text-4xl">Произошла ошибка</h1>
      <p className="text-ink-muted mt-3">Попробуйте обновить страницу. Қате орын алды — бетті жаңартыңыз.</p>
      <button onClick={reset} className="btn-primary mt-8">Повторить</button>
    </div>
  );
}
