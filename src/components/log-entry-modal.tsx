'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, Check, AlertCircle } from "lucide-react"
import Image from 'next/image';
import { getUploadUrl, createLog } from "@/app/actions";

type ClassificationResult = {
  estrus_stage: 'Proestrus' | 'Estrus' | 'Metestrus' | 'Diestrus';
  confidence_scores: Record<string, number>;
  features: {
    vaginal_opening: string;
    tissue_color: string;
    swelling: string;
    moisture: string;
  };
  reasoning: string;
};

export function LogEntryModal({ subjectId, onLogCreated }: { subjectId: string, onLogCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmedStage, setConfirmedStage] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  };

  const handleClassify = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/classify', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Classification failed');
      
      const data = await res.json();
      setResult(data);
      setConfirmedStage(data.estrus_stage);
    } catch (error) {
      console.error(error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

// ... inside component ...

  const handleSave = async () => {
    if (!file || !result) return;
    setLoading(true);
    
    try {
      // 1. Get Signed URL
      const { url, publicUrl } = await getUploadUrl(file.name, file.type);
      
      // 2. Upload to GCS
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      // 3. Create Log Entry
      await createLog({
        subjectId,
        stage: confirmedStage,
        confidence: result.confidence_scores,
        features: result.features,
        imageUrl: publicUrl,
        notes
      });
      
      onLogCreated();
      setOpen(false);
    } catch (error) {
      console.error("Error saving log:", error);
      // Ideally show a toast here
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Log New Entry</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Estrus State</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {!result ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-full">
                <Label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    </div>
                  )}
                  <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                </Label>
              </div>
              
              <Button onClick={handleClassify} disabled={!file || loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Analyzing...' : 'Analyze Image'}
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                  {preview && <img src={preview} alt="Analyzed" className="object-cover w-full h-full" />}
                </div>
                
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Add any additional observations..." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">AI Analysis</h3>
                    <span className="text-sm text-muted-foreground">
                      Confidence: {(result.confidence_scores[result.estrus_stage] * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Opening:</div>
                    <div>{result.features.vaginal_opening}</div>
                    <div className="font-medium">Color:</div>
                    <div>{result.features.tissue_color}</div>
                    <div className="font-medium">Swelling:</div>
                    <div>{result.features.swelling}</div>
                    <div className="font-medium">Moisture:</div>
                    <div>{result.features.moisture}</div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {result.reasoning}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmed Stage</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Proestrus', 'Estrus', 'Metestrus', 'Diestrus'].map((stage) => (
                      <Button
                        key={stage}
                        variant={confirmedStage === stage ? "default" : "outline"}
                        onClick={() => setConfirmedStage(stage)}
                        className="w-full"
                      >
                        {stage}
                        {confirmedStage === stage && <Check className="ml-2 h-4 w-4" />}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setResult(null)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    Save Entry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
