import { BrandDeals } from '@/components/BrandDeals';
export const dynamic='force-dynamic';
export default function BrandDealsPage() {
  return <section className="space-y-6">
    <h1 className="font-heading text-4xl font-bold">Mes collaborations commerciales</h1>
    <p className="text-slate-600">Prépare tes collaborations et relie tes vérifications personnelles. L’archivage fige un snapshot horodaté avec une empreinte SHA-256 ; il ne constitue ni un certificat juridique ni un horodatage par tiers de confiance.</p>
    <BrandDeals/>
  </section>;
}
