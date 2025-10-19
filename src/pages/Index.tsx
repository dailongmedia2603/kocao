import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { session } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Chào mừng bạn đã quay trở lại!</h1>
        {session?.user && (
          <p className="text-gray-600 mb-6">Bạn đã đăng nhập với email: <strong>{session.user.email}</strong></p>
        )}
        <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
          Đăng xuất
        </Button>
      </div>
    </div>
  );
};

export default Index;