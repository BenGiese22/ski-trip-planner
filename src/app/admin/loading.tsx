export default function AdminLoading() {
  return (
    <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-14" aria-busy="true">
      <h1 className="text-2xl mb-6">Responses</h1>
      <div className="animate-pulse flex flex-col gap-3" aria-hidden="true">
        <div className="h-24 bg-paper border border-line rounded-lg" />
        <div className="h-24 bg-paper border border-line rounded-lg" />
        <div className="h-24 bg-paper border border-line rounded-lg" />
      </div>
      <p className="sr-only">Loading responses…</p>
    </main>
  );
}
