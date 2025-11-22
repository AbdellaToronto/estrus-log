export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">Global Library</h1>
      </div>
      
      <div className="glass-panel rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
         <div className="p-4 rounded-full bg-primary/10 text-primary">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-library"><rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"/></svg>
         </div>
         <h2 className="text-xl font-semibold">All Images</h2>
         <p className="text-muted-foreground max-w-md">
           View and manage images from all cohorts in one place. This feature is coming soon.
         </p>
      </div>
    </div>
  );
}

