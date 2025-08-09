import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Plug,
  Sparkles,
  Layers,
  Eye,
  BarChart3,
  Users,
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Connect", url: "/app/connect", icon: Plug },
  { title: "Builder", url: "/app/builder", icon: Sparkles },
  { title: "Pages", url: "/app/pages", icon: Layers },
  { title: "Preview", url: "/app/preview", icon: Eye },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
  { title: "Team", url: "/app/team", icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar className="w-60 bg-sidebar border-r" collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Adlign</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = currentPath === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} end>
                        <Icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
