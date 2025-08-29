import { NavLink } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, FolderKanban, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const { profile, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase();
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/projects", icon: FolderKanban, label: "Dự án" },
    { to: "/settings", icon: Settings, label: "Cài đặt" },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r bg-gray-50 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold text-center">AutoTasker</h1>
      </div>
      <div className="p-4 flex items-center space-x-3 border-b">
        <Avatar>
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback>
            {getInitials(profile?.first_name, profile?.last_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">
            {profile?.first_name} {profile?.last_name}
          </p>
        </div>
      </div>
      <nav className="flex-grow p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 p-2 rounded-md text-gray-700 hover:bg-gray-200",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
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
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;