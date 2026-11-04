import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules:[{userAgent:'*',allow:'/',disallow:[
      '/api/','/dashboard/','/login','/register','/tarifs',
    ]}],
    sitemap:publicSiteUrl()+'/sitemap.xml',
  };
}
