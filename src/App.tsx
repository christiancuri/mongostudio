import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { restoreSession } from "@/lib/sessionRestore";
import { setupSessionSubscriptions } from "@/lib/sessionSubscriptions";
import { useConnectionStore } from "@/stores/connectionStore";
import { useEffect, useState } from "react";

let subscriptionsSetup = false;

export default function App() {
  const loadSavedConnections = useConnectionStore((s) => s.loadSavedConnections);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const init = async () => {
      await loadSavedConnections();
      await restoreSession();
      setRestoring(false);
    };
    init();

    // Setup auto-save subscriptions (once)
    if (!subscriptionsSetup) {
      setupSessionSubscriptions();
      subscriptionsSetup = true;
    }
  }, [loadSavedConnections]);

  return (
    <ErrorBoundary>
      {restoring ? (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">MongoStudio</h1>
            <p className="mt-2 text-sm text-muted-foreground">Restoring session...</p>
          </div>
        </div>
      ) : (
        <AppShell />
      )}
      <Toaster position="bottom-right" richColors />
    </ErrorBoundary>
  );
}
