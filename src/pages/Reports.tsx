import { useIsMobile } from "@/hooks/use-mobile";
import KocMobileNav from "@/components/koc/KocMobileNav";

const Reports = () => {
  const isMobile = useIsMobile();
  return (
    <div className="p-4 md:p-6 lg:p-8">
      {isMobile && <KocMobileNav />}
      <h1 className="text-3xl font-bold">Report</h1>
      <p className="mt-2 text-gray-600">
        Trang này đang trong quá trình phát triển.
      </p>
    </div>
  );
};

export default Reports;