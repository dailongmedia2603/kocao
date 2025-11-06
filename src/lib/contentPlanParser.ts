export interface ParsedContentPlan {
  title: string;
  strategy: string;
  pillars: { title: string; content: string }[];
  schedule: string;
  ideas: { title: string; script: string }[];
}

export function parseContentPlan(markdown: string): ParsedContentPlan {
  const result: ParsedContentPlan = {
    title: '',
    strategy: '',
    pillars: [],
    schedule: '',
    ideas: [],
  };

  // Extract Title
  const titleMatch = markdown.match(/#\s*(KẾ HOẠCH NỘI DUNG TIKTOK CHO KOC ".*")/i);
  result.title = titleMatch ? titleMatch[1] : 'Kế hoạch nội dung';

  // Extract Strategy
  const strategyMatch = markdown.match(/\*\*1\.\s*Chiến lược tổng thể\*\*\s*([\s\S]*?)(?=\n\*\*2\.|\n## 2\.|$)/i);
  result.strategy = strategyMatch ? strategyMatch[1].trim() : 'Không có thông tin.';

  // Extract Pillars
  const pillarsBlockMatch = markdown.match(/\*\*2\.\s*Các trụ cột nội dung chính\*\*\s*([\s\S]*?)(?=\n\*\*3\.|\n## 3\.|$)/i);
  if (pillarsBlockMatch) {
    const pillarRegex = /\d+\.\s*Cột \d+:\s*"([^"]+)"\s*([\s\S]*?)(?=\n\d+\.\s*Cột \d+:|\n\*\*|$)/gi;
    let match;
    while ((match = pillarRegex.exec(pillarsBlockMatch[1])) !== null) {
      result.pillars.push({
        title: `Cột ${result.pillars.length + 1}: "${match[1]}"`,
        content: match[2].trim(),
      });
    }
  }

  // Extract Schedule
  const scheduleMatch = markdown.match(/\*\*3\.\s*Lịch đăng đề xuất\*\*\s*([\s\S]*?)(?=\n\*\*4\.|\n## 4\.|$)/i);
  result.schedule = scheduleMatch ? scheduleMatch[1].trim() : 'Không có thông tin.';

  // Extract Ideas
  const ideasBlockMatch = markdown.match(/\*\*4\..*?Ý tưởng video chi tiết\*\*\s*([\s\S]*)/i);
  if (ideasBlockMatch) {
    const ideaSplits = ideasBlockMatch[1].split(/\*\*\s*Tiêu đề video hấp dẫn\s*:\*\*/i).filter(s => s.trim() !== '');
    ideaSplits.forEach(split => {
      const lines = split.trim().split('\n');
      const title = lines[0].trim();
      const script = lines.slice(1).join('\n').replace(/\*\*\s*Kịch bản chi tiết\s*:\*\*/i, '').trim();
      if (title) {
        result.ideas.push({ title, script });
      }
    });
  }

  return result;
}