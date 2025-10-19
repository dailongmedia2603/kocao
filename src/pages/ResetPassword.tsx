import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // This event is triggered when the user is in the password recovery flow.
        // The session is now active, allowing the user to update their password.
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError("Không thể đặt lại mật khẩu. Link có thể đã hết hạn.");
    } else {
      setMessage("Mật khẩu của bạn đã được cập nhật thành công. Đang chuyển hướng đến trang đăng nhập...");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans">
      <div className="w-full lg:w-1/2 flex flex-col p-8 sm:p-12">
        <div className="flex-shrink-0">
          <img src="/logokocao.png" alt="Logo" className="h-20 w-auto mx-auto lg:mx-0" />
        </div>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Đặt lại mật khẩu</h2>
              <p className="text-gray-500 mt-2 text-sm">Nhập mật khẩu mới của bạn ở dưới.</p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Mật khẩu mới</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pl-4 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none">
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 pl-4 pr-10"
                  />
                </div>
              </div>
              
              {message && <p className="text-green-600 text-sm text-center">{message}</p>}
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg" disabled={loading}>
                  {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="flex-shrink-0 text-center text-gray-500 text-sm">
          <p>Copyright © 2025 - CRMS</p>
        </div>
      </div>
      <div className="w-1/2 hidden lg:block">
        <img
          className="h-full w-full object-cover"
          src="/login-background.png"
          alt="Woman working on a laptop"
        />
      </div>
    </div>
  );
};

export default ResetPassword;