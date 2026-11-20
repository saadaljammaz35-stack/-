/** Calm placeholder blocks shown instantly while a page loads (no motion when reduced motion is on). */
export function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-sand-300/50 motion-reduce:animate-none ${className}`} />;
}

export function PageSkeleton({ variant = 'page' }: { variant?: 'page' | 'product' | 'list' | 'admin' }) {
  return (
    <div role="status" aria-busy="true" aria-label="…" className={variant === 'admin' ? 'space-y-4' : 'mx-auto max-w-6xl space-y-5 px-5 py-8 sm:px-8'}>
      {variant === 'product' ? (
        <>
          <Bone className="h-[22rem] w-full rounded-[2rem]" />
          <Bone className="h-8 w-2/3" />
          <div className="grid gap-3">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-16" />)}</div>
        </>
      ) : variant === 'list' || variant === 'admin' ? (
        <>
          <Bone className="h-9 w-48" />
          <Bone className="h-12 w-full" />
          {[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-24 w-full rounded-3xl" />)}
        </>
      ) : (
        <>
          <Bone className="h-56 w-full rounded-[2rem]" />
          <Bone className="h-8 w-1/2" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-64 rounded-3xl" />)}</div>
        </>
      )}
    </div>
  );
}
