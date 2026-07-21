import { Chapter, Novel } from './db';

// Generate a random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Beautiful pastel or modern colors for book covers
const COVER_GRADIENTS = [
  'from-amber-100 to-amber-200 text-amber-900',
  'from-emerald-100 to-emerald-200 text-emerald-900',
  'from-cyan-100 to-cyan-200 text-cyan-900',
  'from-rose-100 to-rose-200 text-rose-900',
  'from-indigo-100 to-indigo-200 text-indigo-900',
  'from-violet-100 to-violet-200 text-violet-900',
  'from-teal-100 to-teal-200 text-teal-900',
  'from-orange-100 to-orange-200 text-orange-900',
];

export function getRandomCoverColor(): string {
  const index = Math.floor(Math.random() * COVER_GRADIENTS.length);
  return COVER_GRADIENTS[index];
}

// A smart regex that matches common Chinese chapter headers and generic English ones
// Examples:
// - 第一百二十三章 决战之巅
// - 第35章 重逢
// - Chapter 12: The Journey
// - 楔子 / 前言 / 大结局
const CHAPTER_REGEX = /^\s*(第\s*[0-9一二三四五六七八九十百千万零两]+[\s*]*[章节回折卷集幕篇分项].*|Chapter\s*[0-9]+.*|Section\s*[0-9]+.*|序章|楔子|前言|引子|尾声|后记|番外|终章|大结局)\s*$/m;

interface ParsedChapter {
  title: string;
  content: string;
}

/**
 * Smartly parse TXT file contents into Chapter objects
 */
export function parseTxtContent(
  text: string,
  novelId: string,
  novelTitle: string
): { chapters: Chapter[]; wordCount: number; preview: string } {
  const lines = text.split(/\r?\n/);
  const parsedChapters: ParsedChapter[] = [];
  
  let currentTitle = '序言 / 导言';
  let currentLines: string[] = [];
  let totalWordCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = CHAPTER_REGEX.test(line);

    if (isHeading) {
      // If we have content in the previous chapter, push it
      const content = currentLines.join('\n').trim();
      if (content.length > 0 || currentTitle !== '序言 / 导言' || parsedChapters.length > 0) {
        parsedChapters.push({
          title: currentTitle.trim(),
          content: content || '（本章无文字内容）'
        });
        totalWordCount += content.length;
      }
      currentTitle = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Add the last chapter
  const finalContent = currentLines.join('\n').trim();
  if (finalContent.length > 0 || parsedChapters.length === 0) {
    parsedChapters.push({
      title: currentTitle.trim(),
      content: finalContent || '（本章无文字内容）'
    });
    totalWordCount += finalContent.length;
  }

  // Heuristic: If we only found 1 single chapter and the text is extremely long,
  // split it automatically into chunks of ~3500 characters to make reading pleasant.
  let finalParsedList = parsedChapters;
  if (parsedChapters.length === 1 && text.length > 6000) {
    finalParsedList = [];
    const chunkSize = 3500;
    const cleanText = text.replace(/\r/g, '');
    let index = 1;
    for (let offset = 0; offset < cleanText.length; offset += chunkSize) {
      const chunk = cleanText.substring(offset, offset + chunkSize);
      finalParsedList.push({
        title: `第 ${index} 部分`,
        content: chunk.trim()
      });
      index++;
    }
    totalWordCount = cleanText.length;
  }

  // Map to full Chapter model objects
  const chapters: Chapter[] = finalParsedList.map((ch, idx) => ({
    id: generateId(),
    novelId,
    title: ch.title,
    content: ch.content,
    index: idx
  }));

  // Create preview description (first ~100 characters of the first chapter)
  let preview = '暂无简介';
  if (chapters.length > 0) {
    const firstChText = chapters[0].content.substring(0, 100).replace(/\s+/g, ' ').trim();
    if (firstChText.length > 0) {
      preview = firstChText + '...';
    }
  }

  return {
    chapters,
    wordCount: totalWordCount,
    preview
  };
}

/**
 * Attempt to read File with appropriate encoding
 */
export function readFileAsText(file: File, encoding: string = 'UTF-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsText(file, encoding);
  });
}

/**
 * Automated check of UTF-8 vs GBK bytes to guess the correct encoding
 */
export function estimateEncoding(arrayBuffer: ArrayBuffer): 'UTF-8' | 'GBK' {
  const bytes = new Uint8Array(arrayBuffer);
  let isUtf8 = true;
  let i = 0;
  
  while (i < bytes.length) {
    if (bytes[i] <= 0x7F) {
      i++;
      continue;
    }
    
    // Multi-byte UTF-8 sequences
    if (bytes[i] >= 0xC2 && bytes[i] <= 0xDF) {
      if (i + 1 < bytes.length && (bytes[i + 1] & 0xC0) === 0x80) {
        i += 2;
        continue;
      }
    } else if (bytes[i] >= 0xE0 && bytes[i] <= 0xEF) {
      if (i + 2 < bytes.length && 
          (bytes[i + 1] & 0xC0) === 0x80 && 
          (bytes[i + 2] & 0xC0) === 0x80) {
        i += 3;
        continue;
      }
    } else if (bytes[i] >= 0xF0 && bytes[i] <= 0xF4) {
      if (i + 3 < bytes.length && 
          (bytes[i + 1] & 0xC0) === 0x80 && 
          (bytes[i + 2] & 0xC0) === 0x80 && 
          (bytes[i + 3] & 0xC0) === 0x80) {
        i += 4;
        continue;
      }
    }
    
    // If we land here, it is not valid UTF-8
    isUtf8 = false;
    break;
  }
  
  return isUtf8 ? 'UTF-8' : 'GBK';
}
