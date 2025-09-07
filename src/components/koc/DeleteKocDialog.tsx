import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Koc = {
  id: string;
  name: string;
};

type DeleteKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  koc: Koc | null;
};

export const DeleteKocDialog = ({ isOpen, onOpenChange, koc }: DeleteKocDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const deleteKocMutation = useMutation({
    mutationFn: async (kocToDelete: Koc) => {
      if (!kocToDelete) {
        throw new Error("Không có KOC nào được chọn để xóa.");
      }

      // Gọi edge function để xử lý việc xóa KOC và thư mục R2
      const { error } = await supabase.functions.invoke("delete-koc", {
        body: { kocId: kocToDelete.id },
      });

      if (error) {
        throw new Error(`Lỗi xóa KOC: ${error.message}`);
      }
    },
    onSuccess: () => {
      showSuccess("Xóa KOC và thư mục trên R2 thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleDelete = () => {
    if (koc) {
      deleteKocMutation.mutate(koc);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa KOC?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn KOC "{koc?.name}", ảnh đại diện và tất cả các tệp trong thư mục R2 liên quan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteKocMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteKocMutation.isPending ? "Đang xóa..." : "Xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};