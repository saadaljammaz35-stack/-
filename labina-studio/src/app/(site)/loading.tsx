export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="flex h-16 items-end gap-2">
        {["bg-coral", "bg-sun", "bg-lavender", "bg-teal", "bg-plum"].map((c, i) => (
          <span key={c} className={`w-4 animate-float rounded-md ${c}`} style={{ height: 24 + i * 9, animationDelay: `${i * -0.25}s`, animationDuration: "1.4s" }} />
        ))}
      </div>
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  );
}
