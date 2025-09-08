import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { showSuccess, showError } from "@/utils/toast";
import { Upload, Trash2, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  fanpageIds: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Bạn phải chọn ít nhất một fanpage.",
  }),
  scanInterval: z.string().min(1, "Vui lòng chọn tần suất quét."),
  useAI: z.boolean().default(false),
  aiPrompt: z.string().optional(),
});

type Fanpage = {
  dbId: string;
  id: string;
  name: string;
};

type ConfigureNewsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const ConfigureNewsDialog = ({ isOpen, onOpenChange }: ConfigureNewsDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: fanpages = [], isLoading: isLoadingFanpages } = useQuery<Fanpage[]>({
    queryKey: ['news_sources', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('news_sources')
        .select('id, source_id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return data.map(item => ({ dbId: item.id, id: item.source_id, name: item.name }));
    },
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fanpageIds: [],
      scanInterval: "hourly",
      useAI: false,
      aiPrompt: "Tóm tắt bài viết thành một kịch bản voice ngắn gọn, hấp dẫn, phù hợp để đọc trong video ngắn.",
    },
  });

  const useAI = form.watch("useAI");

  const addFanpagesMutation = useMutation({
    mutationFn: async (newFanpages: { source_id: string; name: string; user_id: string }[]) => {
      const { error } = await supabase.from('news_sources').insert(newFanpages);
      if (error && error.code !== '23505') {
        throw error;
      }
      return newFanpages.length;
    },
    onSuccess: () => {
      showSuccess("Import danh sách thành công!");
      queryClient.invalidateQueries({ queryKey: ['news_sources', user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi import: ${error.message}`),
  });

  const deleteFanpageMutation = useMutation({
    mutationFn: async (dbId: string) => {
      const { error } = await supabase.from('news_sources').delete().eq('id', dbId);
      if (error) throw error;
      return dbId;
    },
    onSuccess: (dbId) => {
      showSuccess("Đã xóa Fanpage.");
      queryClient.invalidateQueries({ queryKey: ['news_sources', user?.id] });
      const fanpageToDelete = fanpages.find(fp => fp.dbId === dbId);
      if (fanpageToDelete) {
        form.setValue("fanpageIds", form.getValues("fanpageIds").filter(fpId => fpId !== fanpageToDelete.id));
      }
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<{ 'ID Fanpage / Group': string; 'Tên Fanpage / Group': string }>(worksheet);
        
        const parsedFanpages = json.map((row) => ({
          id: String(row['ID Fanpage / Group']),
          name: String(row['Tên Fanpage / Group']),
        })).filter(fp => fp.id && fp.name);

        if (parsedFanpages.length > 0 && user) {
          const existingSourceIds = new Set(fanpages.map(fp => fp.id));
          const fanpagesToInsert = parsedFanpages
            .filter(fp => !existingSourceIds.has(fp.id))
            .map(fp => ({ source_id: fp.id, name: fp.name, user_id: user.id }));
          
          if (fanpagesToInsert.length > 0) {
            addFanpagesMutation.mutate(fanpagesToInsert);
          } else {
            showSuccess("Không có Fanpage mới nào để import.");
          }
        }
      } catch (error) {
        showError("File không đúng định dạng. Vui lòng kiểm tra lại.");
      }
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("Configuration saved:", values);
    showSuccess("Đã lưu cấu hình!");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Cấu hình quét tin tức</DialogTitle>
          <DialogDescription>Quản lý danh sách Fanpage và thiết lập các tùy chọn quét tin tức tự động.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="config" className="w-full pt-4">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="config">Cấu hình</TabsTrigger><TabsTrigger value="fanpages">Danh sách Fanpage / Group</TabsTrigger></TabsList>
          <TabsContent value="config">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="fanpageIds" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Chọn Fanpage / Group</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}>{field.value?.length ? `${field.value.length} đã chọn` : "Chọn Fanpage..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[650px] p-0"><Command><CommandInput placeholder="Tìm kiếm..." /><CommandList><CommandEmpty>Không tìm thấy.</CommandEmpty><CommandGroup>{fanpages.map((fanpage) => (<CommandItem value={fanpage.name} key={fanpage.id} onSelect={() => { const selected = field.value || []; const isSelected = selected.includes(fanpage.id); form.setValue("fanpageIds", isSelected ? selected.filter((id) => id !== fanpage.id) : [...selected, fanpage.id]);}}><Check className={cn("mr-2 h-4 w-4", field.value?.includes(fanpage.id) ? "opacity-100" : "opacity-0")} />{fanpage.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="scanInterval" render={({ field }) => (
                  <FormItem><FormLabel>Tần suất quét</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn tần suất" /></SelectTrigger></FormControl><SelectContent><SelectItem value="30min">Mỗi 30 phút</SelectItem><SelectItem value="hourly">Mỗi giờ</SelectItem><SelectItem value="4hours">Mỗi 4 giờ</SelectItem><SelectItem value="daily">Hàng ngày</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="useAI" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Sử dụng AI để tạo kịch bản voice</FormLabel><FormDescription>Tự động tạo kịch bản voice từ nội dung bài viết.</FormDescription></div></FormItem>
                )} />
                {useAI && (<FormField control={form.control} name="aiPrompt" render={({ field }) => (
                  <FormItem><FormLabel>Yêu cầu cho AI</FormLabel><FormControl><Textarea placeholder="Mô tả yêu cầu của bạn cho AI..." className="resize-y min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />)}
                <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button type="submit">Lưu cấu hình</Button></DialogFooter>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="fanpages">
            <div className="space-y-4 pt-4">
              <div className="flex justify-end"><Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={addFanpagesMutation.isPending}>{addFanpagesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import Excel</Button><input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileImport} /></div>
              <div className="rounded-md border max-h-80 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Tên Fanpage / Group</TableHead><TableHead>ID</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingFanpages ? (<TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>)
                    : fanpages.length > 0 ? (fanpages.map((fp) => (<TableRow key={fp.dbId}><TableCell className="font-medium">{fp.name}</TableCell><TableCell>{fp.id}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteFanpageMutation.mutate(fp.dbId)} disabled={deleteFanpageMutation.isPending && deleteFanpageMutation.variables === fp.dbId}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell></TableRow>)))
                    : (<TableRow><TableCell colSpan={3} className="h-24 text-center">Chưa có Fanpage nào.</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};