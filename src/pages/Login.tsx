import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Eye, EyeOff } from "lucide-react";

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

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans">
      <div className="w-full lg:w-1/2 flex flex-col p-8 sm:p-12">
        <div className="flex-shrink-0">
            <img src="/logokocao.png" alt="Logo" className="h-20 w-auto mx-auto lg:mx-0" />
        </div>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Đăng nhập</h2>
              <p className="text-gray-500 mt-2 text-sm">DrX AI KOC - Phần mềm tạo KOC</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
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

export default Login;