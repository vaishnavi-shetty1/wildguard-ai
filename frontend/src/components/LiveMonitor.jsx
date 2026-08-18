import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CameraOff,
  Scan,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { predictWildlife } from "../utils/wildlifeDetection";

const LiveMonitor = ({
  currentUser,
  cameraState,
  setCameraState,
  onPrediction,
}) => {
  const videoRef = useRef(null);

  const [isScanning, setIsScanning] =
    useState(false);

  const [prediction, setPrediction] =
    useState(null);

  const [cameraError, setCameraError] =
    useState("");

  const scanIntervalRef = useRef(null);

  // --------------------------------------------------
  // START CAMERA
  // --------------------------------------------------

  const startCamera = async () => {
    try {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is not supported by this browser."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
            facingMode: "environment",
          },
          audio: false,
        });

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraState({
        isActive: true,
        stream,
        cameraName:
          "Laptop Camera",
        error: "",
      });
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      setCameraError(
        error.message ||
          "Unable to access camera."
      );

      setCameraState({
        isActive: false,
        stream: null,
        cameraName: "",
        error:
          error.message ||
          "Camera unavailable",
      });
    }
  };

  // --------------------------------------------------
  // STOP CAMERA
  // --------------------------------------------------

  const stopCamera = () => {
    if (cameraState?.stream) {
      cameraState.stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }

    setCameraState({
      isActive: false,
      stream: null,
      cameraName: "",
      error: "",
    });

    setIsScanning(false);
  };

  // --------------------------------------------------
  // AI SCAN
  // --------------------------------------------------

  const runPrediction = async () => {
    if (
      !videoRef.current ||
      !cameraState?.isActive
    ) {
      return;
    }

    try {
      const result =
        await predictWildlife(
          videoRef.current
        );

      if (!result) {
        return;
      }

      setPrediction(result);

      /*
       * Send prediction to HomePage.
       *
       * HomePage will convert this into
       * a WildGuard notification.
       */

      if (onPrediction) {
        onPrediction(result);
      }
    } catch (error) {
      console.error(
        "AI prediction error:",
        error
      );
    }
  };

  // --------------------------------------------------
  // START / STOP SCANNING
  // --------------------------------------------------

  const toggleScanning = () => {
    if (isScanning) {
      setIsScanning(false);

      if (scanIntervalRef.current) {
        clearInterval(
          scanIntervalRef.current
        );

        scanIntervalRef.current =
          null;
      }

      return;
    }

    if (!cameraState?.isActive) {
      return;
    }

    setIsScanning(true);

    /*
     * Run AI prediction every 3 seconds.
     *
     * Do NOT run the model on every video frame
     * because it can overload the laptop.
     */

    runPrediction();

    scanIntervalRef.current =
      setInterval(() => {
        runPrediction();
      }, 3000);
  };

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(
          scanIntervalRef.current
        );
      }
    };
  }, []);

  // --------------------------------------------------
  // CONNECT EXISTING STREAM
  // --------------------------------------------------

  useEffect(() => {
    if (
      videoRef.current &&
      cameraState?.stream
    ) {
      videoRef.current.srcObject =
        cameraState.stream;

      videoRef.current
        .play()
        .catch(() => {});
    }
  }, [cameraState?.stream]);

  return (
    <section className="space-y-5">

      {/* HEADER */}

      <div>
        <div className="flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Scan size={20} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-100">
              Live Wildlife Monitor
            </h2>

            <p className="text-xs text-slate-500">
              AI-powered real-time wildlife detection
            </p>
          </div>
        </div>
      </div>

      {/* CAMERA */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">

        <div className="relative aspect-video bg-black">

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />

          {!cameraState?.isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">

              <CameraOff
                size={45}
                className="mb-4 text-slate-600"
              />

              <p className="mb-4 text-sm text-slate-400">
                Camera is not active
              </p>

              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                <Camera size={17} />
                Start Camera
              </button>

            </div>
          )}

          {/* CAMERA STATUS */}

          {cameraState?.isActive && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-slate-950/80 px-3 py-2 backdrop-blur">

              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative size-2 rounded-full bg-emerald-400" />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Camera Live
              </span>

            </div>
          )}

        </div>

        {/* CAMERA CONTROLS */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-4">

          <div>
            <p className="text-xs font-semibold text-slate-200">
              {cameraState?.cameraName ||
                "No camera connected"}
            </p>

            <p className="text-[10px] text-slate-500">
              {isScanning
                ? "AI scanning active"
                : "AI scanning paused"}
            </p>
          </div>

          <div className="flex gap-2">

            {cameraState?.isActive && (
              <button
                type="button"
                onClick={
                  toggleScanning
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                  isScanning
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-emerald-500 text-slate-950"
                }`}
              >
                {isScanning ? (
                  <>
                    <Scan size={15} />
                    Stop Scanning
                  </>
                ) : (
                  <>
                    <Scan size={15} />
                    Start AI Scan
                  </>
                )}
              </button>
            )}

            {cameraState?.isActive && (
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Stop Camera
              </button>
            )}

          </div>

        </div>
      </div>

      {/* CAMERA ERROR */}

      {(cameraError ||
        cameraState?.error) && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">

          <AlertTriangle
            size={18}
            className="shrink-0 text-red-400"
          />

          <p className="text-xs text-red-300">
            {cameraError ||
              cameraState.error}
          </p>

        </div>
      )}

      {/* AI PREDICTION */}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

        <div className="mb-4 flex items-center justify-between">

          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Latest AI Prediction
            </h3>

            <p className="text-[10px] text-slate-500">
              Result from camera analysis
            </p>
          </div>

          {isScanning && (
            <div className="flex items-center gap-2 text-emerald-400">

              <Loader2
                size={14}
                className="animate-spin"
              />

              <span className="text-[10px] font-bold uppercase">
                Scanning
              </span>

            </div>
          )}

        </div>

        {prediction ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

            <div className="flex items-center gap-3">

              <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={21} />
              </div>

              <div>
                <p className="text-lg font-bold text-slate-100">
                  {prediction.species}
                </p>

                <p className="text-xs text-slate-500">
                  Confidence:{" "}
                  {Math.round(
                    prediction.confidence *
                      100
                  )}
                  %
                </p>
              </div>

            </div>

            <div
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase ${
                prediction.threatLevel ===
                "HIGH"
                  ? "bg-red-500/10 text-red-400"
                  : prediction.threatLevel ===
                    "MEDIUM"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {prediction.threatLevel}
            </div>

          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">

            <Scan
              size={24}
              className="mx-auto mb-2 text-slate-600"
            />

            <p className="text-xs text-slate-500">
              No wildlife detected yet.
            </p>

          </div>
        )}

      </div>

    </section>
  );
};

export default LiveMonitor;