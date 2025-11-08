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

const MORE_IDEAS_DEFAULT_PROMPT = `
Based on the following content strategy, generate 10 new, creative, and distinct video ideas.
Do not repeat any of the existing ideas provided below.

**Content Strategy:**
- Overall Strategy: {{STRATEGY}}
- Content Pillars: {{PILLARS}}
- Target Audience: {{TARGET_AUDIENCE}}
- KOC/Channel Info: {{KOC_INFO}}

**Existing Video Ideas (Do NOT repeat these):**
{{EXISTING_IDEAS}}

Your response must be a valid JSON array of 10 objects. Each object must have this exact structure:
{
  "pillar": "string",
  "topic": "string",
  "description": "string"
}
The "pillar" value must be one of the provided Content Pillars.
`.trim();

const MORE_IDEAS_DYNAMIC_VARIABLES = [
  { variable: "{{STRATEGY}}", description: "Chiến lược tổng thể (từ kết quả)" },
  { variable: "{{PILLARS}}", description: "Các trụ cột nội dung (từ kết quả)" },
  { variable: "{{TARGET_AUDIENCE}}", description: "Đối tượng mục tiêu (từ input)" },
  { variable: "{{KOC_INFO}}", description: "Thông tin KOC (từ input)" },
  { variable: "{{EXISTING_IDEAS}}", description: "Danh sách các ý tưởng đã có" },
];

type ConfigurePromptDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

type PromptEditorProps = {
  templateType: 'content_plan_gemini' | 'generate_more_ideas_gemini';
};

const PromptEditor = ({ templateType }: PromptEditorProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  
  const isMoreIdeasPrompt = templateType === 'generate_more_ideas_gemini';
  const defaultPrompt = isMoreIdeasPrompt ? MORE_IDEAS_DEFAULT_PROMPT : DEFAULT_PROMPT;
  const dynamicVariables = isMoreIdeasPrompt ? MORE_IDEAS_DYNAMIC_VARIABLES : DYNAMIC_VARIABLES;

  const [prompt, setPrompt] = useState(defaultPrompt);

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
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.content) {
      setPrompt(data.content);
    } else {
      setPrompt(defaultPrompt);
    }
  }, [data, defaultPrompt]);

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
          {dynamicVariables.map(({ variable, description }) => (
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cấu hình Prompt Tạo Kế Hoạch</DialogTitle>
          <DialogDescription>Tùy chỉnh prompt sẽ được gửi đến AI để tạo kế hoạch nội dung.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create_plan" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create_plan">Tạo Kế hoạch</TabsTrigger>
            <TabsTrigger value="more_ideas">Tạo thêm Idea</TabsTrigger>
          </TabsList>
          <TabsContent value="create_plan" className="pt-4">
            <PromptEditor templateType="content_plan_gemini" />
          </TabsContent>
          <TabsContent value="more_ideas" className="pt-4">
            <PromptEditor templateType="generate_more_ideas_gemini" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};