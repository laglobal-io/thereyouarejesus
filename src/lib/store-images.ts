import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Finds product photos in public/store/<id>-1.jpg, -2.jpg, ... at build time.
export function productImages(id: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const ext = ['jpg', 'jpeg', 'png', 'webp'].find((e) => existsSync(join(process.cwd(), 'public', 'store', `${id}-${i}.${e}`)));
    if (!ext) break;
    out.push(`/store/${id}-${i}.${ext}`);
  }
  return out;
}
