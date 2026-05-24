import { SiteNav } from '@/components/site-nav';
import { Hero } from '@/components/sections/hero';
import { PainSection } from '@/components/sections/pain';
import { OcrSection } from '@/components/sections/ocr';
import { HowItWorks } from '@/components/sections/how-it-works';
import { TimelineSection } from '@/components/sections/timeline';
import { Differentials } from '@/components/sections/differentials';
import { Results } from '@/components/sections/results';
import { DashboardPreview } from '@/components/sections/dashboard-preview';
import { SocialProof } from '@/components/sections/social-proof';
import { FinalCta } from '@/components/sections/final-cta';
import { SiteFooter } from '@/components/site-footer';

export default function Page() {
  return (
    <main className="relative overflow-x-clip">
      <SiteNav />
      <Hero />
      <PainSection />
      <OcrSection />
      <HowItWorks />
      <TimelineSection />
      <Differentials />
      <DashboardPreview />
      <Results />
      <SocialProof />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}
