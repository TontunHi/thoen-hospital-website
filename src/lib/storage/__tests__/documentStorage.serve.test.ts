import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentStorage } from '../documentStorage';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { Readable } from 'stream';

describe('DocumentStorage readBuffer and serveFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/').replace(/\\/g, '/').replace(/\/+/g, '/'));
    vi.spyOn(path, 'normalize').mockImplementation((p: string) => p.replace(/\\/g, '/'));
    vi.spyOn(fs, 'stat').mockImplementation(async () => ({ isFile: () => true } as any));
    vi.spyOn(fs, 'readFile').mockImplementation(async () => Buffer.from(''));
    // Make createReadStream return a real Readable stream so toWeb doesn't throw
    vi.spyOn(fsSync, 'createReadStream').mockImplementation(() => {
      const s = new Readable();
      s.push('hello');
      s.push(null);
      return s as any;
    });
  });

  describe('readBuffer', () => {
    it('returns buffer on happy path', async () => {
      (fs.stat as any).mockResolvedValue({ isFile: () => true } as any);
      (fs.readFile as any).mockResolvedValue(Buffer.from('hello'));

      const result = await DocumentStorage.readBuffer('public/uploads/test.txt');
      expect(result).toEqual(Buffer.from('hello'));
    });

    it('throws FILE_NOT_FOUND when missing file', async () => {
      const err = new Error('ENOENT');
      (err as any).code = 'ENOENT';
      (fs.stat as any).mockRejectedValue(err);

      await expect(DocumentStorage.readBuffer('public/uploads/missing.txt'))
        .rejects
        .toThrowError(/File not found|Not a file/);
    });
  });

  describe('serveFile', () => {
    it('returns 404 when missing file', async () => {
      (fs.stat as any).mockRejectedValue(new Error('ENOENT'));
      const req = new Request('http://localhost/test.jpg');
      
      const res = await DocumentStorage.serveFile('public/uploads/missing.jpg', req);
      expect(res.status).toBe(404);
    });

    it('returns full response when no range header', async () => {
      (fs.stat as any).mockResolvedValue({ isFile: () => true, size: 100 } as any);
      
      const req = new Request('http://localhost/test.mp4');
      const res = await DocumentStorage.serveFile('public/uploads/test.mp4', req);
      
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Length')).toBe('100');
      expect(res.headers.get('Content-Type')).toBe('video/mp4');
    });

    it('returns 206 with Range header', async () => {
      (fs.stat as any).mockResolvedValue({ isFile: () => true, size: 100 } as any);
      const req = new Request('http://localhost/test.mp4', {
        headers: { 'Range': 'bytes=10-20' }
      });

      const res = await DocumentStorage.serveFile('public/uploads/test.mp4', req);
      
      expect(res.status).toBe(206);
      expect(res.headers.get('Content-Length')).toBe('11');
      expect(res.headers.get('Content-Range')).toBe('bytes 10-20/100');
    });

    it('returns 416 on out of range', async () => {
      (fs.stat as any).mockResolvedValue({ isFile: () => true, size: 100 } as any);
      const req = new Request('http://localhost/test.mp4', {
        headers: { 'Range': 'bytes=100-200' }
      });

      const res = await DocumentStorage.serveFile('public/uploads/test.mp4', req);
      
      expect(res.status).toBe(416);
      expect(res.headers.get('Content-Range')).toBe('bytes */100');
    });
  });
});
