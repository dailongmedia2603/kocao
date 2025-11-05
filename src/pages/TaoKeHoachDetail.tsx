import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PlanInputForm } from "@/components/content/PlanInputForm";
import { PlanResultDisplay } from "@/components/content/PlanResultDisplay";

const TaoKeHoachDetail = () => {
  const { planId } = useParams<{ planId: string }>();
  const isNew = planId === 'new';

  return (
    <div className="p-6 lg:p-8">
      <Link to="/tao-ke-hoach" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{isNew ? "Tạo Kế Hoạch Nội Dung Mới" : "Chi Tiết Kế Hoạch"}</h1>
        <p className="text-muted-foreground mt-1">
          {isNew ? "Điền thông tin để AI phân tích và đề xuất chiến lược nội dung." : "Xem lại thông tin và kết quả phân tích của kế hoạch."}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <PlanInputForm planId={isNew ? null : planId} />
        <PlanResultDisplay planId={isNew ? null : planId} />
      </div>
    </div>
  );
};

export default TaoKeHoachDetail;