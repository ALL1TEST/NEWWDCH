// ============================================================
// AI Intent Detection & Prompt Engineering for Editor AI Bar
// Detects whether the user intends to generate an image vs text,
// and extracts an optimal visual prompt avoiding unwanted text.
// ============================================================

/**
 * Checks if the prompt expresses an intent to generate or create an image.
 */
export function isImageGenerationIntent(prompt: string): boolean {
  if (!prompt) return false;
  const trimmed = prompt.trim().toLowerCase();

  // Verbs of generation (including common misspellings like generarte, genrate)
  const verbs =
    '(?:generarte|genrate|genarte|generate|generat|create|make|draw|paint|produce|render|craft|design|dir|sawb|creer|g\\u00e9n\\u00e9rer)';
  // Image noun terms (including Arabic/Darija phonetic transliterations)
  const nouns =
    '(?:img|image|images|picture|pictures|photo|photos|pic|pics|illustration|artwork|drawing|painting|sora|soura)';

  // 1. "generate img", "generarte img for him", "create image of flowers", etc.
  const verbNounRegex = new RegExp(`\\b${verbs}\\s+(?:an?\\s+|some\\s+)?${nouns}\\b`, 'i');
  if (verbNounRegex.test(trimmed)) return true;

  // 2. "photo of ...", "image of ...", "picture of ..."
  const ofRegex = new RegExp(`\\b${nouns}\\s+of\\b`, 'i');
  if (ofRegex.test(trimmed)) return true;

  // 3. Directive prefixes: "img:", "image:", "photo:"
  if (/^(?:img|image|photo|picture)\s*[:=]/i.test(trimmed)) return true;

  // 4. Arabic and Darija keywords
  const arabicRegex =
    /(?:توليد\s*صورة|انشئ\s*صورة|اعمل\s*صورة|صورة\s*لـ|ارسم|رسمة|sawb\s*lia\s*sora|dir\s*sora|sora\s*dyal)/i;
  if (arabicRegex.test(trimmed)) return true;

  return false;
}

/**
 * Cleans structural/procedural heading prefixes from article text
 * so the image model focuses on the visual scene rather than rendering words.
 */
function cleanStructuralHeadings(text: string): string {
  return text
    .replace(
      /^(?:step[\s-]*by[\s-]*step\s+instructions?|step\s*\d+[:\.\s-]*|quick\s*answer[:\.\s-]*|instructions?[:\.\s-]*|overview[:\.\s-]*|summary[:\.\s-]*|introduction[:\.\s-]*|conclusion[:\.\s-]*|tips?[:\.\s-]*|faq[:\.\s-]*)/i,
      '',
    )
    .replace(/^[:\-–—\s]+/, '')
    .trim();
}

/**
 * Builds an optimal image generation prompt.
 * Strictly avoids quotation marks and text-inducing phrases,
 * and enforces "no text, no letters, no words" unless the user explicitly asks for text.
 */
export function buildImagePrompt(
  userPrompt: string,
  selectedContext?: string,
  articleTitle?: string,
): string {
  const trimmed = userPrompt.trim();

  // Check if the user specifically requested text, words, or typography on the image
  const userWantsText =
    /\b(?:with\s+text|text\s+(?:saying|written|overlay)|written\s+on\s+it|typography|letters|quote|sign|caption|كتابة|مكتوب|نص)\b/i.test(
      trimmed,
    );

  // Strip leading command phrases like "generate img for him", "generarte image of", etc.
  let cleanedUserPrompt = trimmed
    .replace(
      /^(?:please\s+)?(?:generarte|genrate|genarte|generate|generat|create|make|draw|paint|dir|sawb|creer|générer)\s+(?:an?\s+|some\s+)?(?:img|image|images|picture|pictures|photo|photos|pic|pics|illustration)(?:\s+(?:for\s+(?:this|it|him|her|them)|of))?/i,
      '',
    )
    .replace(/^[:\-–—\s]+/, '')
    .trim();

  // Strip trailing "for him", "for this", "for it"
  cleanedUserPrompt = cleanedUserPrompt
    .replace(/\s+for\s+(?:him|her|it|this|them)$/i, '')
    .trim();

  const hasSubstantiveUserPrompt =
    cleanedUserPrompt.length > 0 &&
    !/^(?:him|her|it|this|them|me|us|here)$/i.test(cleanedUserPrompt);

  // Extract visual context from selected text and/or article title
  let visualSubject = '';

  if (selectedContext?.trim()) {
    const rawContext = selectedContext.trim().replace(/["'`«»]/g, ' ');
    const strippedContext = cleanStructuralHeadings(rawContext);

    // If stripped context has real content (e.g. "Assess Your Lighting Conditions" or "How to Choose...")
    if (strippedContext.length > 5) {
      visualSubject = strippedContext;
    } else if (articleTitle?.trim()) {
      // If selection was just "Step-by-Step Instructions", fall back to the article topic!
      visualSubject = cleanStructuralHeadings(articleTitle.trim().replace(/["'`«»]/g, ' '));
    } else {
      visualSubject = rawContext;
    }
  } else if (articleTitle?.trim()) {
    visualSubject = cleanStructuralHeadings(articleTitle.trim().replace(/["'`«»]/g, ' '));
  }

  // Clean and limit length
  visualSubject = visualSubject.replace(/\s+/g, ' ').slice(0, 180).trim();

  let finalPrompt = '';

  if (hasSubstantiveUserPrompt && visualSubject) {
    finalPrompt = `${cleanedUserPrompt}, realistic photography depicting ${visualSubject}`;
  } else if (hasSubstantiveUserPrompt) {
    finalPrompt = cleanedUserPrompt;
  } else if (visualSubject) {
    finalPrompt = `High-quality, professional realistic photography of ${visualSubject}`;
  } else {
    finalPrompt = trimmed;
  }

  // Enforce zero text on image unless explicitly requested by user
  if (!userWantsText && !/no\s+(?:text|words|letters|typography)/i.test(finalPrompt)) {
    finalPrompt = `${finalPrompt}, clean photography, high resolution, photorealistic, no text, no words, no letters, no typography, no captions, no watermark, no labels`;
  }

  return finalPrompt;
}
