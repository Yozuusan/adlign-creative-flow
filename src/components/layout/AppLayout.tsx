import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";

export default function AppLayout() {
  const { logout } = useAuth();

  return (
    <SidebarProvider>
      <Helmet>
        <title>Adlign App</title>
        <meta name="description" content="Adlign SaaS dashboard" />
        <link rel="canonical" href="/app" />
      </Helmet>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="h-14 flex items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <div className="font-semibold tracking-tight">Adlign</div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="mr-2" /> Logout
              </Button>
            </div>
          </header>
          <main className="p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
