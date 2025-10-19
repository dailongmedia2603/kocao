import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Eye, EyeOff } from "lucide-react";

// SVG for Google Icon
const GoogleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// SVG for Facebook Icon
const FacebookIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v7.008C18.343 21.128 22 16.991 22 12z"/>
    </svg>
);

// SVG for Apple Icon
const AppleIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.012 16.11c-.973 0-1.924-.42-3.19-1.241-1.513-.987-2.634-2.438-2.634-4.335 0-2.353 1.513-4.22 3.623-4.22 1.13 0 2.23.565 2.95 1.331.836.895 1.331 2.015 1.331 3.386 0 .283-.023.565-.047.823-.813-.07-1.673.164-2.374.634-1.153.775-1.743 1.82-1.743 2.914 0 .352.07.68.21 1.009.21.493.587.94.987 1.288.023 0 .023 0 .023 0m2.903-12.598c-.88-1.08-2.203-1.743-3.553-1.743-1.625 0-3.19.917-4.046 2.306-1.743 2.844-.446 6.454 1.56 8.28.94.86 2.038 1.354 3.236 1.354.423 0 .845-.094 1.266-.282.305.963 1.218 2.984 2.89 2.984.023 0 .047 0 .07 0 .023 0 .023 0 .046 0 1.487 0 2.49-1.44 2.49-1.44s-1.08-1.625-2.513-3.213c-1.034-1.153-1.99-2.015-2.443-2.444a1.31 1.31 0 0 1-.305-.87c0-.517.258-.987.728-1.33.61-.446 1.375-.68 2.226-.68.21 0 .423.023.634.047.023-2.13-1.107-3.598-2.536-4.47z"/>
    </svg>
);


const Login = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("Invalid login credentials. Please try again.");
    } else {
      navigate("/");
    }
  };

  const handleSocialLogin = async (provider) => {
    await supabase.auth.signInWithOAuth({ provider });
  };

  return (
    <div className="flex min-h-screen bg-white font-sans">
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12">
        <div className="flex items-center">
            <img src="/logokocao.png" alt="Logo" className="h-24 w-auto" />
        </div>
        
        <div className="w-full max-w-sm mx-auto">
          <div className="text-left mb-8">
            <h2 className="text-4xl font-bold tracking-tight">Đăng nhập</h2>
            <p className="text-gray-500 mt-2 text-sm">DrX AI KOC - Phần mềm tạo KOC</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 pl-4 pr-10"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Checkbox id="remember-me" className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 font-medium">Remember Me</label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-red-600 hover:text-red-500">Forgot Password?</a>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold rounded-lg">Đăng nhập</Button>
            </div>
          </form>
          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              New on our platform?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <div className="text-center text-gray-500 text-sm">
          <p>Copyright © 2025 - CRMS</p>
        </div>
      </div>
      <div className="w-1/2 hidden lg:block">
        <img
          className="h-full w-full object-cover"
          src="/login-background.svg"
          alt="Woman working on a laptop"
        />
      </div>
    </div>
  );
};

export default Login;