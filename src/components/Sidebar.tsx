import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutDashboard, FolderKanban, Settings, Plug, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const menuItems = [
  {
    label: "Dự án",
    icon: LayoutDashboard,
    to: "/",
  },
  { label: "Danh sách dự án", icon: FolderKanban, to: "/projects" },
  { label: "Extensions", icon: Plug, to: "/extensions" },
  { label: "KOCs Manager", icon: Video, to: "/list-koc" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn("bg-white border-r flex flex-col transition-all duration-300 relative", isCollapsed ? "w-20" : "w-64")}>
      <div className={cn(
        "flex items-center h-16 border-b px-4 flex-shrink-0",
        isCollapsed ? "justify-center" : "justify-start"
      )}>
        {isCollapsed ? (
          <img src="/favicon.ico" alt="Logo" className="h-8 w-auto" />
        ) : (
          <Logo />
        )}
      </div>

      <Button 
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 -right-4 h-8 w-8 rounded-full bg-white hover:bg-gray-100"
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
      </Button>

      <nav className="flex-grow px-4 py-4 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center p-2 rounded-md text-sm font-semibold transition-colors text-gray-700 hover:bg-red-50 hover:text-red-600",
                  isActive && "bg-red-50 text-red-600"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors group-hover:bg-red-600 group-hover:text-white",
                    isActive ? "bg-red-600 text-white" : "bg-transparent"
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  {!isCollapsed && <span className="ml-3">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;