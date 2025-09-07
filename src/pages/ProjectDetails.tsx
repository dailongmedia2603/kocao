import { useParams } from "react-router-dom";

const ProjectDetails = () => {
  const { projectId } = useParams();
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">
          Trang Chi Tiết Dự Án
        </h1>
        <p className="mt-2 text-gray-500">
          Thông tin chi tiết cho Dự án ID: {projectId}
        </p>
      </div>
    </div>
  );
};

export default ProjectDetails;