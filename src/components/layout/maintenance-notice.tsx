import { Wrench } from 'lucide-react';

export default function MaintenanceNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mb-6">
        <Wrench className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Under Maintenance</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {message}
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Platform administrators can still access the admin area. Please check back shortly.
      </p>
    </main>
  );
}
