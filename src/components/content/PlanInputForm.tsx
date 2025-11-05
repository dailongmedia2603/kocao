import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wand2, Loader2 } from "lucide-react";

const formSchema = z.object({
  koc_id: z.string().min(1, "Vui lòng chọn KOC."),
  name: z.string().min(1, "Tên kế hoạch không được để trống."),
  topic: z.string().min(1, "Chủ đề chính không được để trống."),
  target_audience: z.string().min(1, "Vui lòng mô tả đối tượng mục tiêu."),
  koc_persona: z.string().min(1, "Vui lòng mô tả chân dung KOC."),
  goals: z.string().optional(),
  competitors: z.string().optional(),
});

type PlanInputFormProps = {
  planId: string | null;
};

export const PlanInputForm = ({ planId }: PlanInputFormProps) => {
  const { user } = useSession();
  const isNew = planId === null;

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['kocs_for_plan', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      koc_id: "",
      name: "",
      topic: "",
      target_audience: "",
      koc_persona: "",
      goals: "",
      competitors: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Logic xử lý submit sẽ được thêm ở Giai đoạn 4
    console.log(values);
  };

  if (!isNew) {
    // Logic lấy dữ liệu plan đã có sẽ được thêm ở đây
    return <Skeleton className="h-[500px] w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Nhập thông tin</CardTitle>
        <CardDescription>Cung cấp thông tin càng chi tiết, AI sẽ đề xuất càng chính xác.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="koc_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Dành cho KOC</FormLabel>
                {isLoadingKocs ? <Skeleton className="h-10 w-full" /> : (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn một KOC" /></SelectTrigger></FormControl>
                    <SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên kế hoạch</FormLabel><FormControl><Input placeholder="Ví dụ: Kế hoạch xây kênh review mỹ phẩm" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="topic" render={({ field }) => (<FormItem><FormLabel>Chủ đề chính</FormLabel><FormControl><Input placeholder="Ví dụ: Review mỹ phẩm cho da dầu mụn" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="target_audience" render={({ field }) => (<FormItem><FormLabel>Đối tượng mục tiêu</FormLabel><FormControl><Textarea placeholder="Mô tả độ tuổi, giới tính, sở thích, vấn đề họ gặp phải..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="koc_persona" render={({ field }) => (<FormItem><FormLabel>Chân dung KOC</FormLabel><FormControl><Textarea placeholder="Mô tả tính cách, phong cách nói chuyện (hài hước, chuyên gia, gần gũi...)" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="goals" render={({ field }) => (<FormItem><FormLabel>Mục tiêu kênh (Tùy chọn)</FormLabel><FormControl><Input placeholder="Ví dụ: Đạt 10,000 followers trong 3 tháng" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="competitors" render={({ field }) => (<FormItem><FormLabel>Kênh tham khảo (Tùy chọn)</FormLabel><FormControl><Textarea placeholder="Liệt kê một vài link kênh đối thủ hoặc kênh bạn muốn học hỏi" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full" disabled={true}>
              <Wand2 className="mr-2 h-4 w-4" /> Tạo kế hoạch bằng AI (Sắp ra mắt)
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};