import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import KocMobileNav from "@/components/koc/KocMobileNav";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Icons
import { Bot, Wand2, FileSignature, UserCircle, Sigma, MessageSquare, Loader2, AlignLeft, Settings2, Trash2, Edit, MoreHorizontal, Check, ChevronsUpDown, CheckSquare, Eye, BrainCircuit } from "lucide-react";

// Custom Components
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";

// Type Definitions
type Koc = { id: string; name: string; };
type VideoScript = {
  id: string;
  name: string;
  script_content: string | null;
  created_at: string;
  kocs: { name: string } | null;
};

// Form Schema
const scriptFormSchema = z.object({
  name: z.string().min(1, "Tên kịch bản không được để trống."),
  kocId: z.string().min(1, "Vui lòng chọn KOC."),
  content: z.string().min(1, "Nội dung gốc không được để trống."),
  model: z.string().min(1, "Vui lòng chọn model AI."),
  maxWords: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  toneOfVoice: z.string().optional(),
  writingStyle: z.string().optional(),
  writingMethod: z.string().optional(),
  aiRole: z.string().optional(),
  mandatoryRequirements: z.string().optional(),
  exampleDialogue: z.string().optional(),
  generationMethod: z.enum(['gemini_api', 'vertex_ai']).default('gemini_api'),
});

// Data Fetching Functions
const fetchKocs = async (userId: string) => {
  const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', userId).order('name', { ascending: true });
  if (error) throw error;
  return data as Koc[];
};
const fetchVideoScripts = async (userId: string) => {
  const { data, error } = await supabase.from('video_scripts').select('*, kocs(name)').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as VideoScript[];
};

const TaoContent = () => {
  const [generatedScript, setGeneratedScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [isViewScriptOpen, setIsViewScriptOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<VideoScript | null>(null);

  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: kocs = [], isLoading: isLoadingKocs } = useQuery<Koc[]>({
    queryKey: ['kocs_for_script', user?.id],
    queryFn: () => fetchKocs(user!.id),
    enabled: !!user,
  });
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery<VideoScript[]>({
    queryKey: ['video_scripts', user?.id],
    queryFn: () => fetchVideoScripts(user!.id),
    enabled: !!user,
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const { error } = await supabase.from('video_scripts').delete().eq('id', scriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa kịch bản thành công!");
      queryClient.invalidateQueries({ queryKey: ['video_scripts', user?.id] });
      setScriptToDelete(null);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const form = useForm<z.infer<typeof scriptFormSchema>>({
    resolver: zodResolver(scriptFormSchema),
    defaultValues: { 
      name: "", 
      kocId: "", 
      content: "",
      model: "gemini-1.5-pro-001",
      toneOfVoice: "hài hước",
      writingStyle: "kể chuyện, sử dụng văn nói",
      writingMethod: "Sử dụng câu ngắn, đi thẳng vào vấn đề",
      aiRole: "Đóng vai là 1 người tự quay video tiktok để nói chuyện, chia sẻ tự nhiên, nghĩ gì nói đó.",
      mandatoryRequirements: "",
      exampleDialogue: "",
      generationMethod: 'gemini_api',
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (values: z.infer<typeof scriptFormSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const selectedKoc = kocs.find(koc => koc.id === values.kocId);
      if (!selectedKoc) throw new Error("Không tìm thấy KOC đã chọn.");

      const detailedPrompt = `
- Tông giọng: ${values.toneOfVoice || 'chuyên nghiệp, hấp dẫn'}
- Văn phong: ${values.writingStyle || 'kể chuyện, sử dụng văn nói'}
- Cách viết: ${values.writingMethod || 'sử dụng câu ngắn, đi thẳng vào vấn đề'}
- Vai trò AI: ${values.aiRole || 'Một chuyên gia sáng tạo nội dung'}
- Yêu cầu bắt buộc: ${values.mandatoryRequirements || 'Không có'}
${values.exampleDialogue ? `- Lời thoại ví dụ (để tham khảo văn phong): ${values.exampleDialogue}` : ''}
      `.trim();

      const functionName = values.generationMethod === 'vertex_ai' ? "generate-script-vertex-ai" : "generate-video-script";
      const body = {
        prompt: detailedPrompt,
        newsContent: values.content,
        kocName: selectedKoc.name,
        maxWords: values.maxWords,
        model: values.model,
        userId: user.id, // Pass userId for gemini_api
      };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error);

      return { scriptContent: data.script, prompt: data.prompt, values };
    },
    onSuccess: async ({ scriptContent, prompt, values }) => {
      setGeneratedScript(scriptContent);
      
      if (user) {
        const { error: insertError } = await supabase.from('video_scripts').insert({
          user_id: user.id,
          name: values.name,
          koc_id: values.kocId,
          script_content: scriptContent,
          ai_prompt: prompt,
        });

        if (insertError) {
          showError(`Lưu kịch bản thất bại: ${insertError.message}`);
        } else {
          showSuccess("Tạo và lưu kịch bản thành công!");
          queryClient.invalidateQueries({ queryKey: ['video_scripts', user?.id] });
        }
      }
    },
    onError: (error: Error) => {
      showError(`Lỗi tạo kịch bản: ${error.message}`);
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });

  const onSubmit = (values: z.infer<typeof scriptFormSchema>) => {
    setIsGenerating(true);
    setGeneratedScript("");
    generateScriptMutation.mutate(values);
  };

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="md:hidden">
          <KocMobileNav />
        </div>
        <header className="mb-8"><h1 className="text-3xl font-bold">Công cụ Content</h1><p className="text-muted-foreground mt-1">Sử dụng AI để tạo nội dung video từ nội dung có sẵn.</p></header>
        
        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-semibold p-4 bg-card rounded-lg border hover:no-underline data-[state=open]:rounded-b-none"><div className="flex items-center gap-3"><Wand2 className="h-5 w-5 text-primary" />Tạo kịch bản video</div></AccordionTrigger>
            <AccordionContent className="p-6 border border-t-0 rounded-b-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Cấu hình</h3>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileSignature className="h-4 w-4 mr-2" />Tên kịch bản</FormLabel><FormControl><Input placeholder="Ví dụ: Kịch bản tin tức Campuchia" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="kocId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="flex items-center"><UserCircle className="h-4 w-4 mr-2" />Tạo cho KOC</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>{field.value ? kocs.find((koc) => koc.id === field.value)?.name : "Chọn KOC"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Tìm KOC..." /><CommandList><CommandEmpty>Không tìm thấy KOC.</CommandEmpty><CommandGroup>{kocs.map((koc) => (<CommandItem value={koc.name} key={koc.id} onSelect={() => { form.setValue("kocId", koc.id);}}><Check className={cn("mr-2 h-4 w-4", koc.id === field.value ? "opacity-100" : "opacity-0")}/>{koc.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="content" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><AlignLeft className="h-4 w-4 mr-2" />Nội dung gốc</FormLabel><FormControl><Textarea placeholder="Nhập nội dung bạn muốn AI chuyển thành kịch bản video..." {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
                      
                      <FormField control={form.control} name="generationMethod" render={({ field }) => (<FormItem className="space-y-3"><FormLabel className="flex items-center"><Settings2 className="h-4 w-4 mr-2" />Phương thức tạo</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="gemini_api" /></FormControl><FormLabel className="font-normal">API Gemini</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="vertex_ai" /></FormControl><FormLabel className="font-normal">Vertex AI</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Bot className="h-4 w-4 mr-2" />Model AI</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn model AI" /></SelectTrigger></FormControl><SelectContent><SelectItem value="gemini-1.5-pro-001">Gemini 1.5 Pro</SelectItem><SelectItem value="gemini-1.5-flash-001">Gemini 1.5 Flash</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="maxWords" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Sigma className="h-4 w-4 mr-2" />Số từ tối đa</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="toneOfVoice" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><MessageSquare className="h-4 w-4 mr-2" />Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: hài hước, chuyên nghiệp..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="writingStyle" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileSignature className="h-4 w-4 mr-2" />Văn phong</FormLabel><FormControl><Textarea placeholder="Ví dụ: kể chuyện, sử dụng văn nói..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="writingMethod" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><AlignLeft className="h-4 w-4 mr-2" />Cách viết</FormLabel><FormControl><Textarea placeholder="Ví dụ: Sử dụng câu ngắn, đi thẳng vào vấn đề..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="aiRole" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Bot className="h-4 w-4 mr-2" />Vai trò AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Đóng vai là 1 người tự quay video tiktok để nói chuyện..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="mandatoryRequirements" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><CheckSquare className="h-4 w-4 mr-2" />Yêu cầu bắt buộc</FormLabel><FormControl><Textarea placeholder="Ví dụ: Không nhắc đến đối thủ cạnh tranh..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="exampleDialogue" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><MessageSquare className="h-4 w-4 mr-2" />Lời thoại ví dụ</FormLabel><FormControl><Textarea placeholder="Ví dụ: 'Hello mọi người, lại là mình đây! Hôm nay có tin gì hot hòn họt nè...'" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      
                      <Button type="submit" className="w-full" disabled={generateScriptMutation.isPending}>{generateScriptMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</> : <><Wand2 className="mr-2 h-4 w-4" /> Tạo kịch bản</>}</Button>
                    </form>
                  </Form>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Kịch bản</h3>
                  <Card className="min-h-[400px] flex items-center justify-center">
                    <CardContent className="p-4 w-full">
                      {isGenerating ? <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div>
                      : generatedScript ? <pre className="whitespace-pre-wrap text-sm font-sans">{generatedScript}</pre>
                      : <p className="text-center text-muted-foreground">Kết quả kịch bản sẽ hiển thị ở đây.</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Card className="mt-8">
          <CardHeader><CardTitle>Kịch bản đã tạo</CardTitle><CardDescription>Danh sách các kịch bản đã được tạo bằng AI.</CardDescription></CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox /></TableHead><TableHead>Tên kịch bản</TableHead><TableHead>KOC</TableHead><TableHead>Nội dung</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoadingScripts ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  : scripts.length > 0 ? scripts.map((script) => (
                    <TableRow key={script.id}>
                      <TableCell><Checkbox /></TableCell>
                      <TableCell className="font-medium">{script.name}</TableCell>
                      <TableCell>{script.kocs?.name || 'N/A'}</TableCell>
                      <TableCell><Button variant="link" className="p-0 h-auto" onClick={() => { setSelectedScript(script); setIsViewScriptOpen(true); }}>Xem chi tiết</Button></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Sửa</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setScriptToDelete(script)}><Trash2 className="mr-2 h-4 w-4" />Xóa</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="h-24 text-center">Chưa có kịch bản nào được tạo.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden">
              <div className="space-y-3">
                {isLoadingScripts ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
                ) : scripts.length > 0 ? (
                  scripts.map((script) => (
                    <Card key={script.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <p className="font-semibold">{script.name}</p>
                            <p className="text-sm text-muted-foreground">KOC: {script.kocs?.name || 'N/A'}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedScript(script); setIsViewScriptOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" /> Xem nội dung
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" /> Sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setScriptToDelete(script)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="h-24 text-center flex flex-col items-center justify-center text-muted-foreground">
                    <p>Chưa có kịch bản nào được tạo.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ViewScriptContentDialog isOpen={isViewScriptOpen} onOpenChange={setIsViewScriptOpen} title={selectedScript?.name || null} content={selectedScript?.script_content || null} />
      <AlertDialog open={!!scriptToDelete} onOpenChange={(isOpen) => !isOpen && setScriptToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Kịch bản "{scriptToDelete?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => scriptToDelete && deleteScriptMutation.mutate(scriptToDelete.id)} disabled={deleteScriptMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteScriptMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
};

export default TaoContent;