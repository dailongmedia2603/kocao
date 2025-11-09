import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutDashboard, Settings, Video, Bot, Film, Users, ClipboardList, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/contexts/SessionContext";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/",
  },
  { label: "KOCs Manager", icon: Video, to: "/list-koc" },
  { label: "Tạo kế hoạch", icon: ClipboardList, to: "/tao-ke-hoach" },
  { label: "Automation", icon: Bot, to: "/automation" },
  { label: "Tạo Video", icon: Film, to: "/tao-video" },
  { label: "Gói cước", icon: Layers, to: "/subscription" },
];

const adminMenuItems = [
  { label: "Quản lý Users", icon: Users, to: "/admin/users" },
  { label: "Gói cước", icon: Layers, to: "/admin/plans" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const location = useLocation();
  const { profile } = useSession();

  const isKocSectionActive =
    location.pathname.startsWith("/list-koc") ||
    location.pathname.startsWith("/create-voice") ||
    location.pathname.startsWith("/tao-content") ||
    location.pathname.startsWith("/video-to-script");

  const renderMenuItem = (item: typeof menuItems[0]) => (
    <Tooltip key={item.label}>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => {
            const finalIsActive = item.to === "/list-koc" ? isKocSectionActive : isActive;
            return cn(
              "group flex items-center p-2 rounded-md text-sm font-semibold transition-colors text-gray-700 hover:bg-red-50 hover:text-red-600",
              finalIsActive && "bg-red-50 text-red-600"
            );
          }}
        >
          {({ isActive }) => {
            const finalIsActive = item.to === "/list-koc" ? isKocSectionActive : isActive;
            return (
              <>
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors group-hover:bg-red-600 group-hover:text-white",
                  finalIsActive ? "bg-red-600 text-white" : "bg-transparent"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                {!isCollapsed && <span className="ml-3">{item.label}</span>}
              </>
            );
          }}
        </NavLink>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" className="bg-red-50 text-red-600 font-bold border-red-200">
          <p>{item.label}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );

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
        <TooltipProvider delayDuration={100}>
          <div className="space-y-1">
            {menuItems.map(renderMenuItem)}
            {profile?.role === 'admin' && (
              <>
                <div className="px-2 pt-4 pb-2">
                  <span className={cn("text-xs font-semibold text-muted-foreground", isCollapsed && "hidden")}>Admin</span>
                </div>
                {adminMenuItems.map(renderMenuItem)}
              </>
            )}
          </div>
        </TooltipProvider>
      </nav>
    </aside>
  );
};

export default Sidebar;