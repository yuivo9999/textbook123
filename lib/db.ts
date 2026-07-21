export interface Novel {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  size: number; // in bytes
  wordCount: number;
  description: string;
  lastReadChapterId?: string;
  lastReadChapterIndex?: number;
  progress: number; // 0 to 100
  scrollOffset?: number; // saved scroll position in reading screen
  addedAt: number;
  lastReadAt?: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  index: number; // 0-based index for ordering
}

export interface Bookmark {
  id: string;
  novelId: string;
  chapterId: string;
  chapterTitle: string;
  excerpt: string;
  scrollPercent: number;
  addedAt: number;
}

const DB_NAME = 'LocalNovelReaderDB';
const DB_VERSION = 1;

export class NovelDatabase {
  private db: IDBDatabase | null = null;

  init(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        
        // Novels store
        if (!db.objectStoreNames.contains('novels')) {
          db.createObjectStore('novels', { keyPath: 'id' });
        }

        // Chapters store (with index on novelId to fetch chapters by book easily)
        if (!db.objectStoreNames.contains('chapters')) {
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
          chapterStore.createIndex('novelId', 'novelId', { unique: false });
          chapterStore.createIndex('novelId_index', ['novelId', 'index'], { unique: true });
        }

        // Bookmarks store
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bookmarkStore.createIndex('novelId', 'novelId', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // --- Novel Operations ---
  async getAllNovels(): Promise<Novel[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('novels', 'readonly');
      const store = transaction.objectStore('novels');
      const request = store.getAll();

      request.onsuccess = () => {
        const novels = request.result as Novel[];
        // Sort by lastReadAt or addedAt desc
        novels.sort((a, b) => {
          const valA = a.lastReadAt || a.addedAt;
          const valB = b.lastReadAt || b.addedAt;
          return valB - valA;
        });
        resolve(novels);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getNovel(id: string): Promise<Novel | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('novels', 'readonly');
      const store = transaction.objectStore('novels');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNovel(novel: Novel): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('novels', 'readwrite');
      const store = transaction.objectStore('novels');
      const request = store.put(novel);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNovel(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['novels', 'chapters', 'bookmarks'], 'readwrite');
      
      // Delete novel
      transaction.objectStore('novels').delete(id);

      // Delete all related chapters
      const chapterStore = transaction.objectStore('chapters');
      const chapterIndex = chapterStore.index('novelId');
      const chapterRequest = chapterIndex.openCursor(IDBKeyRange.only(id));
      chapterRequest.onsuccess = (event) => {
        const cursor = chapterRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete all related bookmarks
      const bookmarkStore = transaction.objectStore('bookmarks');
      const bookmarkIndex = bookmarkStore.index('novelId');
      const bookmarkRequest = bookmarkIndex.openCursor(IDBKeyRange.only(id));
      bookmarkRequest.onsuccess = () => {
        const cursor = bookmarkRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- Chapter Operations ---
  async getChaptersByNovel(novelId: string): Promise<Chapter[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chapters', 'readonly');
      const store = transaction.objectStore('chapters');
      const index = store.index('novelId');
      const request = index.getAll(IDBKeyRange.only(novelId));

      request.onsuccess = () => {
        const chapters = request.result as Chapter[];
        chapters.sort((a, b) => a.index - b.index);
        resolve(chapters);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveChapter(chapter: Chapter): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chapters', 'readwrite');
      const store = transaction.objectStore('chapters');
      const request = store.put(chapter);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async bulkSaveChapters(chapters: Chapter[]): Promise<void> {
    if (chapters.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chapters', 'readwrite');
      const store = transaction.objectStore('chapters');

      let i = 0;
      function putNext() {
        if (i < chapters.length) {
          const req = store.put(chapters[i]);
          req.onsuccess = putNext;
          req.onerror = () => reject(req.error);
          i++;
        } else {
          resolve();
        }
      }
      putNext();
    });
  }

  async deleteChapter(chapterId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chapters', 'readwrite');
      const store = transaction.objectStore('chapters');
      const request = store.delete(chapterId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Bookmark Operations ---
  async getBookmarksByNovel(novelId: string): Promise<Bookmark[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('bookmarks', 'readonly');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('novelId');
      const request = index.getAll(IDBKeyRange.only(novelId));

      request.onsuccess = () => {
        const bookmarks = request.result as Bookmark[];
        bookmarks.sort((a, b) => b.addedAt - a.addedAt);
        resolve(bookmarks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('bookmarks', 'readwrite');
      const store = transaction.objectStore('bookmarks');
      const request = store.put(bookmark);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('bookmarks', 'readwrite');
      const store = transaction.objectStore('bookmarks');
      const request = store.delete(bookmarkId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbInstance = new NovelDatabase();
