export interface ParsedContentPlan {
  title: string;
  strategy: string;
  pillars: { title: string; content: string }[];
  schedule: string;
  ideas: { title: string; script: string }[];
}

const extractContent = (text: string, tag: string): string => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

export function parseContentPlan(text: string): ParsedContentPlan {
  const result: ParsedContentPlan = {
    title: '',
    strategy: '',
    pillars: [],
    schedule: '',
    ideas: [],
  };

  result.title = extractContent(text, 'TITLE') || 'Kế hoạch nội dung';
  result.strategy = extractContent(text, 'STRATEGY');
  result.schedule = extractContent(text, 'SCHEDULE');

  const pillarsBlock = extractContent(text, 'PILLARS');
  if (pillarsBlock) {
    const pillarRegex = /<PILLAR>([\s\S]*?)<\/PILLAR>/gi;
    let match;
    while ((match = pillarRegex.exec(pillarsBlock)) !== null) {
      const pillarContent = match[1];
      const title = extractContent(pillarContent, 'PILLAR_TITLE');
      const content = extractContent(pillarContent, 'PILLAR_CONTENT');
      if (title && content) {
        result.pillars.push({ title, content });
      }
    }
  }

  const ideasBlock = extractContent(text, 'IDEAS');
  if (ideasBlock) {
    const ideaRegex = /<IDEA>([\s\S]*?)<\/IDEA>/gi;
    let match;
    while ((match = ideaRegex.exec(ideasBlock)) !== null) {
      const ideaContent = match[1];
      const title = extractContent(ideaContent, 'IDEA_TITLE');
      const script = extractContent(ideaContent, 'IDEA_SCRIPT');
      if (title && script) {
        result.ideas.push({ title, script });
      }
    }
  }

  return result;
}