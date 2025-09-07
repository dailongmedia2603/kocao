import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const About = () => {
  return (
    <div className="p-6 lg:p-8">
      <Link to="/" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại trang chủ
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Giới thiệu</h1>
        <p className="text-muted-foreground mt-1">Thông tin về ứng dụng này.</p>
      </header>
      <div className="bg-white p-6 rounded-lg border">
        <p>Đây là trang giới thiệu của ứng dụng quản lý KOC.</p>
      </div>
    </div>
  );
};

export default About;