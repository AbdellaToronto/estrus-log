'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ZoomIn, ZoomOut } from 'lucide-react';

export type PreparedRoiMetadata = {
  source_width: number;
  source_height: number;
  output_width: number;
  output_height: number;
  zoom: number;
  horizontal_position: number;
  vertical_position: number;
  processor_field_fraction: number;
  processor_field_fraction_x: number;
  processor_field_fraction_y: number;
  crop_aspect_ratio: number;
  proposal_quality_score?: number;
  proposal_quality_gate?: "pass" | "intervention";
  crop_box_pixels: [number, number, number, number];
};

export const EXTERNAL_ROI_REFERENCE_WIDTH = 83;
export const EXTERNAL_ROI_REFERENCE_HEIGHT = 128;
export const EXTERNAL_ROI_OUTPUT_WIDTH = 415;
export const EXTERNAL_ROI_OUTPUT_HEIGHT = 640;
export const EXTERNAL_ROI_ASPECT_RATIO = EXTERNAL_ROI_REFERENCE_WIDTH / EXTERNAL_ROI_REFERENCE_HEIGHT;
// Full-session lab photos contain substantially more surrounding anatomy than
// the already-tight 83x128 public benchmark images. On the 3024x4032 capture
// protocol used by this lab, 10x puts the target at approximately the same
// relative scale as the public training frames while keeping room to recenter.
export const EXTERNAL_ROI_DEFAULT_ZOOM = 10;
export const EXTERNAL_ROI_MAX_ZOOM = 16;
export const DINO_FIELD_FRACTION_X = 224 / 256;
export const DINO_FIELD_FRACTION_Y = 224 / Math.round(EXTERNAL_ROI_OUTPUT_HEIGHT * 256 / EXTERNAL_ROI_OUTPUT_WIDTH);

export const getExternalRoiDefaultZoom = (sourceWidth: number, sourceHeight: number) => {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const alreadyPrepared =
    Math.abs(sourceAspectRatio - EXTERNAL_ROI_ASPECT_RATIO) <= 0.02 &&
    sourceWidth <= EXTERNAL_ROI_OUTPUT_WIDTH * 1.5 &&
    sourceHeight <= EXTERNAL_ROI_OUTPUT_HEIGHT * 1.5;
  return alreadyPrepared ? 1 : EXTERNAL_ROI_DEFAULT_ZOOM;
};

export function PreparedRoiCropper({
  file,
  onPrepared,
  onFramingChange,
  initialMetadata,
  compact = false,
}: {
  file: File;
  onPrepared: (prepared: File, metadata: PreparedRoiMetadata) => void;
  onFramingChange: () => void;
  initialMetadata?: Partial<PreparedRoiMetadata> | null;
  compact?: boolean;
}) {
  const zoomId = useId();
  const horizontalId = useId();
  const verticalId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preparedCallback = useRef(onPrepared);
  const renderGeneration = useRef(0);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(initialMetadata?.zoom ?? EXTERNAL_ROI_DEFAULT_ZOOM);
  const [horizontal, setHorizontal] = useState(initialMetadata?.horizontal_position ?? 0.5);
  const [vertical, setVertical] = useState(initialMetadata?.vertical_position ?? 0.5);

  useEffect(() => {
    preparedCallback.current = onPrepared;
  }, [onPrepared]);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setZoom(initialMetadata?.zoom ?? getExternalRoiDefaultZoom(image.naturalWidth, image.naturalHeight));
      setSource(image);
    };
    image.src = objectUrl;
    return () => {
      URL.revokeObjectURL(objectUrl);
      setSource(null);
    };
  }, [file, initialMetadata?.zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const generation = ++renderGeneration.current;
    const baseCropWidth = Math.min(
      source.naturalWidth,
      source.naturalHeight * EXTERNAL_ROI_ASPECT_RATIO
    );
    const cropWidth = baseCropWidth / zoom;
    const cropHeight = cropWidth / EXTERNAL_ROI_ASPECT_RATIO;
    const left = (source.naturalWidth - cropWidth) * horizontal;
    const top = (source.naturalHeight - cropHeight) * vertical;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = EXTERNAL_ROI_OUTPUT_WIDTH;
    canvas.height = EXTERNAL_ROI_OUTPUT_HEIGHT;
    context.drawImage(
      source,
      left,
      top,
      cropWidth,
      cropHeight,
      0,
      0,
      EXTERNAL_ROI_OUTPUT_WIDTH,
      EXTERNAL_ROI_OUTPUT_HEIGHT
    );
    canvas.toBlob((blob) => {
      // Range inputs can schedule several encodes in quick succession. Ignore
      // any result that no longer matches the framing visible on the canvas so
      // an older JPEG can never overwrite the crop the scientist just chose.
      if (!blob || generation !== renderGeneration.current) return;
      const stem = file.name.replace(/\.[^.]+$/, '') || 'observation';
      preparedCallback.current(
        new File([blob], `${stem}-prepared-roi.jpg`, { type: 'image/jpeg' }),
        {
          source_width: source.naturalWidth,
          source_height: source.naturalHeight,
          output_width: EXTERNAL_ROI_OUTPUT_WIDTH,
          output_height: EXTERNAL_ROI_OUTPUT_HEIGHT,
          zoom,
          horizontal_position: horizontal,
          vertical_position: vertical,
          processor_field_fraction: DINO_FIELD_FRACTION_X,
          processor_field_fraction_x: DINO_FIELD_FRACTION_X,
          processor_field_fraction_y: DINO_FIELD_FRACTION_Y,
          crop_aspect_ratio: EXTERNAL_ROI_ASPECT_RATIO,
          crop_box_pixels: [left, top, left + cropWidth, top + cropHeight].map(Math.round) as [number, number, number, number],
        }
      );
    }, 'image/jpeg', 0.95);
  }, [file.name, horizontal, source, vertical, zoom]);

  const update = (setter: (value: number) => void, value: number) => {
    setter(value);
    onFramingChange();
  };

  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value));

  const crop = source
    ? (() => {
        const baseWidth = Math.min(
          source.naturalWidth,
          source.naturalHeight * EXTERNAL_ROI_ASPECT_RATIO
        );
        const width = baseWidth / zoom;
        const height = width / EXTERNAL_ROI_ASPECT_RATIO;
        const left = (source.naturalWidth - width) * horizontal;
        const top = (source.naturalHeight - height) * vertical;
        return {
          width,
          height,
          left,
          top,
          pixels: [left, top, left + width, top + height].map(Math.round) as [number, number, number, number],
        };
      })()
    : null;

  return (
    <section
      className={`grid gap-4 border border-[#ded9cd] bg-[#fbfaf7] p-4 ${compact ? "" : "md:grid-cols-[minmax(0,1fr)_220px]"}`}
      aria-labelledby={`${zoomId}-title`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#625f58]">Prepared model ROI</p><h3 id={`${zoomId}-title`} className="mt-1 font-serif text-xl text-[#292b4c]">Center the external genital region</h3></div>
          <span className="text-xs font-medium text-[#5f5c56]">83:128 training frame</span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#625f58]">
              <span>Full source</span>
              <span>Crop box</span>
            </div>
            <div
              className="relative mx-auto w-full overflow-hidden bg-[#e9e4d9]"
              style={{ aspectRatio: source ? `${source.naturalWidth} / ${source.naturalHeight}` : '1 / 1' }}
            >
              {source && (
                // The browser-owned object URL is the exact selected file.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.src} alt="Full selected source" className="h-full w-full object-contain" />
              )}
              {source && crop && (
                <div
                  className="pointer-events-none absolute border-2 border-[#6b70be] bg-[#6b70be]/10 shadow-[0_0_0_999px_rgba(25,24,20,0.18)]"
                  style={{
                    left: `${(crop.left / source.naturalWidth) * 100}%`,
                    top: `${(crop.top / source.naturalHeight) * 100}%`,
                    width: `${(crop.width / source.naturalWidth) * 100}%`,
                    height: `${(crop.height / source.naturalHeight) * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  <span className="absolute left-1 top-1 bg-[#292b4c]/90 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                    Selected ROI
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#625f58]">
              <span>Prepared crop</span>
              <span>{EXTERNAL_ROI_OUTPUT_WIDTH} × {EXTERNAL_ROI_OUTPUT_HEIGHT}</span>
            </div>
            <div
              className="relative mx-auto w-full overflow-hidden bg-[#e9e4d9]"
              style={{ aspectRatio: `${EXTERNAL_ROI_OUTPUT_WIDTH} / ${EXTERNAL_ROI_OUTPUT_HEIGHT}` }}
            >
              <canvas ref={canvasRef} className="h-full w-full" aria-label="Prepared ROI preview" />
              <div
                className="pointer-events-none absolute border border-dashed border-[#fff8e7] shadow-[0_0_0_999px_rgba(25,24,20,0.16)]"
                style={{
                  left: `${((1 - DINO_FIELD_FRACTION_X) / 2) * 100}%`,
                  right: `${((1 - DINO_FIELD_FRACTION_X) / 2) * 100}%`,
                  top: `${((1 - DINO_FIELD_FRACTION_Y) / 2) * 100}%`,
                  bottom: `${((1 - DINO_FIELD_FRACTION_Y) / 2) * 100}%`,
                }}
                aria-hidden="true"
              />
              <span className="pointer-events-none absolute left-[7.5%] top-[23%] bg-[#292b4c]/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Exact model field</span>
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 after:absolute after:left-1/2 after:top-[-5px] after:h-[30px] after:w-px after:-translate-x-1/2 after:bg-white/70 before:absolute before:left-[-5px] before:top-1/2 before:h-px before:w-[30px] before:-translate-y-1/2 before:bg-white/70" aria-hidden="true" />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#5f5c56]">
          The portrait crop matches every image in the public training set. The dashed square is the exact center field retained by the frozen DINO processor.
        </p>
      </div>
      <div className={`space-y-5 ${compact ? "" : "md:pt-12"}`}>
        <div className="grid grid-cols-6 gap-1" aria-label="Crop nudge controls">
          {[
            { label: 'Zoom out', icon: ZoomOut, action: () => update(setZoom, clamp(zoom - 0.5, 1, EXTERNAL_ROI_MAX_ZOOM)) },
            { label: 'Move left', icon: ArrowLeft, action: () => update(setHorizontal, clamp(horizontal - 0.03, 0, 1)) },
            { label: 'Move up', icon: ArrowUp, action: () => update(setVertical, clamp(vertical - 0.03, 0, 1)) },
            { label: 'Move down', icon: ArrowDown, action: () => update(setVertical, clamp(vertical + 0.03, 0, 1)) },
            { label: 'Move right', icon: ArrowRight, action: () => update(setHorizontal, clamp(horizontal + 0.03, 0, 1)) },
            { label: 'Zoom in', icon: ZoomIn, action: () => update(setZoom, clamp(zoom + 0.5, 1, EXTERNAL_ROI_MAX_ZOOM)) },
          ].map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="flex h-8 items-center justify-center border border-[#d5d2c8] bg-white text-[#454a9f] transition-colors hover:bg-[#eeedf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454a9f]"
              aria-label={label}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        <label htmlFor={zoomId} className="block text-xs font-semibold text-[#292b4c]">Zoom <span className="font-normal text-[#5f5c56]">{zoom.toFixed(2)}×</span></label>
        <input id={zoomId} type="range" min="1" max={EXTERNAL_ROI_MAX_ZOOM} step="0.05" value={zoom} onChange={(event) => update(setZoom, Number(event.target.value))} className="w-full accent-[#454a9f]" />
        <label htmlFor={horizontalId} className="block text-xs font-semibold text-[#292b4c]">Move left / right</label>
        <input id={horizontalId} type="range" min="0" max="1" step="0.01" value={horizontal} onChange={(event) => update(setHorizontal, Number(event.target.value))} className="w-full accent-[#454a9f]" />
        <label htmlFor={verticalId} className="block text-xs font-semibold text-[#292b4c]">Move up / down</label>
        <input id={verticalId} type="range" min="0" max="1" step="0.01" value={vertical} onChange={(event) => update(setVertical, Number(event.target.value))} className="w-full accent-[#454a9f]" />
        {source && crop && (
          <div className="border border-[#ded9cd] bg-white p-3 text-xs leading-5 text-[#625f58]">
            <p className="font-semibold text-[#292b4c]">Crop coordinates</p>
            <p>{crop.pixels[0]}, {crop.pixels[1]} → {crop.pixels[2]}, {crop.pixels[3]} px</p>
            <p className="mt-1">Source {source.naturalWidth} × {source.naturalHeight} px</p>
          </div>
        )}
      </div>
    </section>
  );
}
