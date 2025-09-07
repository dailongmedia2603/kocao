import { Bell } from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionContext";

const Header = () => {
  const { profile, user, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (
      `${first}${last}`.toUpperCase() ||
      user?.email?.[0].toUpperCase() ||
      "??"
    );
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-gray-100 text-gray-900"
        : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <div className="flex items-center gap-10">
        <Link to="/" className="text-xl font-bold text-gray-800">
          LOGO
        </Link>
        <nav className="hidden md:flex items-center gap-2 lg:gap-4">
          <NavLink to="/" className={navLinkClasses} end>
            Tạo Video
          </NavLink>
          <NavLink to="/list-koc" className={navLinkClasses}>
            KOCs
          </NavLink>
          <NavLink to="/reports" className={navLinkClasses}>
            Báo Cáo
          </NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer">
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

export default Header;