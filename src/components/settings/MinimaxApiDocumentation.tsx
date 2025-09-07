import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCopy } from "lucide-react";
import { Button } from "../ui/button";
import { showSuccess } from "@/utils/toast";

const CodeBlock = ({ code }: { code: string }) => {
  const handleCopy = () => { navigator.clipboard.writeText(code); showSuccess("Đã sao chép!"); };
  return (
    <div className="relative group mt-2">
      <pre className="bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto"><code>{code}</code></pre>
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100" onClick={handleCopy}><ClipboardCopy className="h-4 w-4" /></Button>
    </div>
  );
};

const getBadgeClass = (method: string) => ({
  "POST": "bg-blue-100 text-blue-800", "GET": "bg-green-100 text-green-800", "DELETE": "bg-red-100 text-red-800",
}[method.toUpperCase()] || "bg-gray-100 text-gray-800");

export const MinimaxApiDocumentation = () => (
  <Card className="mt-8">
    <CardHeader><CardTitle>Tài liệu API Minimax Voice</CardTitle><CardDescription>Hướng dẫn sử dụng các endpoint để chuyển văn bản thành giọng nói.</CardDescription></CardHeader>
    <CardContent>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="tts-pro"><AccordionTrigger className="font-semibold hover:no-underline"><div className="flex items-center gap-3"><Badge className={getBadgeClass("POST")}>POST</Badge><span className="font-mono">/text_to_speech/pro</span><span>Tạo giọng nói</span></div></AccordionTrigger>
          <AccordionContent className="pt-4"><h4 className="font-semibold mb-2">Request Body</h4><CodeBlock code={`{\n  "voice_id": "string",\n  "text": "string",\n  "model": "string",\n  "speed": float,\n  "vol": float,\n  "pitch": float\n}`} /><h4 className="font-semibold mt-4">Phản hồi</h4><p>File âm thanh (audio/mpeg).</p></AccordionContent>
        </AccordionItem>
        <AccordionItem value="voices"><AccordionTrigger className="font-semibold hover:no-underline"><div className="flex items-center gap-3"><Badge className={getBadgeClass("GET")}>GET</Badge><span className="font-mono">/text_to_speech/voices</span><span>Lấy danh sách giọng nói</span></div></AccordionTrigger>
          <AccordionContent className="pt-4"><h4 className="font-semibold mb-2">Phản hồi</h4><CodeBlock code={`{\n  "voices": [\n    {\n      "voice_id": "string",\n      "name": "string"\n    }\n  ]\n}`} /></AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);