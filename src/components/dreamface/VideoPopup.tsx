import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type VideoPopupProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: any | null;
};

export const VideoPopup = ({ isOpen, onOpenChange, task }: VideoPopupProps) => {
  const videoUrl = task?.result_video_url;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{task?.title || "Xem Video"}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-black rounded-lg overflow-hidden mt-4 flex items-center justify-center">
          {videoUrl ? (
            <video
              key={videoUrl}
              controls
              autoPlay
              src={videoUrl}
              className="w-full h-full"
            >
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          ) : (
            <div className="text-white text-center p-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto" />
              <p className="mt-4">Đang xử lý link video, vui lòng đợi trong giây lát...</p>
              <p className="text-xs text-gray-400 mt-2">
                (Hệ thống đang tự động lấy link tải, bạn có thể đóng cửa sổ này và thử lại sau)
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};