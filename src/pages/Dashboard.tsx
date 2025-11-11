import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

const Dashboard = () => {
  // TẠM THỜI: Luôn hiển thị quy trình hướng dẫn để kiểm tra.
  // Logic gốc sẽ được khôi phục sau khi bạn xác nhận.
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div>
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold">Chào mừng bạn đến với DrX AI KOC!</h1>
          <p className="text-muted-foreground mt-2">Hãy cùng nhau thiết lập những bước đầu tiên để bắt đầu hành trình sáng tạo của bạn.</p>
        </header>
        <OnboardingWizard />
      </div>
    </div>
  );
};

export default Dashboard;