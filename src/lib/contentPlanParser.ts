export interface ParsedContentPlan {
  title: string;
  strategy: string;
  pillars: { title: string; content: string }[];
  schedule: string;
  ideas: { title: string; script: string }[];
}

const extractContentByTag = (text: string, tag: string): string => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

export function parseContentPlan(text: string): ParsedContentPlan {
  // Check if the content uses the new tag-based format
  if (text.includes('<TITLE>')) {
    return parseWithTags(text);
  }
  // Fallback to the old markdown-based format
  return parseWithMarkdown(text);
}

function parseWithTags(text: string): ParsedContentPlan {
  const result: ParsedContentPlan = {
    title: '',
    strategy: '',
    pillars: [],
    schedule: '',
    ideas: [],
  };

  result.title = extractContentByTag(text, 'TITLE') || 'Kế hoạch nội dung';
  result.strategy = extractContentByTag(text, 'STRATEGY');
  result.schedule = extractContentByTag(text, 'SCHEDULE');

  const pillarsBlock = extractContentByTag(text, 'PILLARS');
  if (pillarsBlock) {
    const pillarRegex = /<PILLAR>([\s\S]*?)<\/PILLAR>/gi;
    let match;
    while ((match = pillarRegex.exec(pillarsBlock)) !== null) {
      const pillarContent = match[1];
      const title = extractContentByTag(pillarContent, 'PILLAR_TITLE');
      const content = extractContentByTag(pillarContent, 'PILLAR_CONTENT');
      if (title && content) {
        result.pillars.push({ title, content });
      }
    }
  }

  const ideasBlock = extractContentByTag(text, 'IDEAS');
  if (ideasBlock) {
    const ideaRegex = /<IDEA>([\s\S]*?)<\/IDEA>/gi;
    let match;
    while ((match = ideaRegex.exec(ideasBlock)) !== null) {
      const ideaContent = match[1];
      const title = extractContentByTag(ideaContent, 'IDEA_TITLE');
      const script = extractContentByTag(ideaContent, 'IDEA_SCRIPT');
      if (title && script) {
        result.ideas.push({ title, script });
      }
    }
  }

  return result;
}

function parseWithMarkdown(markdown: string): ParsedContentPlan {
    const result: ParsedContentPlan = {
        title: '',
        strategy: '',
        pillars: [],
        schedule: '',
        ideas: [],
    };

    const titleMatch = markdown.match(/^#\s*(.*)/);
    result.title = titleMatch ? titleMatch[1].trim() : 'Kế hoạch nội dung';

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

    const strategyHeading = /\d+\.\s*\*\*Chiến lược tổng thể\*\*/i;
    const pillarsHeading = /\d+\.\s*\*\*Các trụ cột nội dung chính\*\*/i;
    const scheduleHeading = /\d+\.\s*\*\*Lịch đăng đề xuất\*\*/i;
    const ideasHeading = /\d+\..*?\*\*.*?Ý tưởng video chi tiết\*\*/i;

    result.strategy = getContentBetween(strategyHeading, pillarsHeading);
    const pillarsBlock = getContentBetween(pillarsHeading, scheduleHeading);
    result.schedule = getContentBetween(scheduleHeading, ideasHeading);
    const ideasBlock = getContentBetween(ideasHeading, /(\n\s*Hy vọng kế hoạch này|\n\s*$)/i);

    if (pillarsBlock) {
        const pillarRegex = /\d+\.\s*\*\*\"([^\"]+)\"\*\*:\s*([\s\S]*?)(?=\n\d+\.\s*\*\*|\n*$)/g;
        let match;
        while ((match = pillarRegex.exec(pillarsBlock)) !== null) {
            result.pillars.push({
                title: `Cột ${result.pillars.length + 1}: "${match[1]}"`,
                content: match[2].trim(),
            });
        }
    }

    if (ideasBlock) {
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