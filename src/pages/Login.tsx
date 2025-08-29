import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useSession } from "@/contexts/SessionContext";

const Login = () => {
  const navigate = useNavigate();
  const { session } = useSession();

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">AutoTasker</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="light"
          view="sign_in"
          localization={{
            variables: {
              sign_up: {
                email_label: "Địa chỉ email",
                password_label: "Mật khẩu",
                button_label: "Đăng ký",
                social_provider_text: "Đăng nhập với {{provider}}",
                link_text: "Chưa có tài khoản? Đăng ký",
                confirmation_text: "Kiểm tra email của bạn để xác nhận tài khoản."
              },
              sign_in: {
                email_label: "Địa chỉ email",
                password_label: "Mật khẩu",
                button_label: "Đăng nhập",
                social_provider_text: "Đăng nhập với {{provider}}",
                link_text: "Đã có tài khoản? Đăng nhập"
              },
            },
          }}
          additionalData={{
            sign_up: {
              first_name: {
                label: "Họ",
                placeholder: "Nhập họ của bạn"
              },
              last_name: {
                label: "Tên",
                placeholder: "Nhập tên của bạn"
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default Login;