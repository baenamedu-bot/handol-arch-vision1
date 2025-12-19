import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { ImageFile } from '../types';
import { readFileToDataUrl } from '../utils/imageProcessing';

interface ImageUploaderProps {
  label: string;
  subLabel?: string;
  imageFile: ImageFile | null;
  onImageSelected: (image: ImageFile | null) => void;
  heightClass?: string;
  required?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  subLabel, 
  imageFile, 
  onImageSelected, 
  heightClass = "h-64",
  required = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const preview = await readFileToDataUrl(file);
        onImageSelected({ file, preview });
      } catch (e) {
        console.error("Error reading file", e);
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div 
        className={`relative w-full ${heightClass} border-2 border-dashed rounded-xl transition-all duration-200 overflow-hidden
          ${imageFile ? 'border-orange-500 bg-slate-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
        `}
        onClick={() => !imageFile && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {imageFile ? (
          <div className="relative w-full h-full group">
            <img 
              src={imageFile.preview} 
              alt="Preview" 
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={handleClear}
                className="bg-white/90 text-red-600 p-2 rounded-full shadow-lg hover:bg-white transition-transform transform hover:scale-110"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {imageFile.file.name}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="bg-slate-100 p-4 rounded-full mb-3">
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">클릭하여 이미지 업로드</p>
            {subLabel && <p className="text-xs text-slate-400 mt-1">{subLabel}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
