import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(1, "Tên tác vụ không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại tác vụ"),
  url: z.string().url("Vui lòng nhập URL hợp lệ").optional().or(z.literal('')),
  // Fields for FORM_FILL_AND_SUBMIT
  formInputs: z.string().optional(),
  submitSelector: z.string().optional(),
  // Fields for FILE_UPLOAD_AND_SUBMIT
  file: z.instanceof(FileList).optional(),
  inputSelector: z.string().optional(),
});

type CreateTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
};

export const CreateTaskDialog = ({
  isOpen,
  onOpenChange,
  projectId,
}: CreateTaskDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      url: "",
      formInputs: "[]",
      submitSelector: "",
      inputSelector: "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      let payloadData: any = {};

      if (values.type === "FORM_FILL_AND_SUBMIT") {
        // Logic for form fill
        try {
          const inputs = values.formInputs ? JSON.parse(values.formInputs) : [];
          if (!Array.isArray(inputs)) throw new Error("Inputs phải là một mảng JSON.");
          if (!values.submitSelector) throw new Error("Vui lòng nhập CSS Selector cho nút gửi.");
          payloadData = {
            url: values.url,
            inputs: inputs,
            submitButton: values.submitSelector,
          };
        } catch (e: any) {
          showError(e.message);
          throw e;
        }
      } else if (values.type === "FILE_UPLOAD_AND_SUBMIT") {
        // Logic for file upload
        const file = values.file?.[0];
        if (!file) throw new Error("Vui lòng chọn một tệp để tải lên.");
        if (!values.url) throw new Error("Vui lòng nhập URL đích.");
        if (!values.inputSelector) throw new Error("Vui lòng nhập CSS Selector cho ô nhập tệp.");
        if (!values.submitSelector) throw new Error("Vui lòng nhập CSS Selector cho nút gửi.");

        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, file);

        if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);

        payloadData = {
          url: values.url,
          fileUrl: publicUrlData.publicUrl,
          fileName: file.name,
          fileType: file.type,
          inputSelector: values.inputSelector,
          submitButton: values.submitSelector,
        };
      }

      const { error } = await supabase.from("tasks").insert([
        {
          name: values.name,
          type: values.type,
          payload: payloadData,
          project_id: projectId,
          user_id: user.id,
          status: 'queued',
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tạo tác vụ thành công!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createTaskMutation.mutate(values);
  };

  const selectedType = form.watch("type");
  const fileRef = form.register("file");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm tác vụ mới</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên tác vụ</FormLabel>
                  <FormControl><Input placeholder="Ví dụ: Tải bài hát mới lên" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại tác vụ</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Chọn một loại tác vụ" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FORM_FILL_AND_SUBMIT">Điều hướng, Điền và Gửi Form</SelectItem>
                      <SelectItem value="FILE_UPLOAD_AND_SUBMIT">Tải tệp lên & Gửi</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {selectedType === "FORM_FILL_AND_SUBMIT" && (
              <>
                <FormField control={form.control} name="url" render={({ field }) => ( <FormItem> <FormLabel>URL đích (Tùy chọn)</FormLabel> <FormControl> <Input placeholder="https://example.com" {...field} /> </FormControl> <FormDescription>Nếu được cung cấp, extension sẽ truy cập URL này trước.</FormDescription> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="formInputs" render={({ field }) => ( <FormItem> <FormLabel>Dữ liệu Inputs (JSON)</FormLabel> <FormControl> <Textarea placeholder='[{"selector": "#email", "value": "test@example.com"}]' className="resize-none h-24 font-mono" {...field} /> </FormControl> <FormDescription>Một mảng JSON. Để trống `[]` nếu không cần điền form.</FormDescription> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="submitSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của nút Gửi/Bấm</FormLabel> <FormControl> <Input placeholder="Ví dụ: button.primary" {...field} /> </FormControl> <FormDescription>Selector của nút để bấm sau khi điền form.</FormDescription> <FormMessage /> </FormItem> )}/>
              </>
            )}

            {selectedType === "FILE_UPLOAD_AND_SUBMIT" && (
              <>
                <FormField control={form.control} name="url" render={({ field }) => ( <FormItem> <FormLabel>URL trang tải lên</FormLabel> <FormControl> <Input placeholder="https://soundcloud.com/upload" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="file" render={() => ( <FormItem> <FormLabel>Tệp tin</FormLabel> <FormControl> <Input type="file" {...fileRef} /> </FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="inputSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của ô chọn tệp</FormLabel> <FormControl> <Input placeholder="input[type='file']" {...field} /> </FormControl> <FormDescription>Selector của phần tử &lt;input type="file"&gt;.</FormDescription> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="submitSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của nút Gửi</FormLabel> <FormControl> <Input placeholder="button.primary" {...field} /> </FormControl> <FormDescription>Selector của nút để bấm sau khi chọn tệp.</FormDescription> <FormMessage /> </FormItem> )}/>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Đang tạo..." : "Thêm tác vụ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};