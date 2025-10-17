import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Library, CheckCircle, Loader2, AlertCircle, Music, Mic, Check } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type VoiceTask = {
  id: string;
  voice_name: string;
  audio_url: string;
  created_at: string;
};

type VoiceTaskGroup = {
  voice_name: string;
  tasks: VoiceTask[];
};

type VoiceTaskSelectorProps = {
  onAudioUrlSelect: (url: string | null) => void;
  selectedAudioUrl: string | null;
};

export const VoiceTaskSelector = ({ onAudioUrlSelect, selectedAudioUrl }: VoiceTaskSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelectedUrl, setTempSelectedUrl] = useState<string | null>(selectedAudioUrl);
  const [selectedTaskName, setSelectedTaskName] = useState<string | null>(null);
  const { user } = useSession();

  const { data: groupedTasks, isLoading, isError, error } = useQuery<VoiceTaskGroup[]>({
    queryKey: ['completed_voice_tasks_grouped', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_completed_voice_tasks_grouped', { p_user_id: user.id });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!user,
  });

  useEffect(() => {
    if (isOpen) {
      setTempSelectedUrl(selectedAudioUrl);
    }
  }, [isOpen, selectedAudioUrl]);

  const handleConfirm = () => {
    onAudioUrlSelect(tempSelectedUrl);
    const selectedTask = groupedTasks?.flatMap(g => g.tasks).find(t => t.audio_url === tempSelectedUrl);
    setSelectedTaskName(selectedTask?.voice_name || null);
    setIsOpen(false);
  };

  if (selectedAudioUrl) {
    return (
      <div className="p-4 border-2 border-dashed rounded-lg bg-green-50 border-green-200 text-green-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6" />
          <div>
            <p className="font-semibold">Đã chọn file âm thanh:</p>
            <p className="text-sm">{selectedTaskName || 'Một file từ thư viện'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onAudioUrlSelect(null)}>Thay đổi</Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" className="w-full h-20 border-dashed" onClick={() => setIsOpen(true)}>
        <Library className="mr-2 h-5 w-5" />
        Chọn từ Thư viện Âm thanh
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Chọn file âm thanh từ Thư viện</DialogTitle>
            <DialogDescription>Chọn một file âm thanh đã được tạo trước đó.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4 mt-4">
            {isLoading && <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
            {isError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
            {groupedTasks && groupedTasks.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-3">
                {groupedTasks.map((group) => (
                  <AccordionItem key={group.voice_name} value={group.voice_name} className="border rounded-lg bg-background/50">
                    <AccordionTrigger className="p-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 text-purple-600"><Mic className="h-5 w-5" /></div><span className="font-semibold">{group.voice_name}</span></div>
                        <Badge variant="secondary">{group.tasks.length} files</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      <div className="space-y-2 border-t pt-4">
                        {group.tasks.map((task) => (
                          <div key={task.id} onClick={() => setTempSelectedUrl(task.audio_url)} className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${tempSelectedUrl === task.audio_url ? 'bg-red-50 border-red-200' : 'hover:bg-muted'}`}>
                            <div className="flex-grow space-y-2">
                              <div className="flex items-center gap-2">
                                {tempSelectedUrl === task.audio_url && <Check className="h-4 w-4 text-red-600" />}
                                <p className="font-medium text-sm">{task.voice_name}</p>
                              </div>
                              <audio controls src={task.audio_url} className="h-8 w-full" onClick={(e) => e.stopPropagation()} />
                            </div>
                            <p className="text-xs text-muted-foreground flex-shrink-0 ml-4">{format(new Date(task.created_at), 'dd/MM/yyyy')}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (!isLoading && !isError && <div className="text-center py-10 text-muted-foreground"><Music className="mx-auto h-12 w-12" /><p className="mt-4">Không có file âm thanh nào đã hoàn thành.</p></div>)}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Hủy</Button>
            <Button onClick={handleConfirm} disabled={!tempSelectedUrl}>{tempSelectedUrl ? 'Xác nhận' : 'Vui lòng chọn một file'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};