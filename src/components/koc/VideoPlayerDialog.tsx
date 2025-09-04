import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type VideoPlayerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  videoUrl?: string;
  videoName?: string;
};

export const VideoPlayerDialog = ({ isOpen, onOpenChange, videoUrl, videoName }: VideoPlayerDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{videoName}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-black rounded-lg overflow-hidden mt-4">
          {videoUrl && (
            <video
              key={videoUrl} // Key change forces re-render
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