// ============================================================
// Automation Outline Service
// Generates structured, original outlines prior to complete article generation:
// - Analyzes search intent & keyword goals
// - Factors in competitor gaps (if available) without copying verbatim
// - Structures H1, H2 sections, H3 subsections, and FAQ questions
// - Fulfills outline approval / automated outline strategy requirements
// ============================================================

import type { CompetitorResearchResult } from './research-service';
import { resolveLanguage, formatLanguagePromptInstruction } from './language-config';

export interface OutlineSection {
  heading: string;
  level: 'H2' | 'H3';
  purpose: string;
  subtopics?: string[];
}

export interface GeneratedOutline {
  title: string;
  h1: string;
  searchIntent: string;
  sections: OutlineSection[];
  faqQuestions: string[];
  keyTakeaways: string[];
}

export interface OutlineGenerationParams {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  tone: string;
  targetLength: string;
  language?: string;
  structure: {
    introduction?: boolean;
    tableOfContents?: boolean;
    h2Sections?: boolean;
    h3Subsections?: boolean;
    faqSection?: boolean;
    conclusion?: boolean;
  };
  competitorResearch?: CompetitorResearchResult | null;
  userId: string;
}

/**
 * Generate an outline before drafting the article.
 */
export async function generateArticleOutline(
  params: OutlineGenerationParams
): Promise<GeneratedOutline> {
  const {
    topic,
    primaryKeyword,
    secondaryKeywords,
    tone,
    targetLength,
    language,
    structure,
    competitorResearch,
    userId,
  } = params;

  const langObj = resolveLanguage(language);

  // Infer search intent
  const normTopic = topic.toLowerCase();
  let intent = 'Informational';
  if (/^how to\b|step by step|guide/i.test(normTopic)) intent = 'How-To / Educational';
  else if (/^best\b|top \d+|comparison|vs/i.test(normTopic)) intent = 'Commercial Investigation / Buyer Guide';
  else if (/review|test|experience/i.test(normTopic)) intent = 'Product / Service Evaluation';

  // Build competitor intelligence notes if present
  let competitorContext = '';
  if (competitorResearch?.available && competitorResearch.pages.length > 0) {
    competitorContext = `
COMPETITOR RESEARCH INSIGHTS (DO NOT COPY VERBATIM - FILL TOPIC GAPS):
- Ranking competitor topics: ${competitorResearch.recommendedSubtopics.join(', ')}
- Unaddressed topic gaps to cover: ${competitorResearch.identifiedGaps.join('; ')}
`;
  }

  // Generate via AI provider if available
  try {
    const { resolveAiProviderForUser } = await import('@/lib/ai/platform-ai');
    const { executeChat } = await import('@/lib/ai/ai-service');
    const aiProvider = await resolveAiProviderForUser(userId, 'TEXT');

    if (aiProvider) {
      const prompt = `You are a senior editorial director and SEO strategist.
Create a comprehensive, original article outline for:
Topic: "${topic}"
Primary Keyword: "${primaryKeyword}"
Secondary Keywords: ${secondaryKeywords.length > 0 ? secondaryKeywords.join(', ') : 'None'}
Tone: ${tone}
Target Length: ${targetLength}
Search Intent: ${intent}
Target Language: ${langObj.name} (${langObj.code})
${competitorContext}
Structure Preferences:
- Include formal Intro: ${structure.introduction !== false}
- Table of Contents: ${structure.tableOfContents === true}
- H2 Sections: ${structure.h2Sections !== false}
- H3 Subsections: ${structure.h3Subsections !== false}
- FAQ Section: ${structure.faqSection === true}
- Conclusion: ${structure.conclusion !== false}

${formatLanguagePromptInstruction(langObj)}

CRITICAL RULES:
1. Do not copy competitor headings verbatim. Create original, search-optimized headings that deliver higher information gain.
2. Ensure logical, narrative progression.
3. Every section must have a clear purpose.
4. If FAQ is requested, provide 3-4 realistic questions searchers ask.
5. All text (title, headings, takeaways, FAQs) MUST be written in ${langObj.name}.

Return ONLY a valid JSON object with format:
{
  "title": "Compelling Title",
  "h1": "Exact H1 Headline",
  "searchIntent": "${intent}",
  "sections": [
    { "heading": "Section Heading", "level": "H2", "purpose": "Explanation of section value", "subtopics": ["point 1", "point 2"] },
    { "heading": "Subheading", "level": "H3", "purpose": "Deep dive point", "subtopics": [] }
  ],
  "faqQuestions": ["Question 1?", "Question 2?"],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"]
}`;

      const res = await executeChat({
        providerId: aiProvider.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        userId,
      });

      const cleanJson = res.content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return {
          title: parsed.title || topic,
          h1: parsed.h1 || parsed.title || topic,
          searchIntent: parsed.searchIntent || intent,
          sections: parsed.sections,
          faqQuestions: Array.isArray(parsed.faqQuestions) ? parsed.faqQuestions : [],
          keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
        };
      }
    }
  } catch (err) {
    console.warn('[OUTLINE_SERVICE] AI generation fallback:', err);
  }

  // Graceful deterministic outline fallback
  const fallbackSections: OutlineSection[] = [
    {
      heading: `Understanding ${primaryKeyword || topic}: Fundamentals and Core Concepts`,
      level: 'H2',
      purpose: 'Establish clear foundational context and fulfill immediate reader search intent.',
      subtopics: ['Key terminology', 'Why this matters now'],
    },
    {
      heading: `Key Strategies and Best Practices`,
      level: 'H2',
      purpose: 'Provide actionable, step-by-step guidance and practical methodologies.',
      subtopics: ['Core implementation steps', 'Workflow optimization'],
    },
  ];

  if (structure.h3Subsections !== false) {
    fallbackSections.push({
      heading: `Common Pitfalls and How to Avoid Them`,
      level: 'H3',
      purpose: 'Highlight typical mistakes and concrete preventative measures.',
      subtopics: ['Frequent misconceptions', 'Troubleshooting tips'],
    });
  }

  fallbackSections.push({
    heading: `Actionable Checklist for Getting Started`,
    level: 'H2',
    purpose: 'Deliver clear next steps and immediate implementation milestones.',
    subtopics: ['Initial setup checklist', 'Measuring progress'],
  });

  const faqQuestions = structure.faqSection
    ? [
        `What is the most effective way to implement ${primaryKeyword || topic}?`,
        `How long does it typically take to see measurable results?`,
        `What are the most common mistakes to avoid?`,
      ]
    : [];

  return {
    title: topic,
    h1: topic,
    searchIntent: intent,
    sections: fallbackSections,
    faqQuestions,
    keyTakeaways: [
      `Fulfill reader search intent immediately with verified best practices.`,
      `Follow structured implementation steps to avoid common failure modes.`,
    ],
  };
}

/**
 * Format outline into an instructions block to inject into the article pipeline prompt.
 */
export function formatOutlineToPrompt(outline: GeneratedOutline): string {
  const sectionsList = outline.sections
    .map((s) => `  - [${s.level}] ${s.heading} (${s.purpose})`)
    .join('\n');

  const faqsList =
    outline.faqQuestions.length > 0
      ? `\nFAQ QUESTIONS TO ANSWER IN DEDICATED FAQ SECTION:\n${outline.faqQuestions.map((q) => `  - ${q}`).join('\n')}`
      : '';

  const takeawaysList =
    outline.keyTakeaways.length > 0
      ? `\nKEY TAKEAWAYS TO EMPHASIZE:\n${outline.keyTakeaways.map((t) => `  - ${t}`).join('\n')}`
      : '';

  return `
APPROVED ARTICLE OUTLINE:
Title: ${outline.title}
H1: ${outline.h1}
Search Intent: ${outline.searchIntent}
Sections:
${sectionsList}${faqsList}${takeawaysList}
Follow this outline structure closely while generating original, high-value content.
`;
}
