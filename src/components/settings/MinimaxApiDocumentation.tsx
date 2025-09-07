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

const CodeBlock = ({ code }: { code: string }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    showSuccess("Đã sao chép!");
  };
  return (
    <div className="relative group mt-2">
      <pre className="bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={handleCopy}
      >
        <ClipboardCopy className="h-4 w-4" />
      </Button>
    </div>
  );
};

const getBadgeClass = (method: string) =>
  ({
    POST: "bg-blue-100 text-blue-800",
    GET: "bg-green-100 text-green-800",
    DELETE: "bg-red-100 text-red-800",
  }[method.toUpperCase()] || "bg-gray-100 text-gray-800");

const Endpoint = ({
  method,
  path,
  title,
  children,
}: {
  method: string;
  path: string;
  title: string;
  children: React.ReactNode;
}) => (
  <AccordionItem value={path}>
    <AccordionTrigger className="font-semibold hover:no-underline text-left">
      <div className="flex items-center gap-3">
        <Badge className={getBadgeClass(method)}>{method}</Badge>
        <span className="font-mono">{path}</span>
        <span>{title}</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="pt-4 space-y-4">
      {children}
    </AccordionContent>
  </AccordionItem>
);

export const MinimaxApiDocumentation = () => (
  <Card className="mt-8">
    <CardHeader>
      <CardTitle>Tài liệu API Minimax Voice</CardTitle>
      <CardDescription>
        Hướng dẫn sử dụng các endpoint để chuyển văn bản thành giọng nói.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <Endpoint method="POST" path="/v1/text_to_speech/pro" title="Tạo giọng nói (Task)">
          <p>Tạo một tác vụ chuyển văn bản thành giọng nói.</p>
          <h4 className="font-semibold">Request Body</h4>
          <CodeBlock code={`{\n  "voice_id": "string",\n  "text": "string",\n  "model": "string",\n  "speed": float,\n  "vol": float,\n  "pitch": float\n}`} />
          <h4 className="font-semibold">Phản hồi</h4>
          <p>File âm thanh (audio/mpeg).</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/text_to_speech/tasks/{task_id}" title="Lấy chi tiết Task">
          <p>Lấy thông tin chi tiết của một tác vụ đã tạo.</p>
          <h4 className="font-semibold">Phản hồi</h4>
          <CodeBlock code={`{\n  "task_id": "string",\n  "status": "string",\n  "audio_url": "string"\n}`} />
        </Endpoint>

        <Endpoint method="GET" path="/v1/text_to_speech/tasks" title="Lấy danh sách Tasks">
          <p>Lấy danh sách các tác vụ đã được tạo.</p>
        </Endpoint>

        <Endpoint method="DELETE" path="/v1/text_to_speech/tasks/{task_id}" title="Xóa Task">
          <p>Xóa một tác vụ đã tạo.</p>
        </Endpoint>

        <Endpoint method="POST" path="/v1/voice_clone" title="Clone giọng nói">
          <p>Tạo một giọng nói mới bằng cách tải lên các file âm thanh.</p>
          <h4 className="font-semibold">Request Body (multipart/form-data)</h4>
          <Table>
            <TableHeader><TableRow><TableHead>Tham số</TableHead><TableHead>Loại</TableHead><TableHead>Mô tả</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>name</TableCell><TableCell>string</TableCell><TableCell>Tên của giọng nói clone</TableCell></TableRow>
              <TableRow><TableCell>files</TableCell><TableCell>file[]</TableCell><TableCell>Các file âm thanh mẫu</TableCell></TableRow>
            </TableBody>
          </Table>
        </Endpoint>

        <Endpoint method="GET" path="/v1/voice_clone" title="Lấy danh sách giọng nói đã clone">
          <p>Lấy danh sách các giọng nói bạn đã clone.</p>
        </Endpoint>

        <Endpoint method="DELETE" path="/v1/voice_clone/{voice_id}" title="Xóa giọng nói đã clone">
          <p>Xóa một giọng nói bạn đã clone.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/text_to_speech/voices" title="Lấy danh sách giọng nói có sẵn">
          <p>Lấy danh sách các giọng nói có sẵn để sử dụng.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/billing/credits" title="Lấy thông tin Credits">
          <p>Kiểm tra số credits còn lại trong tài khoản.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/common_config" title="Lấy cấu hình chung">
          <p>Lấy các thông tin cấu hình chung của dịch vụ.</p>
        </Endpoint>

        <Endpoint method="GET" path="/health" title="Kiểm tra Health Check">
          <p>Kiểm tra trạng thái hoạt động của dịch vụ.</p>
        </Endpoint>
      </Accordion>
    </CardContent>
  </Card>
);