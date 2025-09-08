import { Bell, Users, BarChart3, Video, Mic, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionContext";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const KocHeader = () => {
  const { profile, user, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (
      `${first}${last}`.toUpperCase() || user?.email?.[0].toUpperCase() || "??"
    );
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center p-2 rounded-lg font-semibold transition-colors text-sm",
      isActive
        ? "bg-red-50 text-red-600"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    );

  const iconContainerClasses = (isActive: boolean) =>
    cn(
      "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
      isActive ? "bg-red-600 text-white" : "bg-gray-200 text-gray-600"
    );

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <nav className="flex items-center gap-4">
        <NavLink to="/list-koc" end className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={iconContainerClasses(isActive)}>
                <Users className="h-4 w-4" />
              </div>
              <span className="ml-2">KOCs Manager</span>
            </>
          )}
        </NavLink>
        <NavLink to="/projects" className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={iconContainerClasses(isActive)}>
                <Video className="h-4 w-4" />
              </div>
              <span className="ml-2">Tạo Video</span>
            </>
          )}
        </NavLink>
        <NavLink to="/create-voice" className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={iconContainerClasses(isActive)}>
                <Mic className="h-4 w-4" />
              </div>
              <span className="ml-2">Tạo Voice</span>
            </>
          )}
        </NavLink>
        
        <NavLink to="/tao-content" className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={iconContainerClasses(isActive)}>
                <PenSquare className="h-4 w-4" />
              </div>
              <span className="ml-2">Tạo Content</span>
            </>
          )}
        </NavLink>

        <NavLink to="/reports" className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={iconContainerClasses(isActive)}>
                <BarChart3 className="h-4 w-4" />
              </div>
              <span className="ml-2">Report</span>
            </>
          )}
        </NavLink>
      </nav>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            10
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer ml-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(profile?.first_name, profile?.last_name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default KocHeader;