import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: '本地小说阅读器 - Local Novel Reader',
  description: '一款纯本地、干净、高效的网页小说阅读器。支持 TXT 导入，完全本地存储，无任何广告或 AI 干扰。',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
