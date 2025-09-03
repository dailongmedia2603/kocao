import { NavLink } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, FolderKanban, Settings, LogOut, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const { profile, user, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase() || "??";
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/projects", icon: FolderKanban, label: "Dự án" },
    { to: "/settings", icon: Settings, label: "Cài đặt" },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-hover">
        <Bot className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-white">AutoTasker</h1>
      </div>
      
      <nav className="flex-grow px-4 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 p-3 rounded-md font-medium transition-colors",
                    "hover:bg-sidebar-hover hover:text-white",
                    isActive && "bg-sidebar-active text-sidebar-active-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 mt-auto border-t border-sidebar-hover">
        <div className="p-2 flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="font-semibold text-sm text-white truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-hover hover:text-white mt-2" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;