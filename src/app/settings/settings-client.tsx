"use client";

import { OrganizationProfile, UserProfile, useOrganization, CreateOrganization } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

export function SettingsClient() {
  const { organization, isLoaded } = useOrganization();
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  if (!isLoaded) {
    return null; // Or a skeleton
  }

  return (
    <Tabs defaultValue="organization" className="w-full">
      <TabsList className="w-full max-w-[400px] grid grid-cols-2 h-10 sm:h-11">
        <TabsTrigger value="organization" className="text-sm sm:text-base">Organization</TabsTrigger>
        <TabsTrigger value="profile" className="text-sm sm:text-base">Profile</TabsTrigger>
      </TabsList>

      <TabsContent value="organization" className="mt-4 sm:mt-6">
        {showCreateOrg ? (
           <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex justify-center items-center min-h-[400px] sm:min-h-[600px]">
             <div className="w-full max-w-[480px]">
                <div className="mb-4">
                  <Button variant="ghost" onClick={() => setShowCreateOrg(false)} className="text-sm">
                    ← Back to Settings
                  </Button>
                </div>
                <CreateOrganization afterCreateOrganizationUrl="/settings" />
             </div>
           </div>
        ) : !organization ? (
          <Card className="glass-panel border-0 shadow-none">
            <CardHeader>
              <CardTitle>No Organization Selected</CardTitle>
              <CardDescription>
                You are currently working in your personal workspace. Create or select an organization to manage members and settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="p-4 rounded-full bg-primary/10 text-primary mb-2">
                <PlusCircle className="w-12 h-12" />
              </div>
              <Button onClick={() => setShowCreateOrg(true)}>
                Create New Organization
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Or use the switcher in the sidebar to select an existing one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-h-[400px] sm:min-h-[600px] flex justify-center overflow-x-auto">
            <OrganizationProfile
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full h-full max-w-full",
                  card: "shadow-none border-0 bg-transparent w-full h-full",
                  scrollBox: "shadow-none border-0 bg-transparent w-full h-full",
                  navbar: "hidden md:flex",
                }
              }}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="profile" className="mt-4 sm:mt-6">
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-h-[400px] sm:min-h-[600px] flex justify-center overflow-x-auto">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full h-full max-w-full",
                card: "shadow-none border-0 bg-transparent w-full h-full",
                scrollBox: "shadow-none border-0 bg-transparent w-full h-full",
                navbar: "hidden md:flex",
              }
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}






