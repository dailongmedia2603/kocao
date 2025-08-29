import { useParams } from "react-router-dom";

const ProjectDetails = () => {
  const { projectId } = useParams();

  return (
    <div>
      <h1 className="text-3xl font-bold">Chi tiết Dự án: {projectId}</h1>
      {/* Bảng tác vụ và chức năng sẽ được thêm ở bước sau */}
    </div>
  );
};

export default ProjectDetails;