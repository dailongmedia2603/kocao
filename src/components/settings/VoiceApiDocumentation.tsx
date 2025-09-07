import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCopy } from "lucide-react";
import { Button } from "../ui/button";
import { showSuccess } from "@/utils/toast";

const CodeBlock = ({ code, lang = "json" }: { code: string; lang?: string }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    showSuccess("Đã sao chép vào clipboard!");
  };

  return (
    <div className="relative group mt-2">
      <pre className="bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto">
        <code className={`language-${lang}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        <ClipboardCopy className="h-4 w-4" />
      </Button>
    </div>
  );
};

const getBadgeClass = (method: string) => {
  switch (method.toUpperCase()) {
    case "POST": return "bg-blue-100 text-blue-800";
    case "GET": return "bg-green-100 text-green-800";
    case "DELETE": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export const VoiceApiDocumentation = () => {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Tài liệu API GenAIPro Voice</CardTitle>
        <CardDescription>
          Hướng dẫn tích hợp và sử dụng các endpoint để chuyển văn bản thành giọng nói.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full space-y-2">
          <AccordionItem value="create-task">
            <AccordionTrigger className="font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge className={getBadgeClass("POST")}>POST</Badge>
                <span className="font-mono">/api/elevenlabs/task</span>
                <span>Tạo task mới</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <h4 className="font-semibold mb-2">Request Body</h4>
              <Table>
                <TableHeader><TableRow><TableHead>Tham số</TableHead><TableHead>Bắt buộc</TableHead><TableHead>Loại</TableHead><TableHead>Mô tả</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell>input</TableCell><TableCell>Có</TableCell><TableCell>string</TableCell><TableCell>Văn bản để chuyển thành giọng nói</TableCell></TableRow>
                  <TableRow><TableCell>voice_id</TableCell><TableCell>Có</TableCell><TableCell>string</TableCell><TableCell>ID giọng nói</TableCell></TableRow>
                  <TableRow><TableCell>model_id</TableCell><TableCell>Có</TableCell><TableCell>enum</TableCell><TableCell><code>eleven_multilingual_v2</code>, <code>eleven_turbo_v2_5</code></TableCell></TableRow>
                  <TableRow><TableCell>call_back_url</TableCell><TableCell>Không</TableCell><TableCell>string</TableCell><TableCell>URL callback khi hoàn thành</TableCell></TableRow>
                </TableBody>
              </Table>
              <h4 className="font-semibold mt-4">Phản hồi</h4>
              <CodeBlock code={`{\n  "task_id": "task-uuid"\n}`} />
              <h4 className="font-semibold mt-4">Ví dụ cURL</h4>
              <CodeBlock lang="bash" code={`curl -X POST "https://genaipro.vn/api/elevenlabs/task" \\\n  -H "Authorization: Bearer <api-token>" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "input": "Hello world",\n    "voice_id": "voice-id-from-voices-list",\n    "model_id": "eleven_multilingual_v2"\n  }'`} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="get-task-detail">
            <AccordionTrigger className="font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge className={getBadgeClass("GET")}>GET</Badge>
                <span className="font-mono">/api/elevenlabs/task/:task_id</span>
                <span>Lấy chi tiết task</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <h4 className="font-semibold mb-2">Phản hồi</h4>
              <CodeBlock code={`{\n  "id": "task-uuid",\n  "input": "Hello world",\n  "status": "completed",\n  "result": "https://genaipro.vn/files/file.mp3",\n  "subtitle": "https://genaipro.vn/files/file.srt",\n  "created_at": "2024-01-01T00:00:00Z"\n}`} />
              <h4 className="font-semibold mt-4">Ví dụ cURL</h4>
              <CodeBlock lang="bash" code={`curl -X GET "https://genaipro.vn/api/elevenlabs/task/task-uuid" \\\n  -H "Authorization: Bearer <api-token>"`} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="get-task-history">
            <AccordionTrigger className="font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge className={getBadgeClass("GET")}>GET</Badge>
                <span className="font-mono">/api/elevenlabs/task</span>
                <span>Lấy lịch sử task</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <h4 className="font-semibold mb-2">Query Parameters</h4>
              <Table>
                <TableHeader><TableRow><TableHead>Tham số</TableHead><TableHead>Loại</TableHead><TableHead>Mô tả</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell>page</TableCell><TableCell>number</TableCell><TableCell>Số trang, mặc định là 1</TableCell></TableRow>
                  <TableRow><TableCell>limit</TableCell><TableCell>number</TableCell><TableCell>Số lượng task mỗi trang, mặc định là 20</TableCell></TableRow>
                </TableBody>
              </Table>
              <h4 className="font-semibold mt-4">Ví dụ cURL</h4>
              <CodeBlock lang="bash" code={`curl -X GET "https://genaipro.vn/api/elevenlabs/task?page=1&limit=10" \\\n  -H "Authorization: Bearer <api-token>"`} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="get-user-info">
            <AccordionTrigger className="font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge className={getBadgeClass("GET")}>GET</Badge>
                <span className="font-mono">/api/me</span>
                <span>Lấy thông tin người dùng</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <h4 className="font-semibold mb-2">Phản hồi</h4>
              <CodeBlock code={`{\n  "id": "user-uuid",\n  "username": "user",\n  "balance": 10000,\n  "credits": [\n    {\n      "amount": 11000000,\n      "expire_at": "2025-08-08T03:51:00+07:00"\n    }\n  ]\n}`} />
              <h4 className="font-semibold mt-4">Ví dụ cURL</h4>
              <CodeBlock lang="bash" code={`curl -X GET "https://genaipro.vn/api/me" \\\n  -H "Authorization: Bearer <api-token>"`} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="delete-task">
            <AccordionTrigger className="font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge className={getBadgeClass("DELETE")}>DELETE</Badge>
                <span className="font-mono">/api/elevenlabs/task/:task_id</span>
                <span>Xóa task</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <h4 className="font-semibold mb-2">Phản hồi</h4>
              <CodeBlock code={`{\n  "message": "Task deleted successfully"\n}`} />
              <h4 className="font-semibold mt-4">Ví dụ cURL</h4>
              <CodeBlock lang="bash" code={`curl -X DELETE "https://genaipro.vn/api/elevenlabs/task/task-uuid" \\\n  -H "Authorization: Bearer <api-token>"`} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};