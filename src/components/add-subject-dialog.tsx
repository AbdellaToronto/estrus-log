"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSubject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SUBJECT_COAT_COLOURS,
  SUBJECT_COAT_COLOUR_LABELS,
} from "@/lib/subject-metadata";

export function AddSubjectDialog({
  cohortId,
  open,
  onOpenChange,
}: {
  cohortId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("cohortId", cohortId);
    setError(null);

    startTransition(async () => {
      try {
        await createSubject(formData);
        formRef.current?.reset();
        onOpenChange(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The mouse could not be added.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setError(null);
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="border-[#d9d4c8] bg-[#fbfaf7] sm:max-w-xl">
        <DialogHeader>
          <p className="page-eyebrow">Subject identity</p>
          <DialogTitle className="font-serif text-3xl text-[#292b4c]">
            Add a mouse
          </DialogTitle>
          <DialogDescription className="leading-6 text-[#625f58]">
            Use the identifier on the cage or study sheet. Coat colour and strain make later model checks auditable by subgroup.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject-name">Mouse ID</Label>
            <Input
              id="subject-name"
              name="name"
              placeholder="e.g. M-014"
              autoComplete="off"
              required
              autoFocus
              className="h-11 border-[#d9d4c8] bg-white"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject-coat">Coat colour</Label>
              <select
                id="subject-coat"
                name="coat_colour"
                defaultValue=""
                className="h-11 w-full rounded-md border border-[#d9d4c8] bg-white px-3 text-sm text-[#292b4c] outline-none focus:border-[#777bc0] focus:ring-2 focus:ring-[#d8d8f1]"
              >
                <option value="">Choose colour</option>
                {SUBJECT_COAT_COLOURS.map((colour) => (
                  <option key={colour} value={colour}>
                    {SUBJECT_COAT_COLOUR_LABELS[colour]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-strain">Strain</Label>
              <Input
                id="subject-strain"
                name="strain"
                placeholder="e.g. C57BL/6J"
                autoComplete="off"
                className="h-11 border-[#d9d4c8] bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject-cage">Cage number <span className="font-normal text-[#77736c]">(optional)</span></Label>
            <Input
              id="subject-cage"
              name="cage_number"
              placeholder="e.g. C-27"
              autoComplete="off"
              className="h-11 border-[#d9d4c8] bg-white"
            />
          </div>

          {error && (
            <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#454a9f] text-white hover:bg-[#383d89]">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save mouse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
