import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isToday } from 'date-fns';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Icons
import { Bot, Newspaper, Settings, History, FileText, CalendarClock, Voicemail, Wand2, ChevronDown, FileSignature, UserCircle, Sigma, MessageSquare, Loader2, Hash, AlignLeft, Settings2, Trash2, Edit, MoreHorizontal, Check, ChevronsUpDown } from "lucide-react";

// Custom Components
import { ConfigureNewsDialog } from "@/components/content/ConfigureNewsDialog";
import { NewsTable } from "@/components/content/NewsTable";
import { NewsScanLogDialog } from "@/components/content/NewsScanLogDialog";
import { StatCard } from "@/components/content/StatCard";
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";

// Type Definitions
type NewsPost = {
  id: string;
  content: string | null;
  created_time: string;
  status: string;
  source_name: string | null;
  voice_script: string | null;
  post_url: string | null;
};
type Koc = { id: string; name: string; };
type VideoScript = {
  id: string;
  name: string;
  script_content: string | null;
  created_at: string;
  kocs: { name: string } | null;
  news_posts: { content: string | null } | null;
};

// Form Schema
const scriptFormSchema = z.object({
  name: z.string().min(1, "Tên kịch bản không được để trống."),
  kocId: z.string().min(1, "Vui lòng chọn KOC."),
  newsPostId: z.string().min(1, "Vui lòng chọn tin tức."),
  maxWords: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  prompt: z.string().min(1, "Yêu cầu không được để trống."),
});

// Data Fetching Functions
const fetchNewsPosts = async (userId: string) => {
  const { data, error } = await supabase.from('news_posts').select('id, content, created_time, status, source_name, voice_script, post_url').eq('user_id', userId).order('created_time', { ascending: false }).limit(100);
  if (error) throw error;
  return data as NewsPost[];
};
const fetchKocs = async (userId: string) => {
  const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', userId).order('name', { ascending: true });
  if (error) throw error;
  return data as Koc[];
};
const fetchVideoScripts = async (userId: string) => {
  const { data, error } = await supabase.from('video_scripts').select('*, kocs(name), news_posts(content)').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as VideoScript[];
};

const TaoContent = () => {
  const [isConfigureOpen, setConfigureOpen] = useState(false);
  const [isLogOpen, setLogOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [isViewScriptOpen, setIsViewScriptOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<VideoScript | null>(null);

  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: news = [], isLoading: isLoadingNews } = useQuery<NewsPost[]>({
    queryKey: ['news_posts_for_script', user?.id],
    queryFn: () => fetchNewsPosts(user!.id),
    enabled: !!user,
  });
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
    defaultValues: { name: "", kocId: "", newsPostId: "", prompt: "Tóm tắt tin tức thành một kịch bản video ngắn gọn, hấp dẫn, phù hợp để đọc trong video ngắn." },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (values: z.infer<typeof scriptFormSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const selectedNews = news.find(post => post.id === values.newsPostId);
      const selectedKoc = kocs.find(koc => koc.id === values.kocId);

      if (!selectedNews || !selectedKoc) {
        throw new Error("Không tìm thấy tin tức hoặc KOC đã chọn.");
      }

      const { data, error } = await supabase.functions.invoke("generate-video-script", {
        body: {
          userId: user.id,
          prompt: values.prompt,
          newsContent: selectedNews.content,
          kocName: selectedKoc.name,
          maxWords: values.maxWords,
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      return { scriptContent: data.script, values };
    },
    onSuccess: async ({ scriptContent, values }) => {
      setGeneratedScript(scriptContent);
      
      if (user) {
        const { error: insertError } = await supabase.from('video_scripts').insert({
          user_id: user.id,
          name: values.name,
          koc_id: values.kocId,
          news_post_id: values.newsPostId,
          script_content: scriptContent,
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

  const totalPosts = news.length;
  const todayPosts = news.filter(post => isToday(new Date(post.created_time))).length;
  const voiceGeneratedPosts = news.filter(post => post.status === 'voice_generated').length;

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8"><h1 className="text-3xl font-bold">Công cụ Content</h1><p className="text-muted-foreground mt-1">Sử dụng AI để tạo nội dung mới hoặc cập nhật tin tức từ các nguồn có sẵn.</p></header>
        <Tabs defaultValue="create-content" className="w-full">
          <TabsList className="inline-flex h-auto items-center justify-center gap-1 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="create-content" className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Bot className="h-5 w-5" /></div>Tạo content</TabsTrigger>
            <TabsTrigger value="news" className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Newspaper className="h-5 w-5" /></div>Tin tức mới</TabsTrigger>
          </TabsList>
          <TabsContent value="create-content" className="mt-6">
            <Accordion type="single" collapsible className="w-full">
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
                          <FormField control={form.control} name="newsPostId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="flex items-center"><Newspaper className="h-4 w-4 mr-2" />Tin tức</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between text-left", !field.value && "text-muted-foreground")}>{field.value ? <span className="truncate">{news.find((post) => post.id === field.value)?.content}</span> : "Chọn tin tức"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Tìm tin tức..." /><CommandList><CommandEmpty>Không tìm thấy tin tức.</CommandEmpty><CommandGroup>{news.map((post) => (<CommandItem value={post.content || ""} key={post.id} onSelect={() => { form.setValue("newsPostId", post.id);}}><Check className={cn("mr-2 h-4 w-4", post.id === field.value ? "opacity-100" : "opacity-0")}/><span className="truncate">{post.content}</span></CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="maxWords" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Sigma className="h-4 w-4 mr-2" />Số từ tối đa</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="prompt" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><MessageSquare className="h-4 w-4 mr-2" />Yêu cầu chi tiết</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox /></TableHead><TableHead className="w-[50px]"><Hash className="h-4 w-4" /></TableHead><TableHead><FileText className="h-4 w-4" /></TableHead><TableHead><UserCircle className="h-4 w-4" /></TableHead><TableHead><Newspaper className="h-4 w-4" /></TableHead><TableHead><AlignLeft className="h-4 w-4" /></TableHead><TableHead className="text-right"><Settings2 className="h-4 w-4" /></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingScripts ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                    : scripts.length > 0 ? scripts.map((script, index) => (
                      <TableRow key={script.id}>
                        <TableCell><Checkbox /></TableCell>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{script.name}</TableCell>
                        <TableCell>{script.kocs?.name || 'N/A'}</TableCell>
                        <TableCell><p className="max-w-xs truncate">{script.news_posts?.content || 'N/A'}</p></TableCell>
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
                    )) : <TableRow><TableCell colSpan={7} className="h-24 text-center">Chưa có kịch bản nào được tạo.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="news" className="mt-6">
            <div className="grid gap-4 md:grid-cols-3 mb-6"><StatCard title="Tổng Post" value={isLoadingNews ? '...' : totalPosts} icon={FileText} color="bg-blue-100 text-blue-600" /><StatCard title="Post Hôm Nay" value={isLoadingNews ? '...' : todayPosts} icon={CalendarClock} color="bg-green-100 text-green-600" /><StatCard title="Đã Tạo Voice" value={isLoadingNews ? '...' : voiceGeneratedPosts} icon={Voicemail} color="bg-purple-100 text-purple-600" /></div>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold">Hộp thư tin tức</h2><div className="flex items-center gap-2"><Button variant="outline" onClick={() => setLogOpen(true)} className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200"><History className="mr-2 h-4 w-4" />Nhật ký</Button><Button onClick={() => setConfigureOpen(true)} className="bg-red-700 hover:bg-red-800 text-white"><Settings className="mr-2 h-4 w-4" />Cấu hình</Button></div></div>
            <NewsTable news={news} isLoading={isLoadingNews} />
          </TabsContent>
        </Tabs>
      </div>
      <ConfigureNewsDialog isOpen={isConfigureOpen} onOpenChange={setConfigureOpen} />
      <NewsScanLogDialog isOpen={isLogOpen} onOpenChange={setLogOpen} />
      <ViewScriptContentDialog isOpen={isViewScriptOpen} onOpenChange={setIsViewScriptOpen} title={selectedScript?.name || null} content={selectedScript?.script_content || null} />
      <AlertDialog open={!!scriptToDelete} onOpenChange={(isOpen) => !isOpen && setScriptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Kịch bản "{scriptToDelete?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => scriptToDelete && deleteScriptMutation.mutate(scriptToDelete.id)} disabled={deleteScriptMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteScriptMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaoContent;