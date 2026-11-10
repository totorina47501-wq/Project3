import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const root=publicSiteUrl();
  return [
    {url:root+'/',changeFrequency:'weekly',priority:1},
    {url:root+'/guide/checklist-influence',changeFrequency:'weekly',priority:0.7},
  ];
}
