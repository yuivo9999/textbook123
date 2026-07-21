'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Search,
  ArrowLeft,
  Settings,
  Menu,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Save,
  FileText,
  X,
  Sliders,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Info
} from 'lucide-react';
import { dbInstance, Novel, Chapter, Bookmark as BookmarkModel } from '@/lib/db';
import { parseTxtContent, estimateEncoding, readFileAsText, generateId, getRandomCoverColor } from '@/lib/parser';
import { preseedSampleBookIfNeeded } from '@/lib/preseed';

// Font sizes in px
const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28, 32];

// Fonts
const FONTS = [
  { id: 'sans', name: '系统黑体', class: 'font-sans' },
  { id: 'serif', name: '优雅宋体', class: 'font-serif' },
  { id: 'mono', name: '极简等宽', class: 'font-mono' },
  { id: 'kaiti', name: '古典楷体', class: 'font-cursive' }
];

// Theme configurations
interface ThemeConfig {
  id: string;
  name: string;
  bg: string;
  text: string;
  border: string;
  panelBg: string;
  accent: string;
  accentText: string;
  textHex: string;
  paperBg: string;
  outerBg: string;
  isScroll?: boolean;
}

const THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: '古典书卷',
    bg: 'bg-[#312722]',
    text: 'text-[#2E2116]',
    border: 'border-[#D9CEB2]',
    panelBg: 'bg-[#FCF8ED]',
    accent: 'bg-[#B59146]',
    accentText: 'text-white',
    textHex: '#2E2116',
    paperBg: 'bg-[#FCF8ED]',
    outerBg: 'bg-[#312722]',
    isScroll: true
  },
  {
    id: 'sepia',
    name: '护眼羊皮',
    bg: 'bg-[#F3EAD3]',
    text: 'text-[#3E2F1E]',
    border: 'border-[#E0D4B7]',
    panelBg: 'bg-[#F3EAD3]',
    accent: 'bg-[#8C6D4A]',
    accentText: 'text-white',
    textHex: '#3E2F1E',
    paperBg: 'bg-[#F3EAD3]',
    outerBg: 'bg-[#F3EAD3]',
    isScroll: false
  },
  {
    id: 'mint',
    name: '清雅竹绿',
    bg: 'bg-[#EEF5EA]',
    text: 'text-[#1E2F19]',
    border: 'border-[#D5E0CD]',
    panelBg: 'bg-[#EEF5EA]',
    accent: 'bg-[#4D6E3F]',
    accentText: 'text-white',
    textHex: '#1E2F19',
    paperBg: 'bg-[#EEF5EA]',
    outerBg: 'bg-[#EEF5EA]',
    isScroll: false
  }
];

// Content widths
const CONTAINER_WIDTHS = [
  { id: 'narrow', name: '紧凑 (600px)', class: 'max-w-xl' },
  { id: 'normal', name: '适中 (800px)', class: 'max-w-3xl' },
  { id: 'wide', name: '宽敞 (1000px)', class: 'max-w-5xl' }
];

export default function Home() {
  // Navigation & Views
  const [view, setView] = useState<'SHELF' | 'READER' | 'EDITOR'>('SHELF');
  
  // Data State
  const [novels, setNovels] = useState<Novel[]>([]);
  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [activeChapters, setActiveChapters] = useState<Chapter[]>([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [bookmarks, setBookmarks] = useState<BookmarkModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter
  const [shelfSearchQuery, setShelfSearchQuery] = useState<string>('');
  const [shelfSortBy, setShelfSortBy] = useState<'lastRead' | 'title' | 'size' | 'added'>('lastRead');

  // Import Dialog State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTitle, setImportTitle] = useState<string>('');
  const [importAuthor, setImportAuthor] = useState<string>('');
  const [importEncoding, setImportEncoding] = useState<'UTF-8' | 'GBK'>('UTF-8');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [importError, setImportError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Manual Novel Creator & Editor State
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingAuthor, setEditingAuthor] = useState<string>('');
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [editingCoverColor, setEditingCoverColor] = useState<string>('');
  const [editorChapters, setEditorChapters] = useState<{ id: string; title: string; content: string }[]>([]);
  const [selectedEditorChapterId, setSelectedEditorChapterId] = useState<string>('');
  const [selectedEditorChapterContent, setSelectedEditorChapterContent] = useState<string>('');
  const [selectedEditorChapterTitle, setSelectedEditorChapterTitle] = useState<string>('');
  const [isSavingEditor, setIsSavingEditor] = useState<boolean>(false);

  // Reader Preferences State (with defaults)
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnr_font_size');
      if (saved) return parseInt(saved, 10);
    }
    return 20;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnr_font_family');
      if (saved) return saved;
    }
    return 'serif';
  });
  const [containerWidth, setContainerWidth] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnr_container_width');
      if (saved) return saved;
    }
    return 'normal';
  });
  const [readerTheme, setReaderTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnr_theme');
      if (saved) return saved;
    }
    return 'light';
  });
  const [lineHeight, setLineHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnr_line_height');
      if (saved) return parseFloat(saved);
    }
    return 1.8;
  });
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(0); // 0 = off, 1-10 speed

  // Reader Interactivity States
  const [isReaderToolbarOpen, setIsReaderToolbarOpen] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');
  const [readerMessage, setReaderMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Auto-save scroll timeout ref
  const scrollSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize DB and Seed Data
  useEffect(() => {
    async function loadDatabase() {
      try {
        await dbInstance.init();
        // Seed default book if library is empty
        await preseedSampleBookIfNeeded();
        await refreshNovels();
      } catch (err) {
        console.error('Failed to load local database:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDatabase();
  }, []);

  // Save preferences to LocalStorage when changed
  useEffect(() => {
    localStorage.setItem('lnr_font_size', fontSize.toString());
    localStorage.setItem('lnr_font_family', fontFamily);
    localStorage.setItem('lnr_container_width', containerWidth);
    localStorage.setItem('lnr_theme', readerTheme);
    localStorage.setItem('lnr_line_height', lineHeight.toString());
  }, [fontSize, fontFamily, containerWidth, readerTheme, lineHeight]);

  // Handle Auto-Scroll
  useEffect(() => {
    if (autoScrollSpeed === 0 || view !== 'READER') return;
    
    let lastTime = performance.now();
    let animationFrameId: number;

    const scrollStep = (time: number) => {
      const elapsed = (time - lastTime) / 1000; // in seconds
      lastTime = time;

      // Speed scale: 1 is very slow, 10 is fast
      const pixelsToScroll = autoScrollSpeed * 15 * elapsed;
      window.scrollBy(0, pixelsToScroll);

      // Save scroll position gently while auto-scrolling
      if (Math.random() < 0.02) { // sample-based save to avoid performance bottleneck
        saveCurrentProgressLocally();
      }

      animationFrameId = requestAnimationFrame(scrollStep);
    };

    animationFrameId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(animationFrameId);
  }, [autoScrollSpeed, view, activeChapterIndex, activeNovel?.id]);

  // Clear scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current);
    };
  }, []);

  // Set up window scroll listener for saving reading location
  useEffect(() => {
    if (view !== 'READER') return;

    const handleScroll = () => {
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
      scrollSaveTimeoutRef.current = setTimeout(() => {
        saveCurrentProgressLocally();
      }, 800); // debounce saving to database
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current);
    };
  }, [view, activeNovel?.id, activeChapterIndex, activeChapters]);

  // Load chapters when activeNovel changes (for READER mode)
  useEffect(() => {
    if (activeNovel && view === 'READER') {
      loadNovelReadingData(activeNovel.id);
    }
  }, [activeNovel?.id, view]);

  // Quick message display helper
  const showMessage = (text: string, type: 'success' | 'info' = 'success') => {
    setReaderMessage({ text, type });
    setTimeout(() => setReaderMessage(null), 2500);
  };

  // --- Core DB Load Actions ---
  async function refreshNovels() {
    const list = await dbInstance.getAllNovels();
    setNovels(list);
  }

  async function loadNovelReadingData(novelId: string) {
    try {
      const chaptersList = await dbInstance.getChaptersByNovel(novelId);
      setActiveChapters(chaptersList);

      const book = await dbInstance.getNovel(novelId);
      if (book) {
        setActiveNovel(book);
        
        // Load Bookmarks
        const bms = await dbInstance.getBookmarksByNovel(novelId);
        setBookmarks(bms);

        // Find saved reading chapter index
        let targetIndex = 0;
        if (book.lastReadChapterId) {
          const idx = chaptersList.findIndex(c => c.id === book.lastReadChapterId);
          if (idx !== -1) {
            targetIndex = idx;
          }
        } else if (book.lastReadChapterIndex !== undefined) {
          targetIndex = Math.min(book.lastReadChapterIndex, chaptersList.length - 1);
        }
        
        setActiveChapterIndex(targetIndex);

        // Scroll restoration
        setTimeout(() => {
          if (book.scrollOffset && book.lastReadChapterId === chaptersList[targetIndex]?.id) {
            window.scrollTo({ top: book.scrollOffset, behavior: 'auto' });
          } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        }, 80);
      }
    } catch (err) {
      console.error('Error loading novel reading data:', err);
    }
  }

  // --- Save Reading Progress ---
  async function saveCurrentProgressLocally() {
    if (!activeNovel || activeChapters.length === 0) return;
    
    const currentCh = activeChapters[activeChapterIndex];
    if (!currentCh) return;

    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

    // Calculate absolute book progress
    const totalChapters = activeChapters.length;
    const progressVal = Math.round(
      Math.min(100, Math.max(0, ((activeChapterIndex + scrollPercent) / totalChapters) * 100))
    );

    const updatedNovel: Novel = {
      ...activeNovel,
      lastReadChapterId: currentCh.id,
      lastReadChapterIndex: activeChapterIndex,
      scrollOffset: scrollTop,
      progress: progressVal,
      lastReadAt: Date.now()
    };

    // Fast state update
    setActiveNovel(updatedNovel);
    
    // Save to IndexedDB
    await dbInstance.saveNovel(updatedNovel);
  }

  // --- Import TXT Event Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        await processSelectedFile(file);
      } else {
        setImportError('目前仅支持导入 .txt 格式纯文本小说');
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setImportFile(file);
    setImportError('');
    
    // Auto-parse nice title and author from file name
    // Matches formats: "《书名》作者.txt", "书名 - 作者.txt", "作者 - 书名.txt", "书名.txt"
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    let title = nameWithoutExt;
    let author = '佚名';

    const bookNameMatch = nameWithoutExt.match(/《([^》]+)》/);
    if (bookNameMatch) {
      title = bookNameMatch[1];
      // Try to find author outside the brackets
      const parts = nameWithoutExt.replace(bookNameMatch[0], '').split(/[-_\s]+/);
      const possibleAuthor = parts.find(p => p.trim().length > 0);
      if (possibleAuthor) {
        author = possibleAuthor.trim();
      }
    } else {
      const dividers = [' - ', '-', ' ', '_'];
      for (const div of dividers) {
        if (nameWithoutExt.includes(div)) {
          const parts = nameWithoutExt.split(div);
          if (parts.length >= 2) {
            // Check heuristic: normally shorter part is author
            if (parts[0].trim().length < parts[1].trim().length) {
              author = parts[0].trim();
              title = parts[1].trim();
            } else {
              title = parts[0].trim();
              author = parts[1].trim();
            }
            break;
          }
        }
      }
    }

    setImportTitle(title);
    setImportAuthor(author);

    // Smart detect encoding
    try {
      const tempBuffer = await file.slice(0, 15000).arrayBuffer();
      const detected = estimateEncoding(tempBuffer);
      setImportEncoding(detected);
    } catch (err) {
      console.error('Failed to auto-detect encoding:', err);
    }
  };

  const handleStartImport = async () => {
    if (!importFile) {
      setImportError('请先选择或拖入 TXT 小说文件');
      return;
    }
    if (!importTitle.trim()) {
      setImportError('请输入小说书名');
      return;
    }

    setIsParsing(true);
    setImportError('');

    try {
      // Read text based on chosen encoding
      const text = await readFileAsText(importFile, importEncoding);
      if (!text || text.trim().length === 0) {
        throw new Error('该文本文件内容为空');
      }

      const novelId = generateId();
      const { chapters, wordCount, preview } = parseTxtContent(text, novelId, importTitle);

      if (chapters.length === 0) {
        throw new Error('未能在文本中解析出任何有效章节。');
      }

      // Save novel metadata
      const newNovel: Novel = {
        id: novelId,
        title: importTitle.trim(),
        author: importAuthor.trim() || '佚名',
        coverColor: getRandomCoverColor(),
        size: importFile.size,
        wordCount,
        description: preview,
        lastReadChapterId: chapters[0].id,
        lastReadChapterIndex: 0,
        progress: 0,
        addedAt: Date.now()
      };

      await dbInstance.saveNovel(newNovel);
      await dbInstance.bulkSaveChapters(chapters);

      // Reset & Refresh
      setImportFile(null);
      setIsImportModalOpen(false);
      await refreshNovels();
      showMessage(`《${importTitle}》成功导入！共解析出 ${chapters.length} 章`);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || '导入失败，请检查文件格式或选择其他字符编码（UTF-8/GBK）。');
    } finally {
      setIsParsing(false);
    }
  };

  // --- Manual Creation & Editor Functions ---
  const handleOpenCreator = () => {
    // Open clean blank state
    setActiveNovel(null);
    setEditingTitle('');
    setEditingAuthor('');
    setEditingDescription('');
    setEditingCoverColor(getRandomCoverColor());
    
    // Start with one blank chapter
    const firstChapterId = generateId();
    setEditorChapters([
      { id: firstChapterId, title: '第一章 启航', content: '' }
    ]);
    setSelectedEditorChapterId(firstChapterId);
    setSelectedEditorChapterTitle('第一章 启航');
    setSelectedEditorChapterContent('');
    setView('EDITOR');
  };

  const handleOpenEditor = async (novel: Novel) => {
    setActiveNovel(novel);
    setEditingTitle(novel.title);
    setEditingAuthor(novel.author);
    setEditingDescription(novel.description);
    setEditingCoverColor(novel.coverColor || getRandomCoverColor());

    const chaptersList = await dbInstance.getChaptersByNovel(novel.id);
    const mapped = chaptersList.map(c => ({
      id: c.id,
      title: c.title,
      content: c.content
    }));

    setEditorChapters(mapped);
    if (mapped.length > 0) {
      setSelectedEditorChapterId(mapped[0].id);
      setSelectedEditorChapterTitle(mapped[0].title);
      setSelectedEditorChapterContent(mapped[0].content);
    } else {
      const dummyId = generateId();
      setEditorChapters([{ id: dummyId, title: '第一章', content: '' }]);
      setSelectedEditorChapterId(dummyId);
      setSelectedEditorChapterTitle('第一章');
      setSelectedEditorChapterContent('');
    }
    setView('EDITOR');
  };

  // Keep state synced when switching selected chapter in editor
  const handleSelectEditorChapter = (id: string) => {
    // 1. Save current chapter changes in the in-memory array first
    const updated = editorChapters.map(ch => {
      if (ch.id === selectedEditorChapterId) {
        return { ...ch, title: selectedEditorChapterTitle, content: selectedEditorChapterContent };
      }
      return ch;
    });
    setEditorChapters(updated);

    // 2. Load the new selected chapter
    const target = updated.find(ch => ch.id === id);
    if (target) {
      setSelectedEditorChapterId(id);
      setSelectedEditorChapterTitle(target.title);
      setSelectedEditorChapterContent(target.content);
    }
  };

  const handleAddEditorChapter = () => {
    // Save current active first
    let updated = editorChapters.map(ch => {
      if (ch.id === selectedEditorChapterId) {
        return { ...ch, title: selectedEditorChapterTitle, content: selectedEditorChapterContent };
      }
      return ch;
    });

    const newId = generateId();
    const newIndex = updated.length + 1;
    const newChapter = {
      id: newId,
      title: `第 ${newIndex} 章 新章节`,
      content: ''
    };

    updated = [...updated, newChapter];
    setEditorChapters(updated);
    setSelectedEditorChapterId(newId);
    setSelectedEditorChapterTitle(newChapter.title);
    setSelectedEditorChapterContent('');
  };

  const handleDeleteEditorChapter = (id: string) => {
    if (editorChapters.length <= 1) {
      alert('小说必须保留至少一个章节');
      return;
    }

    const index = editorChapters.findIndex(ch => ch.id === id);
    const updated = editorChapters.filter(ch => ch.id !== id);
    setEditorChapters(updated);

    // If deleting the active chapter, switch active pointer
    if (selectedEditorChapterId === id) {
      const nextActiveIdx = Math.max(0, index - 1);
      const nextCh = updated[nextActiveIdx];
      setSelectedEditorChapterId(nextCh.id);
      setSelectedEditorChapterTitle(nextCh.title);
      setSelectedEditorChapterContent(nextCh.content);
    }
  };

  const handleMoveChapter = (id: string, direction: 'up' | 'down') => {
    const idx = editorChapters.findIndex(ch => ch.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === editorChapters.length - 1) return;

    // Save active chapter first
    const currentList = editorChapters.map(ch => {
      if (ch.id === selectedEditorChapterId) {
        return { ...ch, title: selectedEditorChapterTitle, content: selectedEditorChapterContent };
      }
      return ch;
    });

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const temp = currentList[idx];
    currentList[idx] = currentList[swapIdx];
    currentList[swapIdx] = temp;

    setEditorChapters(currentList);
    
    // Also update selected values to sync with modified array
    const activeCh = currentList.find(ch => ch.id === selectedEditorChapterId);
    if (activeCh) {
      setSelectedEditorChapterTitle(activeCh.title);
      setSelectedEditorChapterContent(activeCh.content);
    }
  };

  const handleSaveEditorNovel = async () => {
    if (!editingTitle.trim()) {
      alert('请输入小说名称');
      return;
    }

    setIsSavingEditor(true);
    try {
      // Commit active chapter text box state to the list
      const finalChapters = editorChapters.map(ch => {
        if (ch.id === selectedEditorChapterId) {
          return { ...ch, title: selectedEditorChapterTitle, content: selectedEditorChapterContent };
        }
        return ch;
      });

      const novelId = activeNovel ? activeNovel.id : generateId();
      let totalWordCount = 0;
      
      const chaptersToSave: Chapter[] = finalChapters.map((ch, idx) => {
        totalWordCount += ch.content.length;
        return {
          id: ch.id,
          novelId,
          title: ch.title.trim() || `第 ${idx + 1} 章 无标题章节`,
          content: ch.content,
          index: idx
        };
      });

      // Compute simple size
      const computedSize = Math.round(JSON.stringify(chaptersToSave).length * 1.5);

      const savedNovel: Novel = {
        id: novelId,
        title: editingTitle.trim(),
        author: editingAuthor.trim() || '无名作者',
        coverColor: editingCoverColor || getRandomCoverColor(),
        size: computedSize,
        wordCount: totalWordCount,
        description: editingDescription.trim() || (chaptersToSave[0]?.content.substring(0, 100) + '...' || '自建原创作品'),
        addedAt: activeNovel ? activeNovel.addedAt : Date.now(),
        lastReadChapterId: activeNovel?.lastReadChapterId || chaptersToSave[0]?.id,
        lastReadChapterIndex: activeNovel?.lastReadChapterIndex || 0,
        progress: activeNovel?.progress || 0,
        lastReadAt: activeNovel?.lastReadAt || Date.now()
      };

      // 1. Save novel metadata
      await dbInstance.saveNovel(savedNovel);
      
      // 2. If it's an existing book, we should clean up obsolete chapters in DB first
      if (activeNovel) {
        const oldChapters = await dbInstance.getChaptersByNovel(novelId);
        const newIds = new Set(chaptersToSave.map(c => c.id));
        for (const oldCh of oldChapters) {
          if (!newIds.has(oldCh.id)) {
            await dbInstance.deleteChapter(oldCh.id);
          }
        }
      }

      // 3. Save new chapters list
      await dbInstance.bulkSaveChapters(chaptersToSave);

      await refreshNovels();
      showMessage(activeNovel ? `《${editingTitle}》更新保存成功！` : `新小说《${editingTitle}》创建成功！`);
      setView('SHELF');
    } catch (err) {
      console.error(err);
      alert('保存小说出错，请重试');
    } finally {
      setIsSavingEditor(false);
    }
  };

  // --- Deletion ---
  const handleDeleteNovel = async (novel: Novel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要彻底删除《${novel.title}》吗？删除后此书以及阅读记录将永久丢失。`)) {
      await dbInstance.deleteNovel(novel.id);
      await refreshNovels();
      showMessage(`《${novel.title}》已删除`);
    }
  };

  // --- Bookmark Management ---
  const handleToggleBookmark = async () => {
    if (!activeNovel || activeChapters.length === 0) return;
    const currentCh = activeChapters[activeChapterIndex];
    if (!currentCh) return;

    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

    // Check if bookmark already exists near this location
    const matched = bookmarks.find(
      b => b.chapterId === currentCh.id && Math.abs(b.scrollPercent - scrollPercent) < 0.05
    );

    if (matched) {
      // Delete existing
      await dbInstance.deleteBookmark(matched.id);
      const bms = await dbInstance.getBookmarksByNovel(activeNovel.id);
      setBookmarks(bms);
      showMessage('书签已移除', 'info');
    } else {
      // Extract a neat sentence excerpt
      const textPreview = currentCh.content.substring(0, 150).trim().replace(/\s+/g, ' ');
      const excerpt = textPreview.length > 40 ? textPreview.substring(0, 40) + '...' : textPreview;

      const newBookmark: BookmarkModel = {
        id: generateId(),
        novelId: activeNovel.id,
        chapterId: currentCh.id,
        chapterTitle: currentCh.title,
        excerpt: excerpt || '（无文字内容）',
        scrollPercent,
        addedAt: Date.now()
      };

      await dbInstance.addBookmark(newBookmark);
      const bms = await dbInstance.getBookmarksByNovel(activeNovel.id);
      setBookmarks(bms);
      showMessage('成功添加书签！');
    }
  };

  const handleJumpToBookmark = (bm: BookmarkModel) => {
    const index = activeChapters.findIndex(c => c.id === bm.chapterId);
    if (index !== -1) {
      setActiveChapterIndex(index);
      setIsSidebarOpen(false);
      
      // Wait for content render to restore scroll position
      setTimeout(() => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          window.scrollTo({
            top: docHeight * bm.scrollPercent,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  // --- Filtering & Sorting on Library Shelf ---
  const filteredNovels = novels.filter(n => {
    const query = shelfSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return n.title.toLowerCase().includes(query) || n.author.toLowerCase().includes(query);
  });

  const sortedNovels = [...filteredNovels].sort((a, b) => {
    if (shelfSortBy === 'title') {
      return a.title.localeCompare(b.title, 'zh');
    }
    if (shelfSortBy === 'size') {
      return b.size - a.size;
    }
    if (shelfSortBy === 'added') {
      return b.addedAt - a.addedAt;
    }
    // Default 'lastRead'
    const timeA = a.lastReadAt || a.addedAt;
    const timeB = b.lastReadAt || b.addedAt;
    return timeB - timeA;
  });

  // Active Chapter Rendering helper
  const currentChapter = activeChapters[activeChapterIndex];
  const paragraphs = currentChapter?.content.split(/\r?\n/).filter(p => p.trim() !== '') || [];

  // Table of Contents chapter filter search
  const filteredChapterTOC = activeChapters.filter(c => {
    const q = chapterSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q);
  });

  // Formats chapter titles using " · " separator instead of spaces/colons
  const formatChapterTitle = (titleStr: string) => {
    if (!titleStr) return '';
    return titleStr
      .replace(/\s*[:：,，\s]\s*/g, ' · ')
      .replace(/\s*·\s*·\s*/g, ' · ');
  };

  // Map font settings to high-quality system/premium CSS font-family stacks
  const getFontFamilyStyle = (id: string) => {
    switch (id) {
      case 'serif':
        return '"Playfair Display", STSong, "Songti SC", SimSun, "Noto Serif CJK SC", Georgia, serif';
      case 'mono':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      case 'kaiti':
        return 'KaiTi, "Kaiti SC", STKaiti, cursive';
      default:
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    }
  };

  // Get active theme style
  const activeThemeObj = THEMES.find(t => t.id === readerTheme) || THEMES[0];

  return (
    <div className={`min-h-screen font-sans ${view === 'READER' ? activeThemeObj.bg : 'bg-[#FAF9F6] text-[#2C2B29]'} transition-colors duration-200 selection:bg-amber-200 selection:text-amber-950`}>
      
      {/* ----------------- SHELF VIEW (本地书架) ----------------- */}
      {view === 'SHELF' && (
        <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#E8E4DD] pb-6 mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-8 h-8 text-amber-800" />
                <h1 className="text-2xl md:text-3xl font-serif font-semibold text-[#1F1E1D]">本地小说阅读器</h1>
              </div>
              <p className="text-sm text-[#7D766D] font-sans">
                安全，无打扰的纯本地书屋 · 您的所有书籍都安全地保存在您当前浏览器的本地数据库中
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                id="btn-import-shelf"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-800 text-white hover:bg-amber-900 rounded-lg shadow-sm text-sm font-medium transition"
              >
                <Upload className="w-4 h-4" />
                导入 TXT
              </button>
              <button
                id="btn-create-shelf"
                onClick={handleOpenCreator}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FAF8F5] text-amber-900 border border-amber-800/20 hover:bg-amber-50 rounded-lg text-sm font-medium transition"
              >
                <Plus className="w-4 h-4" />
                手写小说
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                id="input-shelf-search"
                type="text"
                placeholder="搜索小说名或作者..."
                value={shelfSearchQuery}
                onChange={(e) => setShelfSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-white border border-[#E2DDD5] rounded-lg text-sm focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 text-[#2C2B29]"
              />
              {shelfSearchQuery && (
                <button
                  onClick={() => setShelfSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-2 text-sm text-[#6C655C]">
              <span>排序方式:</span>
              <select
                id="select-shelf-sort"
                value={shelfSortBy}
                onChange={(e) => setShelfSortBy(e.target.value as any)}
                className="bg-white border border-[#E2DDD5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29]"
              >
                <option value="lastRead">最近阅读</option>
                <option value="title">书名拼音</option>
                <option value="size">文件大小</option>
                <option value="added">导入时间</option>
              </select>
            </div>
          </div>

          {/* Book List / Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-amber-700 animate-spin" />
              <p className="text-sm text-[#7D766D]">正在连接本地 IndexedDB 数据中心...</p>
            </div>
          ) : sortedNovels.length === 0 ? (
            <div className="border border-dashed border-[#E2DDD5] rounded-xl p-12 text-center bg-white">
              <div className="w-16 h-16 bg-amber-50 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-serif font-semibold text-[#1F1E1D] mb-2">书架上空空如也</h3>
              <p className="text-sm text-[#7D766D] max-w-md mx-auto mb-6">
                您可以立即点击上方按钮导入自备的 TXT 小说，或者创建一个新作品开始。所有数据均安全且私密地储存在本地设备上。
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-800 text-white rounded-lg text-sm font-medium hover:bg-amber-900 transition shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  现在导入
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedNovels.map((novel) => {
                const displaySize = novel.size < 1024 
                  ? `${novel.size} B` 
                  : novel.size < 1024 * 1024 
                    ? `${(novel.size / 1024).toFixed(1)} KB` 
                    : `${(novel.size / (1024 * 1024)).toFixed(2)} MB`;

                return (
                  <motion.div
                    key={novel.id}
                    layoutId={`novel-card-${novel.id}`}
                    whileHover={{ y: -4, transition: { duration: 0.15 } }}
                    className="bg-white border border-[#E8E4DD] rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex gap-4 relative overflow-hidden group hover:border-amber-700/30 hover:shadow-[0_4px_16px_rgba(139,92,26,0.08)] transition-all"
                  >
                    {/* SVG Dynamic Book Cover */}
                    <div 
                      onClick={() => {
                        setActiveNovel(novel);
                        setView('READER');
                      }}
                      className={`w-28 h-36 flex-shrink-0 bg-gradient-to-br ${novel.coverColor || 'from-amber-100 to-amber-200 text-amber-900'} rounded-lg shadow-sm border border-black/5 flex flex-col justify-between p-3 cursor-pointer relative overflow-hidden select-none`}
                    >
                      {/* Stylized pattern on cover */}
                      <div className="absolute right-[-10px] bottom-[-10px] opacity-10 font-serif text-6xl font-bold">
                        書
                      </div>
                      <div className="flex flex-col gap-1 z-10">
                        <div className="text-xs font-medium tracking-widest opacity-80 uppercase">NOVEL</div>
                        <h2 className="text-sm font-serif font-bold line-clamp-3 leading-snug">
                          {novel.title.split(' ')[0]}
                        </h2>
                      </div>
                      <div className="z-10">
                        <div className="w-8 h-[2px] bg-current opacity-40 mb-1" />
                        <p className="text-[10px] font-sans opacity-90 truncate font-semibold">
                          {novel.author} 著
                        </p>
                      </div>
                    </div>

                    {/* Book Details */}
                    <div className="flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <h3 
                          onClick={() => {
                            setActiveNovel(novel);
                            setView('READER');
                          }}
                          className="font-serif text-base font-bold text-[#1F1E1D] hover:text-amber-800 cursor-pointer line-clamp-1 mb-1 transition-colors"
                        >
                          {novel.title}
                        </h3>
                        <p className="text-xs text-[#7D766D] line-clamp-1 mb-2 font-medium">
                          {novel.author} · 著
                        </p>
                        <p className="text-xs text-[#8C8375] line-clamp-2 leading-relaxed bg-amber-50/40 p-2 rounded border border-amber-900/5">
                          {novel.description || '暂无详细简介'}
                        </p>
                      </div>

                      {/* Progress & Quick Actions */}
                      <div className="mt-4 pt-3 border-t border-[#F2EDE6]">
                        {/* Reading progress bar */}
                        <div className="flex items-center justify-between text-[11px] text-[#8C8375] mb-1">
                          <span>阅读进度: {novel.progress}%</span>
                          <span>{displaySize}</span>
                        </div>
                        <div className="w-full bg-[#EFECE6] h-1 rounded-full overflow-hidden mb-3">
                          <div 
                            className="bg-amber-800 h-full transition-all duration-300"
                            style={{ width: `${novel.progress}%` }}
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setActiveNovel(novel);
                              setView('READER');
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded transition shadow-sm"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            阅读
                          </button>
                          
                          <button
                            onClick={() => handleOpenEditor(novel)}
                            title="编辑小说章节及元数据"
                            className="p-1.5 text-[#8C8375] hover:text-amber-800 hover:bg-amber-50 rounded transition border border-[#EFECE6]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={(e) => handleDeleteNovel(novel, e)}
                            title="删除书籍"
                            className="p-1.5 text-[#8C8375] hover:text-red-700 hover:bg-red-50 rounded transition border border-[#EFECE6]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ----------------- TXT IMPORT DIALOG (导入对话框) ----------------- */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#FAF9F6] border border-[#E8E4DD] rounded-xl w-full max-w-lg shadow-xl overflow-hidden text-[#2C2B29]"
            >
              {/* Header */}
              <div className="flex items-center justify-between bg-amber-900/5 px-6 py-4 border-b border-[#E8E4DD]">
                <div className="flex items-center gap-2 text-amber-900">
                  <Upload className="w-5 h-5" />
                  <h3 className="font-serif font-bold text-lg">导入本地 TXT 电子书</h3>
                </div>
                <button
                  onClick={() => {
                    if (!isParsing) {
                      setImportFile(null);
                      setIsImportModalOpen(false);
                    }
                  }}
                  className="text-[#8C8375] hover:text-[#1F1E1D] p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Drag-and-drop or select area */}
                {!importFile ? (
                  <div
                    ref={dragRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      isDragging 
                        ? 'border-amber-800 bg-amber-50/20' 
                        : 'border-[#E2DDD5] bg-white hover:border-amber-800/60 hover:bg-amber-50/5'
                    }`}
                  >
                    <Upload className="w-10 h-10 text-amber-700/60 mx-auto mb-3" />
                    <p className="font-medium text-sm text-[#1F1E1D] mb-1">
                      拖拽 TXT 电子书文件至此，或 <span className="text-amber-800 underline">点击上传</span>
                    </p>
                    <p className="text-xs text-[#8C8375]">支持 UTF-8 / GBK 编码小说纯文本格式</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="bg-white border border-[#E2DDD5] rounded-xl p-4 flex items-start gap-3">
                    <FileText className="w-10 h-10 text-amber-800 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#1F1E1D] truncate mb-1">{importFile.name}</p>
                      <p className="text-xs text-[#8C8375]">文件大小: {(importFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        onClick={() => setImportFile(null)}
                        className="text-xs text-red-600 underline hover:text-red-700 mt-2 font-medium"
                      >
                        重新选择文件
                      </button>
                    </div>
                  </div>
                )}

                {/* Overridable Details */}
                {importFile && (
                  <div className="space-y-3 bg-white p-4 border border-[#E2DDD5] rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#8C8375] mb-1">书名</label>
                        <input
                          id="input-import-title"
                          type="text"
                          value={importTitle}
                          onChange={(e) => setImportTitle(e.target.value)}
                          className="w-full border border-[#E2DDD5] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8C8375] mb-1">作者</label>
                        <input
                          id="input-import-author"
                          type="text"
                          value={importAuthor}
                          onChange={(e) => setImportAuthor(e.target.value)}
                          className="w-full border border-[#E2DDD5] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8C8375] mb-1">
                        文本编码格式 (乱码时手动切换此项)
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-[#2C2B29] cursor-pointer">
                          <input
                            type="radio"
                            name="encoding"
                            checked={importEncoding === 'UTF-8'}
                            onChange={() => setImportEncoding('UTF-8')}
                            className="text-amber-800 focus:ring-amber-800"
                          />
                          UTF-8 (大部分新电子书)
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#2C2B29] cursor-pointer">
                          <input
                            type="radio"
                            name="encoding"
                            checked={importEncoding === 'GBK'}
                            onChange={() => setImportEncoding('GBK')}
                            className="text-amber-800 focus:ring-amber-800"
                          />
                          GBK / GB2312 (中文旧TXT或繁体书)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {importError && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-lg text-xs border border-red-200 flex gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#F2EDE6] border-t border-[#E8E4DD] flex justify-end gap-3">
                <button
                  onClick={() => {
                    setImportFile(null);
                    setIsImportModalOpen(false);
                  }}
                  disabled={isParsing}
                  className="px-4 py-2 text-sm text-[#6C655C] hover:text-[#1F1E1D] hover:bg-black/5 rounded transition"
                >
                  取消
                </button>
                <button
                  id="btn-confirm-import"
                  onClick={handleStartImport}
                  disabled={!importFile || isParsing}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-800 hover:bg-amber-900 disabled:bg-amber-800/40 text-white rounded text-sm font-semibold transition shadow-sm"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      解析及分章中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      开始导入
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ----------------- EDITOR / MANUALLY CREATE VIEW (小说编辑器) ----------------- */}
      {view === 'EDITOR' && (
        <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E8E4DD] pb-4 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('SHELF')}
                className="p-1.5 hover:bg-black/5 rounded transition text-[#6C655C] hover:text-[#1F1E1D]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-serif font-bold text-[#1F1E1D]">
                {activeNovel ? `管理及编辑《${activeNovel.title}》` : '手写自建全新小说'}
              </h2>
            </div>
            
            <button
              id="btn-save-editor-novel"
              onClick={handleSaveEditorNovel}
              disabled={isSavingEditor}
              className="flex items-center gap-2 px-5 py-2 bg-amber-800 hover:bg-amber-900 disabled:bg-amber-800/40 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              {isSavingEditor ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存作品并返回
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left side: Book Metadata & Chapters List */}
            <div className="lg:col-span-4 space-y-6">
              {/* Metadata editor card */}
              <div className="bg-white border border-[#E8E4DD] rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="font-serif font-bold text-[#1F1E1D] border-b border-[#F2EDE6] pb-2 text-sm">
                  1. 作品基本信息
                </h3>
                
                <div>
                  <label className="block text-xs font-semibold text-[#8C8375] mb-1">书名 *</label>
                  <input
                    id="input-editor-title"
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    placeholder="例如: 探索量子宇宙"
                    className="w-full border border-[#E2DDD5] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8C8375] mb-1">作者</label>
                  <input
                    id="input-editor-author"
                    type="text"
                    value={editingAuthor}
                    onChange={(e) => setEditingAuthor(e.target.value)}
                    placeholder="林墨川"
                    className="w-full border border-[#E2DDD5] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8C8375] mb-1">简短描述</label>
                  <textarea
                    id="textarea-editor-description"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    rows={3}
                    placeholder="可在此写入简短的内容梗概..."
                    className="w-full border border-[#E2DDD5] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-700 text-[#2C2B29] resize-none"
                  />
                </div>
              </div>

              {/* Chapters list selector card */}
              <div className="bg-white border border-[#E8E4DD] rounded-xl p-5 shadow-xs flex flex-col h-[450px]">
                <div className="flex items-center justify-between border-b border-[#F2EDE6] pb-2 mb-3">
                  <h3 className="font-serif font-bold text-[#1F1E1D] text-sm">2. 章节管理</h3>
                  <button
                    onClick={handleAddEditorChapter}
                    className="flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建章节
                  </button>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {editorChapters.map((ch, idx) => {
                    const isSelected = ch.id === selectedEditorChapterId;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => handleSelectEditorChapter(ch.id)}
                        className={`group flex items-center justify-between p-2.5 rounded-lg border text-sm transition cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-800/30 text-amber-900 font-medium'
                            : 'bg-[#FAF8F5]/50 border-[#E2DDD5] hover:bg-amber-50/20 hover:border-amber-800/20 text-[#6C655C]'
                        }`}
                      >
                        <span className="truncate flex-1 pr-2">
                          {ch.title.trim() || `第 ${idx + 1} 章 无标题章节`}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveChapter(ch.id, 'up');
                            }}
                            disabled={idx === 0}
                            title="上移"
                            className="p-1 hover:bg-black/5 disabled:opacity-35 rounded transition"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveChapter(ch.id, 'down');
                            }}
                            disabled={idx === editorChapters.length - 1}
                            title="下移"
                            className="p-1 hover:bg-black/5 disabled:opacity-35 rounded transition"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEditorChapter(ch.id);
                            }}
                            disabled={editorChapters.length <= 1}
                            title="删除"
                            className="p-1 hover:bg-red-50 text-red-600 rounded transition disabled:opacity-35"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right side: Active Chapter Text Editor */}
            <div className="lg:col-span-8">
              <div className="bg-white border border-[#E8E4DD] rounded-xl p-6 shadow-xs flex flex-col h-[670px]">
                <h3 className="font-serif font-bold text-[#1F1E1D] border-b border-[#F2EDE6] pb-3 mb-4 text-sm">
                  3. 编辑章节内容
                </h3>

                {/* Chapter Title Input */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#8C8375] mb-1">章节名称</label>
                  <input
                    id="input-chapter-editor-title"
                    type="text"
                    value={selectedEditorChapterTitle}
                    onChange={(e) => setSelectedEditorChapterTitle(e.target.value)}
                    placeholder="章节标题，例如: 第一章 旧钟表店的秘密"
                    className="w-full border border-[#E2DDD5] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-700 font-serif font-bold text-[#1F1E1D]"
                  />
                </div>

                {/* Chapter Content TextArea */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-semibold text-[#8C8375] mb-1">
                    正文内容 ({selectedEditorChapterContent.length} 字)
                  </label>
                  <textarea
                    id="textarea-chapter-editor-content"
                    value={selectedEditorChapterContent}
                    onChange={(e) => setSelectedEditorChapterContent(e.target.value)}
                    placeholder="在此输入当前章节的正文文字... 段落之间直接敲回车即可，无需手动打空格缩进，阅读器会自动为您美化排版。"
                    className="flex-1 w-full border border-[#E2DDD5] rounded p-4 text-base focus:outline-none focus:border-amber-700 text-[#2C2B29] leading-relaxed font-sans overflow-y-auto resize-none bg-[#FCFCFA]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ----------------- FULL沉浸式 READER VIEW (小说阅读器) ----------------- */}
      {view === 'READER' && activeNovel && currentChapter && (
        <div className="relative min-h-screen">
          {/* Top grey header area ambient background for Classical Scroll */}
          {activeThemeObj.isScroll && (
            <div className="absolute top-0 left-0 right-0 h-[190px] bg-[#222222] border-b border-[#312722]/50 z-0 pointer-events-none select-none" />
          )}

          {/* Top Reader Floating Bar */}
          <AnimatePresence>
            {isReaderToolbarOpen && (
              <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`fixed top-0 left-0 right-0 z-40 border-b ${activeThemeObj.border} ${activeThemeObj.panelBg} h-14 flex items-center justify-between px-4 md:px-8 shadow-sm text-sm`}
              >
                {/* Back button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      saveCurrentProgressLocally();
                      setView('SHELF');
                    }}
                    className={`p-1.5 rounded hover:bg-black/5 transition ${activeThemeObj.text}`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="truncate max-w-[180px] md:max-w-xs">
                    <span className={`font-serif font-bold block ${activeThemeObj.text}`}>
                      {activeNovel.title}
                    </span>
                    <span className="text-[10px] opacity-75 block mt-[-2px]">
                      进度 {activeNovel.progress}% · 作者 {activeNovel.author}
                    </span>
                  </div>
                </div>

                {/* Mid: Chapter title for desktop */}
                <div className={`hidden md:block font-serif font-semibold truncate max-w-sm ${activeThemeObj.text}`}>
                  {formatChapterTitle(currentChapter.title)}
                </div>

                {/* Right utility controls */}
                <div className="flex items-center gap-2">
                  <button
                    id="btn-bookmark-toggle"
                    onClick={handleToggleBookmark}
                    title="添加/移除书签"
                    className={`p-2 rounded hover:bg-black/5 transition relative ${activeThemeObj.text}`}
                  >
                    <Bookmark className={`w-4 h-4 ${
                      bookmarks.some(b => b.chapterId === currentChapter.id) 
                        ? 'fill-amber-600 text-amber-600' 
                        : 'opacity-80'
                    }`} />
                  </button>
                  <button
                    id="btn-settings-toggle"
                    onClick={() => {
                      setIsSidebarOpen(true);
                      setSidebarTab('chapters');
                    }}
                    title="目录与书签"
                    className={`p-2 rounded hover:bg-black/5 transition flex items-center gap-1.5 ${activeThemeObj.text}`}
                  >
                    <Menu className="w-4 h-4" />
                    <span>目录</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toast Message inside reader */}
          <AnimatePresence>
            {readerMessage && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed top-18 left-1/2 transform -translate-x-1/2 z-50 bg-[#2C2926] text-white text-xs px-4 py-2 rounded-lg shadow-md font-sans border border-white/5"
              >
                {readerMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chapter Content area */}
          <div 
            onClick={() => setIsReaderToolbarOpen(!isReaderToolbarOpen)}
            className="pt-24 pb-20 px-4 cursor-default select-text min-h-screen flex flex-col justify-start"
          >
            {/* Optional Top Ambient Header (outside the scroll page) */}
            {activeThemeObj.isScroll && (
              <div className={`w-full ${CONTAINER_WIDTHS.find(w => w.id === containerWidth)?.class || 'max-w-3xl'} mx-auto flex justify-center px-4 mb-4 z-10`}>
                <span className="text-xs font-serif font-bold text-[#E5C284] tracking-widest opacity-90 select-none">
                  {activeNovel.title} · {formatChapterTitle(currentChapter.title)}
                </span>
              </div>
            )}

            {/* Parchment Scroll Sheet Container */}
            <div className={`mx-auto w-full ${CONTAINER_WIDTHS.find(w => w.id === containerWidth)?.class || 'max-w-3xl'} ${
              activeThemeObj.isScroll 
                ? `${activeThemeObj.paperBg} shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative border-l border-r border-[#D9CEB2] overflow-visible` 
                : ''
            }`}>
              {/* Golden Scroll Top Roller Decor */}
              {activeThemeObj.isScroll && (
                <div className="relative h-[16px] w-[calc(100%+32px)] -ml-[16px] -mr-[16px] z-10 select-none shadow-[0_3px_8px_rgba(0,0,0,0.45)] flex flex-col justify-between">
                  {/* High fidelity 3D cylinder background with bevel polygon caps */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-b from-[#8C6B2F] via-[#DFBF82] via-[#FDF3DA] via-[#CCAF71] to-[#60481E]" 
                    style={{ clipPath: 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0% 50%)' }}
                  />
                  {/* Top bright highlight line to give glossy look */}
                  <div className="absolute top-[2px] left-[6px] right-[6px] h-[1px] bg-[#FFFFFF]/55 z-20 pointer-events-none" />
                  {/* Bottom deep shadow line to construct physical depth */}
                  <div className="absolute bottom-[2px] left-[6px] right-[6px] h-[1.5px] bg-[#3B2B11]/70 z-20 pointer-events-none" />
                </div>
              )}

              {/* Inside paper container padding */}
              <div className={`${activeThemeObj.isScroll ? 'px-6 py-12 md:px-14 md:py-18' : 'py-2'}`}>
                {/* Inside-paper centered tiny subtitle */}
                {activeThemeObj.isScroll && (
                  <div className="text-center text-xs font-serif text-[#8C7D68]/75 tracking-widest mb-8 pb-3 border-b border-dashed border-[#EADFC9]">
                    <span>{activeNovel.title} · {formatChapterTitle(currentChapter.title)}</span>
                  </div>
                )}

                {/* Heading */}
                <h1 
                  className="font-serif font-bold leading-normal mb-10 text-center tracking-wide border-b border-dashed border-[#EADFC9] pb-6 text-[#2C1E1E]"
                  style={{ fontSize: `${fontSize * 1.35}px`, fontFamily: getFontFamilyStyle(fontFamily) }}
                >
                  {formatChapterTitle(currentChapter.title)}
                </h1>

                {/* Paragraphs body */}
                <div 
                  className="space-y-8 tracking-wide font-medium"
                  style={{ 
                    fontSize: `${fontSize}px`, 
                    lineHeight: lineHeight,
                    color: activeThemeObj.textHex,
                    fontFamily: getFontFamilyStyle(fontFamily)
                  }}
                >
                  {paragraphs.map((p, idx) => (
                    <p 
                      key={idx} 
                      className="text-justify leading-relaxed" 
                      style={{ textIndent: '2em' }}
                    >
                      {p.trim()}
                    </p>
                  ))}
                </div>

                {/* Empty screen */}
                {paragraphs.length === 0 && (
                  <div className="text-center py-12 opacity-60">
                    <p>本章暂无内容或为空白文本</p>
                  </div>
                )}

                {/* Chapter navigation */}
                <div className="mt-16 pt-8 border-t border-dashed opacity-85 flex justify-between gap-4">
                  <button
                    id="btn-prev-chapter"
                    disabled={activeChapterIndex === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeChapterIndex > 0) {
                        setActiveChapterIndex(activeChapterIndex - 1);
                        window.scrollTo({ top: 0, behavior: 'auto' });
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-3 border ${activeThemeObj.border} rounded-lg disabled:opacity-30 hover:bg-black/5 transition text-sm font-semibold`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一章
                  </button>
                  <button
                    id="btn-next-chapter"
                    disabled={activeChapterIndex === activeChapters.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeChapterIndex < activeChapters.length - 1) {
                        setActiveChapterIndex(activeChapterIndex + 1);
                        window.scrollTo({ top: 0, behavior: 'auto' });
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-3 border ${activeThemeObj.border} rounded-lg disabled:opacity-30 hover:bg-black/5 transition text-sm font-semibold`}
                  >
                    下一章
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Golden Scroll Bottom Roller Decor */}
              {activeThemeObj.isScroll && (
                <div className="relative h-[16px] w-[calc(100%+32px)] -ml-[16px] -mr-[16px] z-10 select-none shadow-[0_-3px_8px_rgba(0,0,0,0.45)] flex flex-col justify-between mt-12">
                  {/* High fidelity 3D cylinder background with bevel polygon caps */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-b from-[#8C6B2F] via-[#DFBF82] via-[#FDF3DA] via-[#CCAF71] to-[#60481E]" 
                    style={{ clipPath: 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0% 50%)' }}
                  />
                  {/* Top bright highlight line to give glossy look */}
                  <div className="absolute top-[2px] left-[6px] right-[6px] h-[1px] bg-[#FFFFFF]/55 z-20 pointer-events-none" />
                  {/* Bottom deep shadow line to construct physical depth */}
                  <div className="absolute bottom-[2px] left-[6px] right-[6px] h-[1.5px] bg-[#3B2B11]/70 z-20 pointer-events-none" />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Floating Menu: Settings & Tuning drawer */}
          <AnimatePresence>
            {isReaderToolbarOpen && (
              <motion.div
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 150, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className={`fixed bottom-0 left-0 right-0 z-40 border-t ${activeThemeObj.border} ${activeThemeObj.panelBg} p-4 md:px-8 shadow-md`}
              >
                <div className={`mx-auto ${CONTAINER_WIDTHS.find(w => w.id === containerWidth)?.class || 'max-w-3xl'} space-y-4`}>
                  
                  {/* Preferences Row 1: Font Size & Font Family */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Font Family */}
                    <div className="flex items-center justify-between gap-2 border-b md:border-b-0 md:border-r border-black/10 pb-3 md:pb-0 md:pr-4">
                      <span className={`font-semibold opacity-75 ${activeThemeObj.text}`}>排版字体</span>
                      <div className="flex gap-1.5">
                        {FONTS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setFontFamily(f.id)}
                            className={`px-2.5 py-1.5 rounded text-[11px] transition ${
                              fontFamily === f.id
                                ? `${activeThemeObj.accent} ${activeThemeObj.accentText} font-bold`
                                : 'bg-black/5 hover:bg-black/10'
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold opacity-75 ${activeThemeObj.text}`}>文字大小 ({fontSize}px)</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                          disabled={fontSize <= 14}
                          className="w-8 h-8 rounded bg-black/5 hover:bg-black/10 flex items-center justify-center text-sm font-bold disabled:opacity-40"
                        >
                          A-
                        </button>
                        <button
                          onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                          disabled={fontSize >= 32}
                          className="w-8 h-8 rounded bg-black/5 hover:bg-black/10 flex items-center justify-center text-sm font-bold disabled:opacity-40"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Preferences Row 2: Layout Width & Reading Theme */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-black/5">
                    {/* Theme selector */}
                    <div className="flex items-center justify-between gap-2 border-b md:border-b-0 md:border-r border-black/10 pb-3 md:pb-0 md:pr-4">
                      <span className={`font-semibold opacity-75 ${activeThemeObj.text}`}>配色主题</span>
                      <div className="flex gap-1">
                        {THEMES.map(themeItem => (
                          <button
                            key={themeItem.id}
                            onClick={() => setReaderTheme(themeItem.id)}
                            title={themeItem.name}
                            className={`w-6 h-6 rounded-full border flex-shrink-0 relative transition flex items-center justify-center ${themeItem.paperBg} ${
                              readerTheme === themeItem.id 
                                ? 'border-amber-700 ring-2 ring-amber-700/30 ring-offset-1' 
                                : 'border-black/10'
                            }`}
                          >
                            <span className="text-[9px] absolute opacity-45">{themeItem.name[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Width selector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold opacity-75 ${activeThemeObj.text}`}>显示页宽</span>
                      <div className="flex gap-1.5">
                        {CONTAINER_WIDTHS.map(w => (
                          <button
                            key={w.id}
                            onClick={() => setContainerWidth(w.id)}
                            className={`px-2 py-1.5 rounded text-[11px] transition ${
                              containerWidth === w.id
                                ? `${activeThemeObj.accent} ${activeThemeObj.accentText} font-bold`
                                : 'bg-black/5 hover:bg-black/10'
                            }`}
                          >
                            {w.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preferences Row 3: Auto Scroll (自动滚屏) Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs pt-3 border-t border-black/5 gap-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 opacity-70" />
                      <span className={`font-semibold opacity-75 ${activeThemeObj.text}`}>
                        自动滚屏: {autoScrollSpeed === 0 ? '已关闭' : `速度 ${autoScrollSpeed}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAutoScrollSpeed(0)}
                        className={`px-2 py-1.5 rounded transition text-[11px] ${
                          autoScrollSpeed === 0 
                            ? 'bg-amber-800 text-white font-medium' 
                            : 'bg-black/5 hover:bg-black/10'
                        }`}
                      >
                        停止
                      </button>
                      {[1, 3, 5, 8].map(speed => (
                        <button
                          key={speed}
                          onClick={() => setAutoScrollSpeed(speed)}
                          className={`w-7 h-7 rounded text-[11px] transition ${
                            autoScrollSpeed === speed 
                              ? 'bg-amber-800 text-white font-medium' 
                              : 'bg-black/5 hover:bg-black/10'
                          }`}
                        >
                          {speed}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Left Drawer: Chapters TOC & Bookmarks Sidebar */}
          <AnimatePresence>
            {isSidebarOpen && (
              <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div 
                  onClick={() => setIsSidebarOpen(false)}
                  className="absolute inset-0 bg-black/40 backdrop-blur-xs"
                />

                {/* Sidebar Panel */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'tween', duration: 0.2 }}
                  className={`relative w-80 h-full border-l ${activeThemeObj.border} ${activeThemeObj.panelBg} flex flex-col z-10 shadow-xl overflow-hidden`}
                >
                  {/* Close button */}
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className={`absolute top-4 left-4 p-1 rounded hover:bg-black/5 transition ${activeThemeObj.text}`}
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Top Tabs */}
                  <div className="flex justify-center border-b border-black/10 mt-14">
                    <button
                      onClick={() => setSidebarTab('chapters')}
                      className={`flex-1 py-3 text-sm font-semibold transition border-b-2 text-center ${
                        sidebarTab === 'chapters'
                          ? 'border-amber-800 text-amber-900 font-bold'
                          : 'border-transparent opacity-65'
                      }`}
                    >
                      书籍目录 ({activeChapters.length})
                    </button>
                    <button
                      onClick={() => setSidebarTab('bookmarks')}
                      className={`flex-1 py-3 text-sm font-semibold transition border-b-2 text-center ${
                        sidebarTab === 'bookmarks'
                          ? 'border-amber-800 text-amber-900 font-bold'
                          : 'border-transparent opacity-65'
                      }`}
                    >
                      我的书签 ({bookmarks.length})
                    </button>
                  </div>

                  {/* Sidebar Chapter Filter/Search */}
                  {sidebarTab === 'chapters' && (
                    <div className="p-3 border-b border-black/5">
                      <div className="relative">
                        <Search className="absolute left-2 top-2 w-3.5 h-3.5 opacity-55" />
                        <input
                          id="input-chapter-filter"
                          type="text"
                          placeholder="搜索章节或内容..."
                          value={chapterSearchQuery}
                          onChange={(e) => setChapterSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-6 py-1 bg-black/5 border-transparent rounded text-xs focus:outline-none focus:bg-black/10 text-[#2C2B29]"
                        />
                        {chapterSearchQuery && (
                          <button 
                            onClick={() => setChapterSearchQuery('')}
                            className="absolute right-2 top-2 text-gray-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sidebar Contents List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {/* Chapter list */}
                    {sidebarTab === 'chapters' && (
                      filteredChapterTOC.length === 0 ? (
                        <p className="text-xs text-center opacity-60 py-8">未匹配到相关章节</p>
                      ) : (
                        filteredChapterTOC.map((ch) => {
                          const isCurrent = ch.index === activeChapterIndex;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => {
                                setActiveChapterIndex(ch.index);
                                setIsSidebarOpen(false);
                                window.scrollTo({ top: 0, behavior: 'auto' });
                              }}
                              className={`w-full text-left p-2.5 rounded text-xs transition border flex items-center justify-between ${
                                isCurrent
                                  ? `${activeThemeObj.accent} ${activeThemeObj.accentText} border-transparent font-semibold`
                                  : 'border-transparent hover:bg-black/5'
                              }`}
                            >
                              <span className="truncate pr-2">{formatChapterTitle(ch.title)}</span>
                              <span className="text-[10px] opacity-65 flex-shrink-0">
                                {ch.content.length > 1000 
                                  ? `${(ch.content.length / 1000).toFixed(1)}k字` 
                                  : `${ch.content.length}字`}
                              </span>
                            </button>
                          );
                        })
                      )
                    )}

                    {/* Bookmarks list */}
                    {sidebarTab === 'bookmarks' && (
                      bookmarks.length === 0 ? (
                        <div className="text-center py-10 opacity-60">
                          <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">暂无书签。阅读时可在顶部点击书签图标保存。</p>
                        </div>
                      ) : (
                        bookmarks.map((bm) => (
                          <div
                            key={bm.id}
                            className="p-3 border border-black/5 bg-white/20 rounded-lg text-xs space-y-1.5 relative group hover:bg-white/40 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-serif font-bold text-amber-900 line-clamp-1 flex-1 pr-1">
                                {bm.chapterTitle}
                              </span>
                              <span className="text-[10px] opacity-65 flex-shrink-0">
                                偏移: {Math.round(bm.scrollPercent * 100)}%
                              </span>
                            </div>
                            <p className="opacity-75 leading-relaxed line-clamp-2 italic bg-black/5 p-1.5 rounded">
                              &ldquo;{bm.excerpt}&rdquo;
                            </p>
                            
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => handleJumpToBookmark(bm)}
                                className="text-[10px] text-amber-800 hover:underline font-semibold"
                              >
                                跳转
                              </button>
                              <button
                                onClick={async () => {
                                  await dbInstance.deleteBookmark(bm.id);
                                  const bms = await dbInstance.getBookmarksByNovel(activeNovel.id);
                                  setBookmarks(bms);
                                }}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
