import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">Settings</h1>
      </div>
      
      <SettingsClient />
    </div>
  );
}
