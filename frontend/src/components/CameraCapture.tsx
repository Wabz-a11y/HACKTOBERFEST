import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface Props {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<Props> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError('Unable to access camera. Please allow camera permissions or upload an image file.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreview(dataUrl);
      }
    }
  };

  const retake = () => {
    setPreview(null);
  };

  const confirm = () => {
    if (preview) {
      onCapture(preview);
      stopCamera();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-primary-400" />
            <h3 className="font-semibold text-sm tracking-wide">Scan Prescription or Pill Label</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-rose-300 text-sm">{error}</div>
          ) : preview ? (
            <img src={preview} alt="Captured prescription" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-5 flex items-center justify-between bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Cancel
          </button>

          {!preview ? (
            <button
              onClick={takeSnapshot}
              disabled={!!error}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-semibold rounded-xl flex items-center space-x-2 shadow-md transition"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={retake}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-xl flex items-center space-x-1.5 transition text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake</span>
              </button>
              <button
                onClick={confirm}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center space-x-1.5 shadow-md transition text-sm"
              >
                <Check className="w-4 h-4" />
                <span>Analyze with Gemma 4</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

