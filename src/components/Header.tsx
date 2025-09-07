import { Bell, Clock, HelpCircle, LayoutGrid, Maximize, MessageSquare, Moon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionContext";

const Header = () => {
  const { profile, user, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase() || user?.email?.[0].toUpperCase() || "??";
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <div className="flex items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input placeholder="Search Keyword" className="pl-10 bg-gray-100 border-none" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon"><Maximize className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><Moon className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><LayoutGrid className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><HelpCircle className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><Clock className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon" className="relative">
          <MessageSquare className="h-5 w-5" />
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">14</span>
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">10</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer ml-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(profile?.first_name, profile?.last_name)}</AvatarFallback>
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