import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Video, CheckCircle, PlayCircle } from 'lucide-react';

interface KocVideoSelectorProps {
  onSelectionChange: (selection: { videoUrl: string | null; kocId: string | null }) => void;
  selectedVideoUrl: string | null;
}

interface KocVideo {
  id: string;
  url: string;
  display_name: string;
  thumbnail_url: string | null;
}

export const KocVideoSelector = ({ onSelectionChange, selectedVideoUrl }: KocVideoSelectorProps) => {
  const [selectedKocId, setSelectedKocId] = useState<string | null>(null);

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['kocs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kocs').select('id, name').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: videos, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['koc_videos', selectedKocId],
    queryFn: async () => {
      if (!selectedKocId) return [];
      const { data, error } = await supabase.functions.invoke('get-koc-videos', {
        body: { kocId: selectedKocId }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.data as KocVideo[];
    },
    enabled: !!selectedKocId,
  });

  const handleKocChange = (kocId: string) => {
    setSelectedKocId(kocId);
    onSelectionChange({ videoUrl: null, kocId });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">1. Chọn KOC</label>
        {isLoadingKocs ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select onValueChange={handleKocChange} value={selectedKocId || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn một KOC..." />
            </SelectTrigger>
            <SelectContent>
              {kocs?.map(koc => (
                <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedKocId && (
        <div>
          <label className="text-sm font-medium">2. Chọn Video Nguồn</label>
          {isLoadingVideos ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-md" />)}
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2 max-h-64 overflow-y-auto p-2 rounded-md border">
              {videos.map((video: KocVideo) => (
                <div
                  key={video.id}
                  onClick={() => onSelectionChange({ videoUrl: video.url, kocId: selectedKocId })}
                  className={`relative aspect-video rounded-md overflow-hidden cursor-pointer border-2 group ${selectedVideoUrl === video.url ? 'border-red-500' : 'border-transparent'}`}
                >
                   {video.thumbnail_url ? (
                     <img src={video.thumbnail_url} alt={video.display_name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-200">
                       <Video className="h-8 w-8 text-slate-500" />
                     </div>
                   )}
                   <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                     <PlayCircle className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                  {selectedVideoUrl === video.url && (
                    <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full p-0.5">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs font-medium truncate">{video.display_name}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert className="mt-2">
              <AlertTitle>Không tìm thấy video</AlertTitle>
              <AlertDescription>KOC này chưa có video nguồn nào. Vui lòng tải video lên trong trang quản lý KOC.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};