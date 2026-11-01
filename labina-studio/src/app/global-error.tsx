"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5EEDC", color: "#2A1A35", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <h1 style={{ color: "#49285D", fontSize: 32 }}>حدث خطأ غير متوقع</h1>
          <p style={{ lineHeight: 1.9 }}>نعتذر، تعذر تحميل الموقع الآن. حاول مرة أخرى بعد قليل.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#DE7968", color: "#2A1A35", border: 0, borderRadius: 16, padding: "12px 24px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
