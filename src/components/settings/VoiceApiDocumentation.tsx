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
        <span className="font-mono text-sm">{path}</span>
        <span>{title}</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="pt-4 space-y-4">
      {children}
    </AccordionContent>
  </AccordionItem>
);

export const VoiceApiDocumentation = () => (
  <Card className="mt-8">
    <CardHeader>
      <CardTitle>Tài liệu API GenAIPro Voice</CardTitle>
      <CardDescription>
        Hướng dẫn sử dụng các endpoint để tương tác với dịch vụ voice.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <Endpoint method="GET" path="/v1m/common/config" title="Lấy Cấu hình Chung">
          <p>Lấy các thông tin cấu hình chung như model, ngôn ngữ hỗ trợ, v.v.</p>
        </Endpoint>

        <Endpoint method="POST" path="/v1m/task/text-to-speech" title="Tạo Task Chuyển văn bản thành giọng nói">
          <p>Tạo một tác vụ TTS. Hỗ trợ xử lý đồng bộ và bất đồng bộ.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/task/{task_id}" title="Lấy Chi tiết Task">
          <p>Lấy thông tin chi tiết của một tác vụ bằng ID. Dùng để polling nếu không sử dụng webhook.</p>
        </Endpoint>
        
        <Endpoint method="GET" path="/v1/tasks" title="Lấy Danh sách Tasks">
          <p>Lấy danh sách các tác vụ của người dùng với phân trang.</p>
        </Endpoint>

        <Endpoint method="POST" path="/v1/task/delete" title="Xóa Task">
          <p>Xóa các tác vụ và nhận lại credits (nếu có).</p>
        </Endpoint>

        <Endpoint method="POST" path="/v1m/voice/clone" title="Clone Giọng nói">
          <p>Tải lên file âm thanh để tạo một giọng nói tùy chỉnh.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1m/voice/clone" title="Lấy Danh sách Giọng nói đã Clone">
          <p>Lấy danh sách tất cả các giọng nói do người dùng sở hữu.</p>
        </Endpoint>

        <Endpoint method="DELETE" path="/v1m/voice/clone/{voice_clone_id}" title="Xóa Giọng nói đã Clone">
          <p>Xóa một giọng nói đã clone và tất cả các tham chiếu của nó.</p>
        </Endpoint>

        <Endpoint method="POST" path="/v1m/voice/list" title="Lấy Danh sách Giọng nói có sẵn">
          <p>Lấy danh sách các giọng nói có sẵn từ dịch vụ.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/credits" title="Lấy Thông tin Credits">
          <p>Trả về tổng số credits khả dụng của người dùng hiện tại.</p>
        </Endpoint>

        <Endpoint method="GET" path="/v1/health-check" title="Kiểm tra Health Check">
          <p>Kiểm tra trạng thái hoạt động của dịch vụ.</p>
        </Endpoint>
      </Accordion>
    </CardContent>
  </Card>
);