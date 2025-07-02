import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva';
import { X, Brush, Eraser, RotateCcw, Check, Loader2 } from 'lucide-react';
import axios from 'axios';

const InpaintingTool = ({ 
  image, 
  onClose, 
  onComplete, 
  apiKey,
  imageSize = '1024x1024',
  imageQuality = 'medium'
}) => {
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskPaths, setMaskPaths] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  
  const stageRef = useRef();
  const isDrawingRef = useRef(false);

  // Load the image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageElement(img);
      
      // Calculate scale and position to fit image in canvas
      const maxWidth = 800;
      const maxHeight = 600;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      setImageScale(scale);
      setStageSize({
        width: Math.min(img.width * scale, maxWidth),
        height: Math.min(img.height * scale, maxHeight)
      });
      
      // Center the image
      setImagePosition({
        x: (Math.min(img.width * scale, maxWidth) - img.width * scale) / 2,
        y: (Math.min(img.height * scale, maxHeight) - img.height * scale) / 2
      });
    };
    img.src = image.url;
  }, [image]);

  const handleMouseDown = useCallback((e) => {
    if (!imageElement) return;
    
    isDrawingRef.current = true;
    setIsDrawing(true);
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    // Create new path
    const newPath = {
      id: Date.now(),
      points: [point.x, point.y],
      brushSize: brushSize
    };
    
    setMaskPaths(prev => [...prev, newPath]);
  }, [brushSize, imageElement]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current || !imageElement) return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    setMaskPaths(prev => {
      const newPaths = [...prev];
      const lastPath = newPaths[newPaths.length - 1];
      if (lastPath) {
        lastPath.points = [...lastPath.points, point.x, point.y];
      }
      return newPaths;
    });
  }, [imageElement]);

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
    setIsDrawing(false);
  }, []);

  const clearMask = () => {
    setMaskPaths([]);
  };

  const generateMaskCanvas = () => {
    if (!imageElement) return null;

    // Create a canvas for the mask
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext('2d');
    
    // Fill with black (masked areas will be white)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw white mask areas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    maskPaths.forEach(path => {
      if (path.points.length > 0) {
        ctx.lineWidth = (path.brushSize / imageScale);
        ctx.beginPath();
        
        // Scale points back to original image coordinates
        const scaledPoints = path.points.map((point, index) => {
          if (index % 2 === 0) { // x coordinate
            return (point - imagePosition.x) / imageScale;
          } else { // y coordinate
            return (point - imagePosition.y) / imageScale;
          }
        });
        
        if (scaledPoints.length >= 2) {
          ctx.moveTo(scaledPoints[0], scaledPoints[1]);
          for (let i = 2; i < scaledPoints.length; i += 2) {
            ctx.lineTo(scaledPoints[i], scaledPoints[i + 1]);
          }
          ctx.stroke();
          
          // Also fill circles at each point for smoother brush strokes
          for (let i = 0; i < scaledPoints.length; i += 2) {
            ctx.beginPath();
            ctx.arc(scaledPoints[i], scaledPoints[i + 1], (path.brushSize / imageScale) / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });
    
    return canvas;
  };

  const handleApply = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for the inpainting');
      return;
    }

    if (maskPaths.length === 0) {
      setError('Please draw a mask on the areas you want to replace');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Generate mask canvas
      const maskCanvas = generateMaskCanvas();
      if (!maskCanvas) {
        throw new Error('Failed to generate mask');
      }

      // Convert original image to canvas and then to blob
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = imageElement.width;
      originalCanvas.height = imageElement.height;
      const originalCtx = originalCanvas.getContext('2d');
      originalCtx.drawImage(imageElement, 0, 0);

      // Convert canvases to blobs
      const [originalBlob, maskBlob] = await Promise.all([
        new Promise(resolve => originalCanvas.toBlob(resolve, 'image/png')),
        new Promise(resolve => maskCanvas.toBlob(resolve, 'image/png'))
      ]);

      // Prepare form data
      const formData = new FormData();
      formData.append('image', originalBlob, 'image.png');
      formData.append('mask', maskBlob, 'mask.png');
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', imageSize);
      
      // Only add quality for DALL-E 3
      if (imageQuality && imageSize === '1024x1024') {
        formData.append('quality', imageQuality);
      }

      // Call OpenAI inpainting API
      const response = await axios.post(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data && response.data.data && response.data.data[0]) {
        const imageData = response.data.data[0];
        const resultImage = {
          id: Date.now(),
          url: imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : imageData.url,
          prompt: prompt,
          revisedPrompt: imageData.revised_prompt,
          originalImage: image
        };

        onComplete(resultImage);
      } else {
        throw new Error('No image data received from API');
      }
    } catch (err) {
      console.error('Error with inpainting:', err);
      if (err.response?.status === 401) {
        setError('Invalid API key. Please check your OpenAI API key.');
      } else if (err.response?.status === 400) {
        setError('Invalid request. Please check your image and mask, then try again.');
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('Failed to process inpainting. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inpainting-overlay">
      <div className="inpainting-container">
        {/* Header */}
        <div className="inpainting-header">
          <h3>Erase & Replace</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div className="inpainting-content">
          {/* Canvas Section */}
          <div className="canvas-section">
            <div className="canvas-container">
              {imageElement ? (
                <Stage
                  width={stageSize.width}
                  height={stageSize.height}
                  onMouseDown={handleMouseDown}
                  onMousemove={handleMouseMove}
                  onMouseup={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  ref={stageRef}
                  className="inpainting-stage"
                >
                  <Layer>
                    {/* Original Image */}
                    <KonvaImage
                      image={imageElement}
                      x={imagePosition.x}
                      y={imagePosition.y}
                      width={imageElement.width * imageScale}
                      height={imageElement.height * imageScale}
                    />
                    
                    {/* Mask Lines */}
                    {maskPaths.map(path => (
                      <Line
                        key={path.id}
                        points={path.points}
                        stroke="rgba(255, 0, 0, 0.7)"
                        strokeWidth={path.brushSize}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation="source-over"
                      />
                    ))}
                  </Layer>
                </Stage>
              ) : (
                <div className="canvas-loading">
                  <Loader2 className="spinning" size={24} />
                  <span>Loading image...</span>
                </div>
              )}
            </div>

            {/* Canvas Instructions */}
            <div className="canvas-instructions">
              <p>Draw on the areas you want to replace. The red marks show what will be regenerated.</p>
            </div>
          </div>

          {/* Controls Section */}
          <div className="controls-section">
            {/* Brush Controls */}
            <div className="brush-controls">
              <label>
                <Brush size={16} />
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="brush-size-slider"
              />
            </div>

            {/* Clear Button */}
            <button
              className="clear-mask-btn"
              onClick={clearMask}
              disabled={isLoading || maskPaths.length === 0}
            >
              <RotateCcw size={16} />
              Clear Mask
            </button>

            {/* Prompt Input */}
            <div className="prompt-section">
              <label htmlFor="inpainting-prompt">Replacement Description:</label>
              <textarea
                id="inpainting-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate in the masked areas..."
                className="inpainting-prompt-input"
                rows="4"
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="cancel-btn"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="apply-btn"
                onClick={handleApply}
                disabled={isLoading || !prompt.trim() || maskPaths.length === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="spinning" size={16} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Apply Inpainting
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InpaintingTool;