import { Move, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cropImageToDataUrl } from './avatar-image';

export function AvatarCropDialog({
  source,
  busy,
  error,
  onOpenChange,
  onSave,
  onCropError,
}: {
  source: string | null;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (image: string) => Promise<void>;
  onCropError: () => void;
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  }, [source]);

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => setCroppedArea(pixels), []);
  const save = async () => {
    if (!source || !croppedArea) return;
    setRendering(true);
    let image: string;
    try {
      image = await cropImageToDataUrl(source, croppedArea);
    } catch {
      onCropError();
      setRendering(false);
      return;
    }
    try {
      await onSave(image);
    } catch {
      // The upload error is translated and displayed by the parent component.
    } finally {
      setRendering(false);
    }
  };
  const isBusy = busy || rendering;
  const zoomPercent = Math.round(zoom * 100);

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => { if (!isBusy) onOpenChange(open); }}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" closeLabel={t('common.close')}>
        <div className="px-5 pb-4 pt-5 pr-14 sm:px-6 sm:pt-6">
          <DialogTitle className="text-lg font-semibold">{t('preferences.cropPhotoTitle')}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6 text-muted-foreground">{t('preferences.cropPhotoDescription')}</DialogDescription>
        </div>

        <div className="relative h-[min(52vh,420px)] min-h-64 overflow-hidden bg-secondary">
          {source ? <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={3}
            aspect={1}
            cropShape="round"
            showGrid={false}
            roundCropAreaPixels
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
            disableAutomaticStylesInjection
            mediaProps={{ alt: t('preferences.cropPreviewAlt') }}
            cropperProps={{ 'aria-label': t('preferences.cropAreaLabel') }}
          /> : null}
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Move className="size-4" aria-hidden="true" />{t('preferences.cropPhotoInstruction')}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="avatar-zoom">{t('preferences.photoZoom')}</Label>
              <output htmlFor="avatar-zoom" className="text-xs font-medium tabular-nums text-muted-foreground">{zoomPercent}%</output>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.currentTarget.value))}
                className="h-10 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-valuetext={`${zoomPercent}%`}
                disabled={isBusy}
              />
              <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <MutationNotice message={error} type="error" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="button" loading={isBusy} disabled={!croppedArea} onClick={() => { void save(); }}>{t('preferences.savePhoto')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
