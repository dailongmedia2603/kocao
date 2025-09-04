import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Film } from 'lucide-react';

type VideoThumbnailProps = {
  videoUrl: string;
};

export const VideoThumbnail = ({ videoUrl }: VideoThumbnailProps) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateThumbnail = () => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous'; // Cần thiết nếu video từ một domain khác
      video.src = videoUrl;
      video.currentTime = 0.1; // Lấy khung hình ở giây 0.1 để đảm bảo video đã load

      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL('image/jpeg'));
        }
        setIsLoading(false);
      };

      video.onerror = () => {
        // Nếu có lỗi khi tải video (ví dụ: CORS), hiển thị placeholder
        setIsLoading(false);
      };
    };

    generateThumbnail();
  }, [videoUrl]);

  if (isLoading) {
    return <Skeleton className="w-full h-full" />;
  }

  if (thumbnail) {
    return <img src={thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />;
  }

  // Fallback nếu không thể tạo thumbnail
  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <Film className="h-12 w-12 text-gray-600" />
    </div>
  );
};