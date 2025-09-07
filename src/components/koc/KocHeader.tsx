import { Bell, Plus } from "lucide-react";
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
      "px-4 py-2 rounded-md text-sm font-semibold transition-colors",
      isActive
        ? "bg-gray-100 text-gray-900"
        : "text-gray-600 hover:bg-gray-100"
    );

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Tạo video
        </Button>
        <nav className="flex items-center gap-2 ml-4">
          <NavLink to="/list-koc" end className={navLinkClasses}>
            KOCs
          </NavLink>
          <NavLink to="/reports" className={navLinkClasses}>
            Report
          </NavLink>
        </nav>
      </div>
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