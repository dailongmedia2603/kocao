import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Projects = () => {
  return (
    <div className="p-6 lg:p-8">
      <Link to="/" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại trang chủ
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Danh sách dự án</h1>
        <p className="text-muted-foreground mt-1">Quản lý tất cả các dự án của bạn ở một nơi.</p>
      </header>
      <div className="bg-white p-6 rounded-lg border text-center">
        <p>Tính năng danh sách dự án sẽ được xây dựng ở đây.</p>
      </div>
    </div>
  );
};

export default Projects;