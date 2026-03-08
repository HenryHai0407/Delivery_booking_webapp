"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PresignResponse = {
  key: string;
  uploadUrl: string;
  storageUrl: string;
  method?: "PUT";
  error?: string;
};

function uploadViaXhr(args: {
  url: string;
  file: File;
  method: string;
  onProgress: (percent: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(args.method, args.url);
    xhr.setRequestHeader("Content-Type", args.file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      args.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed due to network error."));
    xhr.send(args.file);
  });
}

export function PodUploader({
  bookingId,
  disabled,
  onPersisted
}: {
  bookingId: string;
  disabled?: boolean;
  onPersisted: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const notesRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    if (!file) {
      setError("Select a POD photo first.");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    setProgress(0);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, filename: file.name })
      });
      const presign = (await presignRes.json()) as PresignResponse;
      if (!presignRes.ok || !presign.key || !presign.uploadUrl || !presign.storageUrl) {
        throw new Error(presign.error || "Failed to request upload URL.");
      }

      await uploadViaXhr({
        url: presign.uploadUrl,
        file,
        method: presign.method || "PUT",
        onProgress: setProgress
      });

      const persistRes = await fetch(`/api/driver/jobs/${bookingId}/pod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: presign.key,
          storageUrl: presign.storageUrl,
          notes: notesRef.current?.value || "POD uploaded"
        })
      });
      const payload = (await persistRes.json().catch(() => null)) as { error?: string } | null;
      if (!persistRes.ok) throw new Error(payload?.error || "Failed to save POD metadata.");

      setSuccess("POD uploaded successfully.");
      setFile(null);
      setProgress(100);
      if (notesRef.current) notesRef.current.value = "";
      await onPersisted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <h4 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
        <Camera className="h-4 w-4" /> Proof of Delivery
      </h4>
      <Input
        type="file"
        accept="image/*"
        disabled={uploading || disabled}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        aria-label="Upload POD photo"
      />
      <Input ref={notesRef} placeholder="POD notes (optional)" disabled={uploading || disabled} />
      {uploading ? <p className="text-xs text-slate-600">Uploading... {progress}%</p> : null}
      {success ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertTitle className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Uploaded
          </AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="h-11 w-full rounded-xl" disabled={uploading || disabled || !file} onClick={() => void submit()}>
        <Upload className="mr-1 h-4 w-4" />
        {uploading ? "Uploading..." : "Upload POD"}
      </Button>
    </section>
  );
}

