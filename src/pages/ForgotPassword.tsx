import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError("Lỗi gửi email đặt lại mật khẩu. Vui lòng thử lại.");
    } else {
      setMessage("Link đặt lại mật khẩu đã được gửi đến email của bạn.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans">
      <div className="w-full lg:w-1/2 flex flex-col p-8 sm:p-12">
        <div className="flex-shrink-0">
          <Link to="/">
            <img src="/logokocao.png" alt="Logo" className="h-20 w-auto mx-auto lg:mx-0" />
          </Link>
        </div>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Quên mật khẩu?</h2>
              <p className="text-gray-500 mt-2 text-sm">Nhập email của bạn để nhận link đặt lại mật khẩu.</p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Địa chỉ Email</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-4 pr-10"
                    placeholder="your@email.com"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
              </div>
              
              {message && <p className="text-green-600 text-sm text-center">{message}</p>}
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg" disabled={loading}>
                  {loading ? "Đang gửi..." : "Gửi link đặt lại"}
                </Button>
              </div>
            </form>
            <div className="mt-6">
              <p className="text-center text-sm text-gray-600">
                Nhớ mật khẩu?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Quay lại Đăng nhập
                </Link>
              </p>
            </div>
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

export default ForgotPassword;