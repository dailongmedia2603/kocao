import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Extensions = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Extensions</h1>
          <p className="text-muted-foreground mt-1">Thêm và quản lý các extensions của bạn.</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Thêm Extension
        </Button>
      </header>
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <h3 className="text-xl font-semibold">Chức năng đang được phát triển</h3>
        <p className="text-muted-foreground mt-2">Phần quản lý extensions sẽ sớm được ra mắt.</p>
      </div>
    </div>
  );
};

export default Extensions;