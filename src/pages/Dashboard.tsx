const Dashboard = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] p-4 text-center">
      <img src="/logokocao.png" alt="DrXAIKOC Logo" className="h-48 w-48 mb-6 object-contain" />
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">DrXAIKOC</h1>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
        Hệ thống tạo KOC chuyên nghiệp. Giải pháp Automation từ tạo content đến video hoàn chỉnh
      </p>
    </div>
  );
};

export default Dashboard;