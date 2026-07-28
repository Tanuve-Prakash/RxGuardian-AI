import React, { useRef, useState } from 'react';
import { UploadCloud, FileImage, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ImageUploaderProps {
  onUpload: (resizedFile: File) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUpload,
  isLoading,
  error,
  onRetry
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // Client-side Canvas resize (max 1500px longest side, JPEG quality 80%, no OpenCV)
  const processAndResizeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (file.size > 10 * 1024 * 1024) {
        return reject(new Error('File exceeds 10MB maximum limit. Please select a smaller file.'));
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDimension = 1500;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context initialization failed'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas image processing failed'));
            }
            const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(resizedFile);
          },
          'image/jpeg',
          0.80 // JPEG quality 80%
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid image file or corrupt format.'));
      };

      img.src = url;
    });
  };

  const handleFileSelect = async (file: File) => {
    try {
      setProcessingStatus('Optimizing image canvas (max 1500px)...');
      const resized = await processAndResizeImage(file);
      setSelectedFile(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setProcessingStatus(null);
      onUpload(resized);
    } catch (err) {
      setProcessingStatus(null);
      alert((err as Error).message);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">1. Prescription Image Upload</h2>
          <p className="text-xs text-[#6B7280]">Upload a clear JPEG/PNG prescription image for Gemini Multimodal extraction</p>
        </div>
        {selectedFile && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E8A5F]/10 text-[#1E8A5F] text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> File Ready
          </span>
        )}
      </div>

      {error ? (
        <div className="bg-[#B23A3A]/5 border border-[#B23A3A]/20 rounded-md p-4 text-center my-3">
          <div className="flex items-center justify-center text-[#B23A3A] mb-2">
            <AlertCircle className="w-6 h-6 mr-1.5" />
            <span className="font-semibold text-sm">OCR Extraction Failed</span>
          </div>
          <p className="text-xs text-[#1F2937] max-w-md mx-auto mb-3">{error}</p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Upload
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-[#0F6E6E] bg-[#0F6E6E]/5'
              : 'border-[#E2E8E8] hover:border-[#0F6E6E]/50 bg-[#F7F9FA]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          {isLoading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#0F6E6E] animate-spin" />
              <div className="text-sm font-semibold text-[#1F2937]">Analyzing prescription with Gemini Multimodal AI...</div>
              <p className="text-xs text-[#6B7280]">Extracting patient details, medications, and matching RxNorm candidates</p>
            </div>
          ) : previewUrl ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <img
                src={previewUrl}
                alt="Prescription preview"
                className="max-h-48 rounded border border-[#E2E8E8] object-contain shadow-xs"
              />
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <FileImage className="w-4 h-4 text-[#0F6E6E]" />
                <span className="font-medium text-[#1F2937]">{selectedFile?.name}</span>
                <span>({Math.round((selectedFile?.size || 0) / 1024)} KB)</span>
              </div>
              <p className="text-[11px] text-[#0F6E6E] font-medium underline">Click or drop a new file to replace</p>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#0F6E6E]/10 flex items-center justify-center text-[#0F6E6E] mb-1">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1F2937]">
                Click to select or drag and drop prescription image
              </p>
              <p className="text-xs text-[#6B7280]">Supports JPEG, PNG, WEBP (Max 10MB)</p>
              {processingStatus && (
                <p className="text-xs font-medium text-[#0F6E6E] mt-1">{processingStatus}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
