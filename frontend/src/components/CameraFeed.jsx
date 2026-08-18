import React, { useEffect, useRef, useState } from "react";
import {Camera,CameraOff,Circle,RefreshCw,ShieldCheck,AlertTriangle,} from "lucide-react";

const CameraFeed = ({title = "Live Camera Feed",location = "Local Camera",showControls = true,onDetection,}) => {

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const [cameraStatus, setCameraStatus] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);

  const startCamera = async () => {
    setCameraError("");
    setCameraStatus("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error( "Camera access is not supported by this browser." );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {ideal: 1280,},
          height: { ideal: 720,},
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("active");
    } catch (error) {
      console.error("Camera error:", error);
      setCameraStatus("error");
      if (error.name === "NotAllowedError") {
        setCameraError( "Camera permission was denied. Please allow camera access in your browser.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera was found on this device.");
      } else {
        setCameraError( error.message || "Unable to access the camera.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopDetection();
    setCameraStatus("idle");
  };

  const startDetection = () => {
    if (cameraStatus !== "active") {
      return;
    }

    setIsDetecting(true);

    /*
      This is currently a placeholder.

      Later replace this section with:
      - TensorFlow.js
      - Teachable Machine
      - YOLO
      - your trained WildGuard model
    */

    detectionIntervalRef.current = setInterval(() => {
      const detection = {
        label: "No Threat",
        confidence: 0.97,
        alertLevel: "LOW",
        timestamp: new Date().toISOString(),
        location,
      };
      if (onDetection) {
        onDetection(detection);
      }
    }, 3000);
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
  };

  const toggleDetection = () => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection();
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl">

      {/* Camera Header */}
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg border p-2 ${ cameraStatus === "active" ? "border-emerald-500/20 bg-emerald-500/10" : "border-slate-800 bg-slate-900"}`}>
            {cameraStatus === "active" ? (
              <Camera className="h-4 w-4 text-emerald-400" />
            ) : (
              <CameraOff className="h-4 w-4 text-slate-500" />
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">{location}</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {cameraStatus === "active" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400">
              <Circle className="h-2 w-2 fill-current" />LIVE
            </span>
          )}

          {cameraStatus === "starting" && (
            <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-[10px] font-bold text-yellow-400">
              STARTING
            </span>
          )}

          {cameraStatus === "idle" && (
            <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-500">
              OFFLINE
            </span>
          )}

        </div>

      </div>

      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} muted autoPlay playsInline className={`h-full w-full object-cover ${ cameraStatus === "active" ? "block" : "hidden"}`}/>
        {/* Offline screen */}
        {cameraStatus !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full border border-slate-800 bg-slate-900 p-4">
              <CameraOff className="h-7 w-7 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              Camera is not active
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-600">
              Start the camera to display the live surveillance feed.
            </p>

            {cameraError && (
              <div className="mt-4 flex max-w-md items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-left">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-xs leading-5 text-red-300">
                  {cameraError}
                </p>
              </div>
            )}

          </div>
        )}

        {/* Live overlay */}
        {cameraStatus === "active" && (
          <>
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-black/30 bg-black/50 px-2.5 py-1.5 backdrop-blur-sm">
              <Circle className="h-2 w-2 fill-red-500 text-red-500" />
              <span className="text-[10px] font-bold tracking-wider text-white">
                LIVE SURVEILLANCE
              </span>
            </div>
            <div className="absolute bottom-3 left-3 rounded-lg border border-black/30 bg-black/50 px-2.5 py-1.5 backdrop-blur-sm">
              <p className="font-mono text-[10px] text-slate-200">
                {new Date().toLocaleString()}
              </p>
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/70 px-2.5 py-1.5 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-300">
                MONITORED
              </span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex flex-col gap-3 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-300">
              Surveillance Camera
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              Camera access is controlled by your browser.
            </p>
          </div>

          <div className="flex gap-2">
            {cameraStatus !== "active" ? (
              <button type="button" onClick={startCamera} disabled={cameraStatus === "starting"} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                {cameraStatus === "starting" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Camera className="h-3.5 w-3.5" />
                    Start Camera
                  </>
                )}
              </button>
            ) : (
              <>
                <button type="button" onClick={toggleDetection} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${ isDetecting ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" }`}>
                  {isDetecting ? "Stop AI Detection" : "Start AI Detection"}
                </button>

                <button type="button" onClick={stopCamera} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFeed;