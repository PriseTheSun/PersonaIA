import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/shared/app-logo';
import { cn } from '@/lib/utils';

const slides = [
  { image: '/images/auth/research-analysis.jpg', titleKey: 'authCarousel.researchTitle', descriptionKey: 'authCarousel.researchDescription' },
  { image: '/images/auth/audience-context.jpg', titleKey: 'authCarousel.personasTitle', descriptionKey: 'authCarousel.personasDescription' },
  { image: '/images/auth/research-decisions.jpg', titleKey: 'authCarousel.decisionsTitle', descriptionKey: 'authCarousel.decisionsDescription' },
  { image: '/images/auth/persona-simulation-v2.png', titleKey: 'authCarousel.simulationTitle', descriptionKey: 'authCarousel.simulationDescription' },
  { image: '/images/auth/project-governance.jpg', titleKey: 'authCarousel.governanceTitle', descriptionKey: 'authCarousel.governanceDescription' },
] as const;

export function AuthBrandPanel() {
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (manuallyPaused || interactionPaused || reducedMotion) return undefined;
    const timeout = window.setTimeout(() => setActiveSlide((current) => (current + 1) % slides.length), 6500);
    return () => window.clearTimeout(timeout);
  }, [activeSlide, interactionPaused, manuallyPaused, reducedMotion]);

  const active = slides[activeSlide];

  return (
    <aside
      className="relative m-3 hidden min-h-[626px] overflow-hidden rounded-lg bg-secondary text-secondary-foreground lg:block"
      aria-label={t('authCarousel.label')}
      aria-roledescription="carousel"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false); }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {slides.map((slide, index) => (
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className={cn('absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', index === activeSlide && 'auth-carousel-image-active opacity-100')}
          />
        ))}
        <div className="absolute inset-0 bg-secondary/30" />
      </div>

      <div className="relative z-10 flex h-full min-h-[626px] flex-col justify-between p-10 xl:p-12">
        <AppLogo tone="inverse" />
        <div className="mt-auto max-w-md pb-16">
          <div key={activeSlide} className="auth-carousel-copy">
            <p className="text-sm font-medium text-secondary-foreground/80">{t('auth.brandKicker')}</p>
            <p className="mt-3 text-3xl font-semibold leading-[1.16] tracking-[-0.035em]">{t(active.titleKey)}</p>
            <p className="mt-3 max-w-[46ch] text-sm leading-6 text-secondary-foreground/80">{t(active.descriptionKey)}</p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1" role="group" aria-label={t('authCarousel.controls')}>
          {!reducedMotion ? (
            <button type="button" className="grid size-11 place-items-center rounded-md text-secondary-foreground/80 transition-colors hover:bg-secondary-foreground/10 hover:text-secondary-foreground" aria-label={t(manuallyPaused ? 'authCarousel.play' : 'authCarousel.pause')} onClick={() => setManuallyPaused((paused) => !paused)}>
              {manuallyPaused ? <Play className="size-4" fill="currentColor" aria-hidden="true" /> : <Pause className="size-4" fill="currentColor" aria-hidden="true" />}
            </button>
          ) : null}
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.image}
              className="grid size-11 place-items-center rounded-md"
              aria-label={t('authCarousel.goToSlide', { number: index + 1, title: t(slide.titleKey) })}
              aria-current={index === activeSlide ? 'true' : undefined}
              onClick={() => setActiveSlide(index)}
            >
              <span className={cn('h-1.5 rounded-full bg-secondary-foreground/45 transition-[width,background-color] duration-200', index === activeSlide ? 'w-7 bg-secondary-foreground' : 'w-2')} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
