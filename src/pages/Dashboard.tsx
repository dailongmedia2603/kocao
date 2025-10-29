import Logo from "../components/Logo";

const Dashboard = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] p-4 text-center">
      <Logo className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">DrXAIKOC</h1>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
        Hệ thống tạo KOC chuyên nghiệp. Giải pháp Automation từ tạo content đến video hoàn chỉnh
      </p>
    </div>
  );
};

export default Dashboard;