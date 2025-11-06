import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_PROMPT = `
**ROLE:** You are a top-tier content strategist for TikTok.

**CONTEXT:** You are creating a content plan for a KOC named "{{KOC_NAME}}". Here is the provided information:
- **Main Topic:** {{TOPIC}}
- **Target Audience:** {{TARGET_AUDIENCE}}
- **KOC Persona (Personality & Style):** {{KOC_PERSONA}}
- **Channel Goals:** {{GOALS}}

**TASK:** Based on the context above, create a comprehensive, detailed, and easy-to-read content plan.

**OUTPUT REQUIREMENTS:**
You MUST format the output using the following custom tags. Do NOT use Markdown headings.

<TITLE>
Content Plan Title Here
</TITLE>

<STRATEGY>
A concise paragraph (3-4 sentences) summarizing the core content strategy.
</STRATEGY>

<PILLARS>
<PILLAR>
<PILLAR_TITLE>Pillar 1 Title</PILLAR_TITLE>
<PILLAR_CONTENT>Description of the first content pillar.</PILLAR_CONTENT>
</PILLAR>
<PILLAR>
<PILLAR_TITLE>Pillar 2 Title</PILLAR_TITLE>
<PILLAR_CONTENT>Description of the second content pillar.</PILLAR_CONTENT>
</PILLAR>
<PILLAR>
<PILLAR_TITLE>Pillar 3 Title</PILLAR_TITLE>
<PILLAR_CONTENT>Description of the third content pillar.</PILLAR_CONTENT>
</PILLAR>
</PILLARS>

<SCHEDULE>
Proposed posting schedule for the initial and maintenance phases.
</SCHEDULE>

<IDEAS>
<IDEA>
<IDEA_TITLE>Catchy Video Title 1</IDEA_TITLE>
<IDEA_SCRIPT>Detailed script (conversational style, ~150-250 words) including an opening hook, main points, and a call to action.</IDEA_SCRIPT>
</IDEA>
</IDEAS>

**IMPORTANT:** Adhere strictly to this tag-based format. Do not add any extra explanations, notes, or markdown formatting outside of the content within the tags.
`.trim();

const DYNAMIC_VARIABLES = [
  { variable: "{{KOC_NAME}}", description: "Tên của KOC" },
  { variable: "{{TOPIC}}", description: "Chủ đề chính của kế hoạch" },
  { variable: "{{TARGET_AUDIENCE}}", description: "Mô tả đối tượng mục tiêu" },
  { variable: "{{KOC_PERSONA}}", description: "Mô tả chân dung KOC" },
  { variable: "{{GOALS}}", description: "Mục tiêu của kênh" },
];

type ConfigurePromptDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const PromptEditor = ({ templateType }: { templateType: 'content_plan_gemini' | 'content_plan_gpt' }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  const { data, isLoading } = useQuery({
    queryKey: ['prompt_template', user?.id, templateType],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('content')
        .eq('user_id', user.id)
        .eq('template_type', templateType)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.content) {
      setPrompt(data.content);
    } else {
      setPrompt(DEFAULT_PROMPT);
    }
  }, [data]);

  const upsertMutation = useMutation({
    mutationFn: async (newContent: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from('prompt_templates').upsert({
        user_id: user.id,
        template_type: templateType,
        content: newContent,
      }, { onConflict: 'user_id, template_type' });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Lưu prompt thành công!");
      queryClient.invalidateQueries({ queryKey: ['prompt_template', user?.id, templateType] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess(`Đã sao chép: ${text}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-[400px] font-mono text-xs"
          disabled={isLoading}
        />
        <Button onClick={() => upsertMutation.mutate(prompt)} disabled={upsertMutation.isPending} className="mt-4 w-full">
          {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Lưu Prompt
        </Button>
      </div>
      <div className="space-y-3">
        <h4 className="font-semibold">Biến dữ liệu động</h4>
        <p className="text-xs text-muted-foreground">Bấm để sao chép và dán vào prompt của bạn.</p>
        <div className="space-y-2">
          {DYNAMIC_VARIABLES.map(({ variable, description }) => (
            <div key={variable} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
              <div>
                <code className="text-sm font-semibold">{variable}</code>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyToClipboard(variable)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ConfigurePromptDialog = ({ isOpen, onOpenChange }: ConfigurePromptDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cấu hình Prompt Tạo Kế Hoạch</DialogTitle>
          <DialogDescription>Tùy chỉnh prompt sẽ được gửi đến AI để tạo kế hoạch nội dung.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="gemini" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gemini">Prompt cho Gemini</TabsTrigger>
            <TabsTrigger value="gpt">Prompt cho GPT</TabsTrigger>
          </TabsList>
          <TabsContent value="gemini" className="pt-4">
            <PromptEditor templateType="content_plan_gemini" />
          </TabsContent>
          <TabsContent value="gpt" className="pt-4">
            <PromptEditor templateType="content_plan_gpt" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};