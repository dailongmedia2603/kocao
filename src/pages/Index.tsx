import React from 'react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Chào mừng bạn đến với ứng dụng</h1>
        <p className="text-lg text-gray-600 mb-8">Điều hướng đến các trang khác bằng các liên kết bên dưới.</p>
        <nav className="space-x-4">
          <Link to="/list-koc" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
            Danh sách KOC
          </Link>
          <Link to="/projects" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Dự án
          </Link>
          <Link to="/about" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
            Giới thiệu
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default Index;