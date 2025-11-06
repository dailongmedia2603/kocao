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
  const titleMatch = markdown.match(/^#\s*(.*)/);
  result.title = titleMatch ? titleMatch[1].trim() : 'Kế hoạch nội dung';

  // Helper to get content between two headings or until the end
  const getContentBetween = (startHeading: RegExp, endHeading: RegExp): string => {
    const startMatch = markdown.match(startHeading);
    if (!startMatch) return '';
    
    const startIndex = startMatch.index! + startMatch[0].length;
    let content = markdown.substring(startIndex);
    
    const endMatch = content.match(endHeading);
    if (endMatch) {
      content = content.substring(0, endMatch.index!);
    }
    
    return content.trim();
  };

  // Define headings based on the AI's output format like "1. **Title**"
  const strategyHeading = /\d+\.\s*\*\*Chiến lược tổng thể\*\*/i;
  const pillarsHeading = /\d+\.\s*\*\*Các trụ cột nội dung chính\*\*/i;
  const scheduleHeading = /\d+\.\s*\*\*Lịch đăng đề xuất\*\*/i;
  const ideasHeading = /\d+\..*?\*\*.*?Ý tưởng video chi tiết\*\*/i;

  // Extract sections
  result.strategy = getContentBetween(strategyHeading, pillarsHeading);
  const pillarsBlock = getContentBetween(pillarsHeading, scheduleHeading);
  result.schedule = getContentBetween(scheduleHeading, ideasHeading);
  const ideasBlock = getContentBetween(ideasHeading, /(\n\s*Hy vọng kế hoạch này|\n\s*$)/i); // Match until the final sentence or end of string

  // Parse Pillars
  if (pillarsBlock) {
    // Matches format: 1. **"Pillar Title"**: Description
    const pillarRegex = /\d+\.\s*\*\*\"([^\"]+)\"\*\*:\s*([\s\S]*?)(?=\n\d+\.\s*\*\*|\n*$)/g;
    let match;
    while ((match = pillarRegex.exec(pillarsBlock)) !== null) {
      result.pillars.push({
        title: `Cột ${result.pillars.length + 1}: "${match[1]}"`,
        content: match[2].trim(),
      });
    }
  }

  // Parse Ideas
  if (ideasBlock) {
    // Split by "**Ý tưởng X:**" or "**Y tưởng X:**"
    const ideaSplits = ideasBlock.split(/\n\s*\*\*(?:Ý|Y) tưởng \d+:/i).filter(s => s.trim() !== '');
    ideaSplits.forEach(split => {
      const titleMatch = split.match(/\*\*Tiêu đề:\*\*\s*(.*)/);
      const scriptMatch = split.match(/\*\*Kịch bản:\*\*\s*([\s\S]*)/);
      
      const title = titleMatch ? titleMatch[1].trim() : '';
      const script = scriptMatch ? scriptMatch[1].trim() : '';

      if (title && script) {
        result.ideas.push({ title, script });
      }
    });
  }

  return result;
}