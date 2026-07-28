import Image from "next/image";
import { cn } from "@/lib/utils";

const ICON_ROOT = "/assets/generated/asset-studio/0b2fc827-c087-4b69-bfac-d20222ad8a8b/icons";

const iconFiles = {
  "animal-subject": "01-animal-subject.svg",
  "capture-date": "02-capture-date.svg",
  microscope: "03-microscope.svg",
  "sample-vial": "04-sample-vial.svg",
  inspect: "05-inspect.svg",
  camera: "06-camera.svg",
  upload: "07-upload.svg",
  cycle: "08-cycle.svg",
  confirm: "09-confirm.svg",
  "review-needed": "10-review-needed.svg",
  evidence: "11-evidence.svg",
  "sample-tag": "12-sample-tag.svg",
  scale: "13-scale.svg",
  exposure: "14-exposure.svg",
  "paired-images": "15-paired-images.svg",
  notes: "16-notes.svg",
} as const;

export type EstrusIconName = keyof typeof iconFiles;

export function EstrusIcon({
  name,
  className,
  label,
}: {
  name: EstrusIconName;
  className?: string;
  label?: string;
}) {
  return (
    <Image
      src={`${ICON_ROOT}/${iconFiles[name]}`}
      width={512}
      height={512}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}
