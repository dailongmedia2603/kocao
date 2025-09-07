import { useParams } from "react-router-dom";

const KocDetails = () => {
  const { kocId } = useParams();
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">
          Trang Chi Tiết KOC
        </h1>
        <p className="mt-2 text-gray-500">
          Thông tin chi tiết cho KOC ID: {kocId}
        </p>
      </div>
    </div>
  );
};

export default KocDetails;