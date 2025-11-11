import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export const ReloadPrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      const toastId = toast.info('Có phiên bản mới!', {
        description: 'Một phiên bản mới của ứng dụng đã sẵn sàng. Cập nhật để trải nghiệm các tính năng mới nhất.',
        duration: Infinity,
        action: (
          <Button
            size="sm"
            onClick={() => {
              updateServiceWorker(true);
              toast.dismiss(toastId);
            }}
          >
            Cập nhật
          </Button>
        ),
        onDismiss: () => {
          setNeedRefresh(false);
        },
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
};