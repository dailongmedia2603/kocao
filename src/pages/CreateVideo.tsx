import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, PlusCircle, Bot, MousePointerClick, UploadCloud, MoreHorizontal } from "lucide-react";

const mockSteps = [
  {
    id: 1,
    name: "Điều hướng đến trang Facebook",
    description: "Mở trình duyệt và truy cập URL được chỉ định.",
    icon: Bot,
  },
  {
    id: 2,
    name: "Bấm vào nút 'Tạo bài viết'",
    description: "Tìm và nhấp vào phần tử có selector: .create-post-button",
    icon: MousePointerClick,
  },
  {
    id: 3,
    name: "Tải lên video",
    description: "Tải lên tệp 'intro.mp4' vào ô input.",
    icon: UploadCloud,
  },
];

const CreateVideoPage = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Tạo kịch bản mới</h1>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <span>Home</span>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-gray-700">Tạo video</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white">Lưu bản nháp</Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white">Lưu và Bắt đầu</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tên kịch bản</CardTitle>
              <CardDescription>Đặt một cái tên dễ nhớ cho kịch bản tự động hóa của bạn.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input placeholder="Ví dụ: Tự động đăng video giới thiệu sản phẩm" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Các bước thực hiện</CardTitle>
                <CardDescription>Kéo và thả để sắp xếp lại các bước.</CardDescription>
              </div>
              <Button variant="outline" className="bg-white">
                <PlusCircle className="h-4 w-4 mr-2" />
                Thêm bước
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSteps.map((step) => (
                  <div key={step.id} className="flex items-center p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-4">
                      <step.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-gray-800">{step.name}</p>
                      <p className="text-sm text-gray-500">{step.description}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Sửa</DropdownMenuItem>
                        <DropdownMenuItem>Nhân bản</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Xóa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình</CardTitle>
              <CardDescription>Các thiết lập nâng cao cho kịch bản.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Các tùy chọn cấu hình sẽ được thêm ở đây */}
              <p className="text-sm text-gray-500">Sắp có các tùy chọn cấu hình...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateVideoPage;