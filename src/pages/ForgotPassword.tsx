import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { api } from "@/lib/apiClient";

type Step = "enter-email" | "reset-password";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("enter-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    // Check for token and email in URL (Laravel Password Reset structure)
    const urlToken = searchParams.get('token');
    const urlEmail = searchParams.get('email');

    if (urlToken && urlEmail) {
      setToken(urlToken);
      setEmail(urlEmail);
      setStep("reset-password");
    }
  }, [searchParams]);


  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.auth.forgotPassword(email);
      showSuccess("Link khôi phục đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.");
    } catch (err: any) {
      setError(err.message || "Gửi link thất bại. Vui lòng kiểm tra lại email.");
      showError(err.message || "Gửi link thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      showError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp.");
      showError("Mật khẩu không khớp.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await api.auth.resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmPassword
      });
      showSuccess("Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.");
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "Đặt lại mật khẩu thất bại.");
      showError(err.message || "Đặt lại mật khẩu thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "enter-email":
        return (
          <form onSubmit={handleSendResetLink} className="space-y-4">
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
                {loading ? 'Đang gửi...' : 'Gửi link khôi phục'}
              </Button>
            </div>
          </form>
        );
      case "reset-password":
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="email" value={email} />
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Mật khẩu mới</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pl-4 pr-10"
                  minLength={8}
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
                  minLength={8}
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