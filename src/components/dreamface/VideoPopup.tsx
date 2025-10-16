import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { showError } from "@/utils/toast";

type VideoPopupProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: any | null;
};

export const VideoPopup = ({ isOpen, onOpenChange, task }: VideoPopupProps) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fetchUrlMutation = useMutation({
    mutationFn: async (task: any) => {
      const { data, error } = await supabase.functions.invoke("dreamface-get-download-url", {
        body: { 
          taskId: task.id,
          idpost: task.idpost,
          userId: task.user_id,
        }
      });
      if (error || data.error) throw new Error(error?.message || data.error);
      return data.data.videoUrl;
    },
    onSuccess: (url) => {
      if (url) {
        setVideoUrl(url);
      } else {
        showError("Video chưa sẵn sàng, vui lòng thử lại sau ít phút.");
        onOpenChange(false);
      }
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      onOpenChange(false);
    }
  });

  useEffect(() => {
    if (isOpen && task) {
      if (task.result_video_url) {
        setVideoUrl(task.result_video_url);
      } else {
        setVideoUrl(null); // Reset while fetching
        fetchUrlMutation.mutate(task);
      }
    }
  }, [isOpen, task]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{task?.title || "Xem Video"}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-black rounded-lg overflow-hidden mt-4 flex items-center justify-center">
          {fetchUrlMutation.isPending || !videoUrl ? (
            <div className="text-white text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto" />
              <p className="mt-4">Đang lấy thông tin video...</p>
            </div>
          ) : (
            <video
              key={videoUrl}
              controls
              autoPlay
              src={videoUrl}
              className="w-full h-full"
            >
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};