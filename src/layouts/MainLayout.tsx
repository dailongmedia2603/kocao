import { Outlet, Link, useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const MainLayout = () => {
  const { session } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-4 border-b bg-background">
        <nav className="flex items-center gap-4">
          <h1 className="font-bold text-lg">My App</h1>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">Dashboard</Link>
          <Link to="/list-koc" className="text-sm text-muted-foreground hover:text-primary">KOCs</Link>
          <Link to="/settings" className="text-sm text-muted-foreground hover:text-primary">Settings</Link>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary">Admin</Link>
        </nav>
        {session && <Button variant="outline" onClick={handleSignOut}>Logout</Button>}
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/40">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;