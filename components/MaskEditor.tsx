import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser, Paintbrush, RefreshCcw, Check } from 'lucide-react';

interface MaskEditorProps {
  imageUrl: string;
  onMaskChange: (maskBase64: string | null) => void;
  onClose: () => void;
}

const MaskEditor: React.FC<MaskEditorProps> = ({ imageUrl, onMaskChange, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [hasMask, setHasMask] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, aspect: 1 });
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspect: img.naturalWidth / img.naturalHeight
      });
    };
  }, [imageUrl]);

  // Adjust canvas size when image or container size changes
  useEffect(() => {
    if (!imageSize.width || !containerRef.current || !canvasRef.current) return;

    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const contWidth = container.clientWidth;
      const contHeight = container.clientHeight;
      const contAspect = contWidth / contHeight;

      let drawWidth, drawHeight;

      if (contAspect > imageSize.aspect) {
        // Container is wider than image
        drawHeight = contHeight;
        drawWidth = contHeight * imageSize.aspect;
      } else {
        // Container is taller than image
        drawWidth = contWidth;
        drawHeight = contWidth / imageSize.aspect;
      }

      // Set canvas display size
      canvasRef.current.style.width = `${drawWidth}px`;
      canvasRef.current.style.height = `${drawHeight}px`;

      // Set canvas internal resolution to match natural image size for max quality
      canvasRef.current.width = imageSize.width;
      canvasRef.current.height = imageSize.height;

      // Persist existing drawing if necessary (optional improvement)
      // For now, clearing on resize is safer to avoid distortion
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [imageSize]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    // Relative to the displayed canvas element
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Scale to internal resolution
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: relX * scaleX,
      y: relY * scaleY,
      rawX: clientX, // For cursor preview
      rawY: clientY
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setCursorPos({ x: e.clientX, y: e.clientY });
    }
    if (isDrawing) draw(e);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      // Dynamic brush thickness relative to image resolution
      // base on 1000px width as standard
      const thickness = brushSize * (canvasRef.current!.width / 1000);
      ctx.lineWidth = thickness;
      
      if (mode === 'draw') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      } else {
        ctx.globalCompositeOperation = 'destination-out';
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasMask(true);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      canvasRef.current?.getContext('2d')?.closePath();
    }
  };

  const handleClear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasMask(false);
      onMaskChange(null);
    }
  };

  const handleSave = () => {
    if (!canvasRef.current || !hasMask) {
      onMaskChange(null);
      onClose();
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.fillStyle = '#000000';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      const visualData = canvasRef.current.getContext('2d')!.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const outputData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
      
      for (let i = 0; i < visualData.data.length; i += 4) {
        const alpha = visualData.data[i + 3];
        if (alpha > 0) {
          outputData.data[i] = 255;
          outputData.data[i + 1] = 255;
          outputData.data[i + 2] = 255;
          outputData.data[i + 3] = 255;
        } else {
          outputData.data[i] = 0;
          outputData.data[i + 1] = 0;
          outputData.data[i + 2] = 0;
          outputData.data[i + 3] = 255;
        }
      }
      tempCtx.putImageData(outputData, 0, 0);

      const dataUrl = tempCanvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      onMaskChange(base64);
      onClose();
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div 
        ref={containerRef}
        className="flex-grow relative bg-slate-200 overflow-hidden flex items-center justify-center cursor-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorPos({ x: -100, y: -100 })}
      >
        {/* The target image */}
        <img 
          src={imageUrl} 
          alt="Mask Target" 
          className="max-w-full max-h-full object-contain pointer-events-none select-none"
        />
        
        {/* Drawing Layer - Perfectly sized to match displayed image */}
        <canvas
          ref={canvasRef}
          className="absolute touch-none"
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Brush Cursor Preview */}
        <div 
          className={`fixed pointer-events-none z-50 rounded-full border border-white shadow-sm flex items-center justify-center
            ${mode === 'draw' ? 'bg-red-500/30' : 'bg-slate-500/30 border-dashed'}
          `}
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: `${brushSize}px`,
            height: `${brushSize}px`,
            transform: 'translate(-50%, -50%)',
            display: cursorPos.x < 0 ? 'none' : 'flex'
          }}
        >
          {mode === 'erase' && <Eraser className="w-1/2 h-1/2 text-white/50" />}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 border-t border-slate-200 flex items-center justify-between z-30">
        <div className="flex items-center space-x-6">
          <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setMode('draw')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${mode === 'draw' ? 'bg-white shadow-md text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Paintbrush className="w-4 h-4" />
              <span className="text-sm">브러시</span>
            </button>
            <button
              onClick={() => setMode('erase')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${mode === 'erase' ? 'bg-white shadow-md text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Eraser className="w-4 h-4" />
              <span className="text-sm">지우개</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider">크기 {brushSize}px</span>
            <input 
              type="range" 
              min="10" 
              max="150" 
              value={brushSize} 
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleClear}
            className="flex items-center px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            초기화
          </button>
          <button
            onClick={handleSave}
            className="flex items-center px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95"
          >
            <Check className="w-4 h-4 mr-2" />
            마스크 적용 완료
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaskEditor;