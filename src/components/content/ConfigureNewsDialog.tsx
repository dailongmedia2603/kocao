import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess } from "@/utils/toast";

const formSchema = z.object({
  fanpageId: z.string().min(1, "ID Fanpage không được để trống."),
  scanInterval: z.string().min(1, "Vui lòng chọn tần suất quét."),
  useAI: z.boolean().default(false),
  aiPrompt: z.string().optional(),
});

type ConfigureNewsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const ConfigureNewsDialog = ({ isOpen, onOpenChange }: ConfigureNewsDialogProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fanpageId: "",
      scanInterval: "hourly",
      useAI: false,
      aiPrompt: "Tóm tắt bài viết thành một kịch bản voice ngắn gọn, hấp dẫn, phù hợp để đọc trong video ngắn.",
    },
  });

  const useAI = form.watch("useAI");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("Configuration saved:", values);
    showSuccess("Đã lưu cấu hình!");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Cấu hình quét tin tức</DialogTitle>
          <DialogDescription>
            Thiết lập nguồn và tần suất quét tin tức mới từ Fanpage Facebook.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="fanpageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Fanpage</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: 100064582455502" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scanInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tần suất quét</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tần suất" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="30min">Mỗi 30 phút</SelectItem>
                      <SelectItem value="hourly">Mỗi giờ</SelectItem>
                      <SelectItem value="4hours">Mỗi 4 giờ</SelectItem>
                      <SelectItem value="daily">Hàng ngày</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="useAI"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Sử dụng AI để tạo kịch bản voice</FormLabel>
                    <FormDescription>
                      Tự động tạo kịch bản voice từ nội dung bài viết.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {useAI && (
              <FormField
                control={form.control}
                name="aiPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yêu cầu cho AI</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mô tả yêu cầu của bạn cho AI..."
                        className="resize-y min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit">Lưu cấu hình</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};