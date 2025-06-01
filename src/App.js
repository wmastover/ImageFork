import React, { useState } from 'react';
import axios from 'axios';
import { Download, Settings, Image as ImageIcon, Wand2, Key, Loader2, AlertCircle, Upload, X, DownloadCloud, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { GoRepoForked } from "react-icons/go";
import './App.css';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai-api-key') || '');
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageQuality, setImageQuality] = useState('medium');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [uploadedImages, setUploadedImages] = useState([]);
  
  // Root image for main page
  const [rootImageMain, setRootImageMain] = useState(null);
  
  // Fork/Variation system state
  const [forkMode, setForkMode] = useState(false);
  const [rootImage, setRootImage] = useState(null);
  const [variations, setVariations] = useState([]);
  
  // History management
  const [previousState, setPreviousState] = useState(null);

  const saveApiKey = () => {
    localStorage.setItem('openai-api-key', apiKey);
    localStorage.setItem('image-settings', JSON.stringify({
      imageSize,
      imageQuality,
      numberOfImages
    }));
    setShowSettings(false);
    setError('');
  };

  // Load settings on component mount
  React.useEffect(() => {
    const savedSettings = localStorage.getItem('image-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setImageSize(settings.imageSize || '1024x1024');
        setImageQuality(settings.imageQuality || 'medium');
        setNumberOfImages(settings.numberOfImages || 1);
      } catch (e) {
        console.log('Could not load saved settings');
      }
    }
  }, []);

  const handleImageUpload = (event, variationId = null) => {
    const files = Array.from(event.target.files);
    
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newImage = {
            id: Date.now() + Math.random(),
            file: file,
            preview: e.target.result,
            url: e.target.result,
            name: file.name
          };
          
          if (variationId) {
            // Add image to specific variation
            setVariations(prev => prev.map(variation => 
              variation.id === variationId 
                ? { ...variation, images: [...variation.images, newImage] }
                : variation
            ));
          } else {
            // For main page: first image becomes root if no root exists, others become reference images
            if (!rootImageMain && uploadedImages.length === 0 && index === 0) {
              setRootImageMain(newImage);
              // Automatically enter fork mode with the uploaded image
              forkImage(newImage);
            } else {
              setUploadedImages(prev => [...prev, newImage]);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
    
    event.target.value = '';
  };

  const handleRootImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newRootImage = {
          id: Date.now(),
          file: file,
          url: e.target.result,
          name: file.name
        };
        setRootImageMain(newRootImage);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const removeRootImage = () => {
    setRootImageMain(null);
  };

  const removeImage = (imageId, variationId = null) => {
    if (variationId) {
      setVariations(prev => prev.map(variation => 
        variation.id === variationId 
          ? { ...variation, images: variation.images.filter(img => img.id !== imageId) }
          : variation
      ));
    } else {
      // Check if it's the root image being removed
      if (rootImageMain && rootImageMain.id === imageId) {
        setRootImageMain(null);
      } else {
        setUploadedImages(prev => prev.filter(img => img.id !== imageId));
      }
    }
  };

  const generateImage = async () => {
    if (!apiKey.trim()) {
      setError('Please provide your OpenAI API key in settings');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt for image generation');
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedImages([]);
    setGenerationProgress(0);

    try {
      let response;
      const imagesToInclude = [...uploadedImages];
      
      // Include root image if present
      if (rootImageMain) {
        imagesToInclude.push(rootImageMain);
      }

      if (imagesToInclude.length > 0) {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('model', 'gpt-image-1');
        formData.append('size', imageSize);
        formData.append('quality', imageQuality);
        formData.append('n', numberOfImages.toString());

        imagesToInclude.forEach((img, index) => {
          formData.append(`image`, img.file);
        });

        setGenerationProgress(25);

        response = await axios.post(
          'https://api.openai.com/v1/images/edits',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        // For multiple images, generate them one by one to show progressive results
        if (numberOfImages > 1) {
          const allImages = [];
          
          for (let i = 0; i < numberOfImages; i++) {
            setGenerationProgress(((i + 1) / numberOfImages) * 100);
            
            try {
              const singleResponse = await axios.post(
                'https://api.openai.com/v1/images/generations',
                {
                  model: 'gpt-image-1',
                  prompt: prompt,
                  n: 1,
                  size: imageSize,
                  quality: imageQuality
                },
                {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (singleResponse.data && singleResponse.data.data && singleResponse.data.data[0]) {
                const imageData = singleResponse.data.data[0];
                const newImage = {
                  id: Date.now() + i,
                  url: imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : imageData.url,
                  revisedPrompt: imageData.revised_prompt
                };
                
                allImages.push(newImage);
                
                // Display images progressively as they become available
                setGeneratedImages(prev => [...prev, newImage]);
                
                // Small delay to show the progressive effect
                if (i < numberOfImages - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            } catch (singleError) {
              console.error(`Error generating image ${i + 1}:`, singleError);
              // Continue with next image even if one fails
            }
          }
          
          response = { data: { data: allImages.map(img => ({ 
            url: img.url, 
            b64_json: img.url.includes('base64') ? img.url.split(',')[1] : null,
            revised_prompt: img.revisedPrompt 
          })) } };
        } else {
          // Single image generation
          setGenerationProgress(50);
          
          response = await axios.post(
            'https://api.openai.com/v1/images/generations',
            {
              model: 'gpt-image-1',
              prompt: prompt,
              n: numberOfImages,
              size: imageSize,
              quality: imageQuality
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
        }
      }

      setGenerationProgress(100);

      if (response.data && response.data.data && response.data.data.length > 0) {
        // For single images or batch completion, ensure all images are displayed
        if (numberOfImages === 1 || imagesToInclude.length > 0) {
          const images = response.data.data.map((imageData, index) => {
            if (imageData.b64_json) {
              return {
                id: Date.now() + index,
                url: `data:image/png;base64,${imageData.b64_json}`,
                revisedPrompt: imageData.revised_prompt
              };
            } else if (imageData.url) {
              return {
                id: Date.now() + index,
                url: imageData.url,
                revisedPrompt: imageData.revised_prompt
              };
            }
            return null;
          }).filter(Boolean);

          if (images.length > 0) {
            setGeneratedImages(images);
            // Automatically enter fork mode with the first generated image
            forkImage(images[0]);
          } else {
            setError('No image data received. Please try again.');
          }
        }
        // For multiple images, they're already set progressively above
      } else {
        setError('No images were generated. Please try again.');
      }
    } catch (err) {
      console.error('Error generating image:', err);
      if (err.response?.status === 401) {
        setError('Invalid API key. Please check your OpenAI API key.');
      } else if (err.response?.status === 400) {
        setError('Invalid request. Please check your prompt and images, then try again.');
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('Failed to generate images. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setGenerationProgress(0);
    }
  };

  const generateVariation = async (variationId) => {
    const variation = variations.find(v => v.id === variationId);
    if (!variation || !variation.prompt.trim()) {
      setError('Please enter a prompt for this variation');
      return;
    }

    setVariations(prev => prev.map(v => 
      v.id === variationId ? { ...v, isLoading: true } : v
    ));
    setError('');

    try {
      const formData = new FormData();
      formData.append('prompt', variation.prompt);
      formData.append('model', 'gpt-image-1');
      formData.append('size', imageSize);
      formData.append('quality', imageQuality);
      formData.append('n', '1');

      // Collect all images first
      const allImages = [];

      // Add root image as the first image if it exists
      if (rootImage) {
        const rootImageResponse = await fetch(rootImage.url);
        const rootImageBlob = await rootImageResponse.blob();
        allImages.push(rootImageBlob);
      }

      // Add variation-specific images
      for (const img of variation.images) {
        if (img.file) {
          allImages.push(img.file);
        } else if (img.url) {
          // If we have a URL but no file (e.g., from a previous generation)
          const response = await fetch(img.url);
          const blob = await response.blob();
          allImages.push(blob);
        }
      }

      // Add all images with array syntax
      allImages.forEach((img, index) => {
        formData.append(`image[]`, img);
      });

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
        const newResult = {
          id: Date.now(),
          url: imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : imageData.url,
          prompt: variation.prompt,
          revisedPrompt: imageData.revised_prompt
        };

        // Update the specific variation with its result
        setVariations(prev => prev.map(v => 
          v.id === variationId ? { ...v, result: newResult, isLoading: false } : v
        ));
      } else {
        setError('No image was generated for this variation.');
        setVariations(prev => prev.map(v => 
          v.id === variationId ? { ...v, isLoading: false } : v
        ));
      }
    } catch (err) {
      console.error('Error generating variation image:', err);
      let errorMessage = 'Failed to generate image for this variation.';
      
      // More specific error messages based on the API response
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.response?.status === 400) {
        errorMessage = 'Invalid request. Please check your images and try again. Make sure all images are valid and in a supported format (PNG, JPEG).';
      } else if (err.response?.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key in settings.';
      }
      
      setError(errorMessage);
      setVariations(prev => prev.map(v => 
        v.id === variationId ? { ...v, isLoading: false } : v
      ));
    }
  };

  const forkImage = (image) => {
    // Add confirmation dialog
    const proceed = window.confirm(
      "Forking this image will clear all current images and prompts from the main page. Are you sure you want to continue?"
    );

    if (!proceed) {
      return; // User cancelled the action
    }

    // Store current state before entering fork mode
    setPreviousState({
      prompt: prompt,
      generatedImages: generatedImages,
      uploadedImages: uploadedImages,
      rootImageMain: rootImageMain,
      error: error
    });

    setForkMode(true);
    setRootImage(image);
    setVariations([
      {
        id: Date.now() + 1,
        prompt: '',
        images: [],
        isLoading: false,
        result: null
      },
      {
        id: Date.now() + 2,
        prompt: '',
        images: [],
        isLoading: false,
        result: null
      }
    ]);
    setGeneratedImages([]);
    setPrompt('');
    setUploadedImages([]);
    setError('');
  };

  const addVariation = () => {
    const newVariation = {
      id: Date.now(),
      prompt: '',
      images: [],
      isLoading: false,
      result: null
    };
    setVariations(prev => [...prev, newVariation]);
  };

  const removeVariation = (variationId) => {
    setVariations(prev => prev.filter(variation => variation.id !== variationId));
  };

  const updateVariationPrompt = (variationId, newPrompt) => {
    setVariations(prev => prev.map(variation => 
      variation.id === variationId ? { ...variation, prompt: newPrompt } : variation
    ));
  };

  const exitForkMode = () => {
    setForkMode(false);
    setRootImage(null);
    setVariations([]);
    
    // Restore previous state if available
    if (previousState) {
      setPrompt(previousState.prompt);
      setGeneratedImages(previousState.generatedImages);
      setUploadedImages(previousState.uploadedImages);
      setRootImageMain(previousState.rootImageMain);
      setError(previousState.error);
      setPreviousState(null);
    }
  };

  const downloadImage = async (imageUrl, index = 0) => {
    if (!imageUrl) return;

    try {
      let imageBlob;
      
      if (imageUrl.startsWith('data:image')) {
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        imageBlob = new Blob([byteArray], { type: 'image/png' });
      } else {
        const response = await fetch(imageUrl);
        imageBlob = await response.blob();
      }

      const url = window.URL.createObjectURL(imageBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-generated-image-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download image');
    }
  };

  const downloadAllImages = async () => {
    if (generatedImages.length === 0) return;
    
    for (let i = 0; i < generatedImages.length; i++) {
      await downloadImage(generatedImages[i].url, i);
      if (i < generatedImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateImage();
    }
  };

  const handleDragOver = (e, variationId) => {
    e.preventDefault();
    e.stopPropagation();
    const variation = document.querySelector(`[data-variation-id="${variationId}"]`);
    const dropZone = variation.querySelector('.variation-upload');
    dropZone.classList.add('drag-over');
  };

  const handleDragLeave = (e, variationId) => {
    e.preventDefault();
    e.stopPropagation();
    const variation = document.querySelector(`[data-variation-id="${variationId}"]`);
    const dropZone = variation.querySelector('.variation-upload');
    dropZone.classList.remove('drag-over');
  };

  const handleDrop = async (e, variationId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const variation = document.querySelector(`[data-variation-id="${variationId}"]`);
    const dropZone = variation.querySelector('.variation-upload');
    dropZone.classList.remove('drag-over');

    const items = [...e.dataTransfer.items];
    const imageFiles = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        }
      }
    }

    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage = {
          id: Date.now() + Math.random(),
          file: file,
          preview: e.target.result,
          url: e.target.result,
          name: file.name
        };
        
        setVariations(prev => prev.map(variation => 
          variation.id === variationId 
            ? { ...variation, images: [...variation.images, newImage] }
            : variation
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  if (forkMode) {
    return (
      <div className="App fork-mode">
        <video 
          className="background-video"
          autoPlay 
          loop 
          muted 
          playsInline
        >
          <source src="https://firebasestorage.googleapis.com/v0/b/vybecode-36007.firebasestorage.app/o/videos%2F1745753806094_Mountain.mp4?alt=media&token=9109be88-a329-477e-b74f-e2bc73a3e340" type="video/mp4" />
        </video>
        <header className="app-header">
          <div className="header-content">
            <div className="logo-section">
              <h1 onClick={() => window.location.reload()}>ImageFork</h1>
            </div>
            <div className="header-actions">
              <button onClick={exitForkMode} className="exit-fork-btn">
                <ArrowLeft />
                Back to Main
              </button>
              <button
                className="settings-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </header>

        {showSettings && (
          <div className="settings-modal">
            <div className="settings-content">
              <h3>ImageFork Settings</h3>
              <div className="form-group">
                <label>
                  <Key className="input-icon" />
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  className="api-key-input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="api-key-note">
                  Your API key is stored locally and never sent to our servers.
                  Need an API key? <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">Get one here</a>
                </p>
              </div>
              
              <div className="form-group">
                <label htmlFor="image-size">Image Size</label>
                <select
                  id="image-size"
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="select-input"
                >
                  <option value="1024x1024">1024x1024 (Square)</option>
                  <option value="1024x1536">1024x1536 (Portrait)</option>
                  <option value="1536x1024">1536x1024 (Landscape)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="image-quality">Image Quality</label>
                <select
                  id="image-quality"
                  value={imageQuality}
                  onChange={(e) => setImageQuality(e.target.value)}
                  className="select-input"
                >
                  <option value="low">Low (Faster)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Best Quality)</option>
                </select>
              </div>

              <div className="settings-actions">
                <button onClick={saveApiKey} className="save-btn">
                  Save Settings
                </button>
                <button onClick={() => setShowSettings(false)} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="fork-main-content">
          {/* Root Image Section */}
          <div className="root-image-section">
            <img src={rootImage.url} alt="Original image" className="root-image" />
          </div>

          {/* Variations Section */}
          <div className="variations-section">
            <div className="variations-header">
              <h3>Variations</h3>
              <button onClick={addVariation} className="add-variation-btn">
                <Plus />
                Add Variation
              </button>
            </div>
            
            <div className="variations-container">
              {variations.map((variation, index) => (
                <div 
                  key={variation.id} 
                  className="variation"
                  data-variation-id={variation.id}
                >
                  <textarea
                    value={variation.prompt}
                    onChange={(e) => updateVariationPrompt(variation.id, e.target.value)}
                    placeholder="Describe the changes you want..."
                    rows="3"
                    className="variation-prompt-input"
                  />

                  <div 
                    className={`variation-upload ${variation.images.length > 0 ? 'has-images' : ''}`}
                    onDragOver={(e) => handleDragOver(e, variation.id)}
                    onDragLeave={(e) => handleDragLeave(e, variation.id)}
                    onDrop={(e) => handleDrop(e, variation.id)}
                  >
                    <label htmlFor={`upload-${variation.id}`} className="variation-upload-label">
                      <Upload className="upload-icon" />
                      Drag images here or click to upload
                    </label>
                    <input
                      id={`upload-${variation.id}`}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e, variation.id)}
                      className="variation-upload-input"
                      style={{ display: 'none' }}
                    />
                    
                    {variation.images.length > 0 && (
                      <div className="variation-images">
                        {variation.images.map((img) => (
                          <div key={img.id} className="variation-image-preview">
                            <img src={img.preview} alt={img.name} />
                            <button
                              onClick={() => removeImage(img.id, variation.id)}
                              className="remove-variation-image-btn"
                            >
                              <X />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => generateVariation(variation.id)}
                    disabled={variation.isLoading || !variation.prompt.trim() || !apiKey}
                    className="variation-generate-btn"
                  >
                    {variation.isLoading ? (
                      <>
                        <Loader2 className="spinning" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 />
                        Generate
                      </>
                    )}
                  </button>

                  {/* Variation Result */}
                  {variation.result && (
                    <div className="variation-result">
                      <img src={variation.result.url} alt={`Generated variation`} />
                      <div className="variation-result-actions">
                        <button 
                          onClick={() => downloadImage(variation.result.url)} 
                          className="result-download-btn"
                          title="Download"
                        >
                          <Download />
                        </button>
                        <button 
                          onClick={() => forkImage(variation.result)} 
                          className="result-fork-btn"
                          title="Use as base image"
                        >
                          <GoRepoForked />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle />
              {error}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <video 
        className="background-video"
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src="https://firebasestorage.googleapis.com/v0/b/vybecode-36007.firebasestorage.app/o/videos%2F1745753806094_Mountain.mp4?alt=media&token=9109be88-a329-477e-b74f-e2bc73a3e340" type="video/mp4" />
      </video>
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 onClick={() => window.location.reload()}>ImageFork</h1>
          </div>
          <div className="header-actions">
            <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="settings-modal">
          <div className="settings-content">
            <h3>ImageFork Settings</h3>
            <div className="form-group">
              <label>
                <Key className="input-icon" />
                OpenAI API Key
              </label>
              <input
                type="password"
                className="api-key-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="api-key-note">
                Your API key is stored locally and never sent to our servers.
                Need an API key? <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">Get one here</a>
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="image-size">Image Size</label>
              <select
                id="image-size"
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="select-input"
              >
                <option value="1024x1024">1024x1024 (Square)</option>
                <option value="1024x1536">1024x1536 (Portrait)</option>
                <option value="1536x1024">1536x1024 (Landscape)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="image-quality">Image Quality</label>
              <select
                id="image-quality"
                value={imageQuality}
                onChange={(e) => setImageQuality(e.target.value)}
                className="select-input"
              >
                <option value="low">Low (Faster)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Best Quality)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="number-of-images">Number of Images</label>
              <select
                id="number-of-images"
                value={numberOfImages}
                onChange={(e) => setNumberOfImages(parseInt(e.target.value))}
                className="select-input"
              >
                <option value={1}>1 Image</option>
                <option value={2}>2 Images</option>
                <option value={3}>3 Images</option>
                <option value={4}>4 Images</option>
                <option value={5}>5 Images</option>
                <option value={6}>6 Images</option>
                <option value={8}>8 Images</option>
                <option value={10}>10 Images</option>
              </select>
              <p className="setting-note">
                More images = higher cost. Each image is billed separately.
              </p>
            </div>

            <div className="settings-actions">
              <button onClick={saveApiKey} className="save-btn">
                Save Settings
              </button>
              <button onClick={() => setShowSettings(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="generation-section">
          <div className="prompt-section">
            <label htmlFor="prompt">Describe the image you want to generate</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="A futuristic cityscape at sunset with flying cars..."
              className="prompt-input"
              rows="4"
            />

            <button 
              onClick={generateImage} 
              disabled={isLoading || !apiKey}
              className="generate-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinning" />
                  {numberOfImages > 1 && generationProgress > 0 
                    ? `Generating... ${Math.round(generationProgress)}%` 
                    : (uploadedImages.length > 0 || rootImageMain) ? 'Editing...' : 'Generating...'
                  }
                </>
              ) : (
                <>
                  <Wand2 />
                  {(uploadedImages.length > 0 || rootImageMain) ? 'Edit with AI' : `Generate ${numberOfImages} ${numberOfImages === 1 ? 'Image' : 'Images'}`}
                </>
              )}
            </button>

            {/* Progress Bar */}
            {isLoading && generationProgress > 0 && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {numberOfImages > 1 
                    ? `${Math.floor(generationProgress / (100 / numberOfImages))} of ${numberOfImages} images`
                    : `${Math.round(generationProgress)}% complete`
                  }
                </span>
              </div>
            )}

            {/* OR Separator */}
            <div className="or-separator">
              <span className="or-text">OR</span>
            </div>

            {/* Unified Image Upload Section */}
            <div className="upload-section">
              <label htmlFor="image-upload" className="upload-label">
                <Upload className="upload-icon" />
                Upload Image
              </label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e)}
                className="upload-input"
              />
              <p className="upload-note">
                Upload images to use as a base for generation or editing. Supports multiple images.
              </p>
            </div>

            {/* Root Image Preview */}
            {rootImageMain && (
              <div className="root-image-preview">
                <h4>Root Image</h4>
                <div className="root-image-container-main">
                  <img src={rootImageMain.url} alt={rootImageMain.name} />
                  <button
                    onClick={removeRootImage}
                    className="remove-root-image-btn"
                    title="Remove root image"
                  >
                    <X />
                  </button>
                  <div className="root-image-actions">
                    <button 
                      onClick={() => forkImage(rootImageMain)} 
                      className="fork-root-btn"
                      title="Fork this root image"
                    >
                      <GoRepoForked />
                      Fork Root
                    </button>
                  </div>
                </div>
                <span className="root-image-name">{rootImageMain.name}</span>
              </div>
            )}

            {/* Uploaded Images Preview */}
            {uploadedImages.length > 0 && (
              <div className="uploaded-images">
                <h4>Uploaded Images ({uploadedImages.length})</h4>
                <div className="image-previews">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="image-preview">
                      <img src={img.preview} alt={`Upload preview ${img.name}`} />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="remove-image-btn"
                        title="Remove image"
                      >
                        <X />
                      </button>
                      <span className="image-name">{img.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle />
              {error}
            </div>
          )}

          {generatedImages.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h3>Generated Images ({generatedImages.length})</h3>
                {generatedImages.length > 1 && (
                  <button onClick={downloadAllImages} className="download-all-btn" title="Download All Images">
                    <DownloadCloud />
                    Download All
                  </button>
                )}
              </div>
              <div className="generated-images-grid">
                {generatedImages.map((image, index) => (
                  <div key={image.id} className="generated-image-container">
                    <img src={image.url} alt={`AI generated artwork ${index + 1}`} className="generated-image" />
                    <div className="image-actions">
                      <button 
                        onClick={() => downloadImage(image.url, index)} 
                        className="download-btn" 
                        title="Download Image"
                      >
                        <Download />
                      </button>
                      <button 
                        onClick={() => forkImage(image)} 
                        className="fork-btn" 
                        title="Fork this image"
                      >
                        <GoRepoForked />
                      </button>
                    </div>
                    <div className="image-index">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
