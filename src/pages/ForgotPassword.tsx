import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { showSuccess, showError } from "@/utils/toast";

type Step = "enter-email" | "enter-code" | "reset-password";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("enter-email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: '', // Không sử dụng link chuyển hướng
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      showError("Gửi mã thất bại. Vui lòng kiểm tra lại email.");
    } else {
      showSuccess("Mã khôi phục đã được gửi đến email của bạn.");
      setStep("enter-code");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });
    setLoading(false);
    if (error) {
      setError("Mã không hợp lệ hoặc đã hết hạn.");
      showError("Mã không hợp lệ hoặc đã hết hạn.");
    } else {
      showSuccess("Xác thực thành công. Vui lòng đặt mật khẩu mới.");
      setStep("reset-password");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      showError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp.");
      showError("Mật khẩu không khớp.");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      showError(error.message);
    } else {
      showSuccess("Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.");
      await supabase.auth.signOut(); // Đăng xuất người dùng sau khi đổi mật khẩu
      navigate("/login");
    }
  };

  const renderStep = () => {
    switch (step) {
      case "enter-email":
        return (
          <form onSubmit={handleSendResetCode} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 pl-4 pr-10"
                  placeholder="Nhập email của bạn"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg" disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi mã khôi phục'}
              </Button>
            </div>
          </form>
        );
      case "enter-code":
        return (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="flex flex-col items-start">
              <label className="block text-sm font-bold text-gray-700 mb-2">Nhập mã xác thực</label>
              <InputOTP maxLength={6} value={token} onChange={(value) => setToken(value)}>
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg" disabled={loading || token.length < 6}>
                {loading ? 'Đang xác thực...' : 'Xác thực'}
              </Button>
            </div>
          </form>
        );
      case "reset-password":
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
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
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 pl-4 pr-10"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none">
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu mật khẩu'}
              </Button>
            </div>
          </form>
        );
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
              <h2 className="text-3xl font-bold tracking-tight">Quên mật khẩu</h2>
              <p className="text-gray-500 mt-2 text-sm">Nhập thông tin để đặt lại mật khẩu của bạn.</p>
            </div>
            {renderStep()}
            <div className="mt-6">
              <p className="text-center text-sm text-gray-600">
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 flex items-center justify-center">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại Đăng nhập
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
          alt="Background"
        />
      </div>
    </div>
  );
};

export default ForgotPassword;