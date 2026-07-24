/**
 * Converts a File object to a Base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,") to get raw base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Reads a File and returns a data URL for preview purposes.
 */
export const readFileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Adds the "유앤미스튜디오" brand watermark to an image.
 * Returns the watermarked image as a Data URL.
 */
export const addWatermark = (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Add prefix if missing to load into Image object
    const imgSrc = base64Image.startsWith('data:') 
      ? base64Image 
      : `data:image/png;base64,${base64Image}`;
    
    img.src = imgSrc;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Configure Watermark
      const text = "유앤미스튜디오";
      
      // Dynamic font size based on image width (approx 2.5% of width)
      const fontSize = Math.max(20, Math.floor(canvas.width * 0.025));
      ctx.font = `500 ${fontSize}px 'Noto Sans KR', sans-serif`;
      
      // Measure text to position it on the right
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;

      // Positioning (Bottom Right with padding)
      const padding = Math.floor(fontSize * 1.5);
      const x = canvas.width - textWidth - padding; // Right aligned
      const y = canvas.height - padding;

      // Shadow for better visibility
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Text color
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(text, x, y);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (err) => reject(err);
  });
};