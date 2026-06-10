export interface DbAttachment {
  id: number;
  newsId: number;
  filePath: string;
  fileType: string | null;
  originalName: string | null;
  createdAt: Date;
}

export interface DbNews {
  id: number;
  title: string;
  slug: string;
  category: string;
  youtubeLink: string | null;
  startDate: Date;
  endDate: Date;
  viewCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: DbAttachment[];
}

export interface NewsImage {
  id: number;
  imageUrl: string;
  order: number;
}

export interface NewsListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  youtubeUrl: string | null;
  pdfUrl: string | null;
  status: string;
  category: string;
  views: number;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  images: NewsImage[];
}
