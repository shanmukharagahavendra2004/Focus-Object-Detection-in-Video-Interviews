import React, { useEffect, useRef, useState } from "react";
import * as mpFaceDetection from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

const VideoFeed = ({ addLog }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const mpCameraRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const objectModelRef = useRef(null);
  const objectDetectIntervalRef = useRef(null);
  const latestObjectsRef = useRef([]); 
  const [isRecording, setIsRecording] = useState(false);
  const noFaceStartRef = useRef(null); 
  const lookingAwayStartRef = useRef(null); 
  const lastLogged = useRef({
    noFace: 0,
    lookingAway: 0,
    multipleFaces: 0,
    phone: 0,
    book: 0,
    device: 0,
  });

  const COOLDOWN_MS = {
    noFace: 15_000,
    lookingAway: 10_000,
    multipleFaces: 10_000,
    phone: 15_000,
    book: 15_000,
    device: 15_000,
  };


  const NO_FACE_SECONDS = 10;
  const LOOKING_AWAY_SECONDS = 5;
  const CENTER_THRESHOLD_RATIO = 0.25; 
  const timestamp = () => new Date().toLocaleString();
  const logOnce = (key, message, cooldown = 0) => {
    const now = Date.now();
    if (now - (lastLogged.current[key] || 0) > cooldown) {
      addLog(`${message} — ${timestamp()}`);
      lastLogged.current[key] = now;
    }
  };
  const drawResults = (faceDetections, objectDetections) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (faceDetections && faceDetections.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "lime";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      faceDetections.forEach((det) => {
        if (!det.boundingBox) return;
        const box = det.boundingBox;
        const x = (box.xCenter - box.width / 2) * canvas.width;
        const y = (box.yCenter - box.height / 2) * canvas.height;
        const w = box.width * canvas.width;
        const h = box.height * canvas.height;
        ctx.strokeRect(x, y, w, h);
        const score = det.score ? (det.score[0] || 0) : 0;
        ctx.fillRect(x, y - 18, 80, 18);
        ctx.fillStyle = "white";
        ctx.fillText(`face ${(score * 100).toFixed(0)}%`, x + 4, y - 4);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
      });
    }

    if (objectDetections && objectDetections.length > 0) {
      objectDetections.forEach((obj) => {
        const [x, y, w, h] = obj.bbox; 
        const label = obj.class;
        const score = obj.score;
        let stroke = "dodgerblue";
        if (label === "cell phone" || label === "mobile phone" || label === "phone") stroke = "orange";
        if (label === "book") stroke = "purple";
        if (label === "laptop") stroke = "teal";
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y - 18, ctx.measureText(`${label} ${(score * 100).toFixed(0)}%`).width + 8, 18);
        ctx.fillStyle = "white";
        ctx.fillText(`${label} ${(score * 100).toFixed(0)}%`, x + 4, y - 4);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
      });
    }
  };

  const onResults = (results) => {
    const detections = results.detections || [];
    drawResults(detections, latestObjectsRef.current || []);

    const now = Date.now();
    if (detections.length > 1) {
      logOnce("multipleFaces", "Multiple faces detected", COOLDOWN_MS.multipleFaces);
    }

    if (detections.length === 0) {
      if (!noFaceStartRef.current) {
        noFaceStartRef.current = now;
      } else {
        const secondsGone = (now - noFaceStartRef.current) / 1000;
        if (secondsGone >= NO_FACE_SECONDS) {
          logOnce("noFace", `No face detected for more than ${NO_FACE_SECONDS} seconds`, COOLDOWN_MS.noFace);
        }
      }
      lookingAwayStartRef.current = null;
    } else {
      noFaceStartRef.current = null;
      const vid = videoRef.current;
      if (vid && vid.videoWidth && detections[0] && detections[0].boundingBox) {
        const box = detections[0].boundingBox;
        const faceCenterX = box.xCenter * vid.videoWidth;
        const faceCenterY = box.yCenter * vid.videoHeight;
        const centerX = vid.videoWidth / 2;
        const centerY = vid.videoHeight / 2;

        const dx = (faceCenterX - centerX) / vid.videoWidth;
        const dy = (faceCenterY - centerY) / vid.videoHeight;

        if (Math.abs(dx) > CENTER_THRESHOLD_RATIO || Math.abs(dy) > CENTER_THRESHOLD_RATIO) {
          if (!lookingAwayStartRef.current) {
            lookingAwayStartRef.current = now;
          } else {
            const secondsAway = (now - lookingAwayStartRef.current) / 1000;
            if (secondsAway >= LOOKING_AWAY_SECONDS) {
              logOnce("lookingAway", `Candidate is not looking at the screen for more than ${LOOKING_AWAY_SECONDS} seconds`, COOLDOWN_MS.lookingAway);
            }
          }
        } else {
          lookingAwayStartRef.current = null;
        }
      }
    }
  };


  const setupFaceDetection = (videoEl) => {
    if (!videoEl) return;

    if (!faceDetectorRef.current) {
  const detector = new mpFaceDetection.FaceDetection({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });

  detector.setOptions({
    model: "short",
    minDetectionConfidence: 0.5,
   
    enableSimd: false,
  });

  detector.onResults(onResults);
  faceDetectorRef.current = detector;
}


    if (!mpCameraRef.current) {
      const cam = new Camera(videoEl, {
        onFrame: async () => {
          if (faceDetectorRef.current) {
            await faceDetectorRef.current.send({ image: videoEl });
          }
        },
        width: 640,
        height: 480,
      });
      mpCameraRef.current = cam;
    }

    if (mpCameraRef.current && typeof mpCameraRef.current.start === "function") {
      mpCameraRef.current.start();
    }
  };

  const stopFaceDetection = () => {
    if (mpCameraRef.current && typeof mpCameraRef.current.stop === "function") {
      try {
        mpCameraRef.current.stop();
      } catch {}
      mpCameraRef.current = null;
    }
    if (faceDetectorRef.current && typeof faceDetectorRef.current.close === "function") {
      try {
        faceDetectorRef.current.close();
      } catch {}
    }
    faceDetectorRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    noFaceStartRef.current = null;
    lookingAwayStartRef.current = null;
  };

  // --- Object detection logic (COCO-SSD) ---
  const loadObjectModel = async () => {
    if (!objectModelRef.current) {
      try {
        objectModelRef.current = await cocoSsd.load();
        // model ready
      } catch (e) {
        console.error("Failed to load object detection model:", e);
        addLog(`Object detection model load failed — ${timestamp()}`);
      }
    }
  };

  const startObjectDetectionLoop = () => {
    if (objectDetectIntervalRef.current) return;
    objectDetectIntervalRef.current = setInterval(async () => {
      try {
        const model = objectModelRef.current;
        const videoEl = videoRef.current;
        if (!model || !videoEl || videoEl.readyState < 2) return;
        const preds = await model.detect(videoEl);
        latestObjectsRef.current = preds || [];
        const CONF_THRESH = 0.6;
        const seen = new Set();
        preds.forEach((p) => {
          const cls = p.class.toLowerCase();
          if (p.score < CONF_THRESH) return;
          if (cls.includes("cell phone") || cls.includes("cellphone") || cls.includes("mobile phone") || cls === "phone") {
            if (!seen.has("phone")) {
              logOnce("phone", "Phone detected in frame", COOLDOWN_MS.phone);
              seen.add("phone");
            }
          } else if (cls === "book") {
            if (!seen.has("book")) {
              logOnce("book", "Book or paper notes detected in frame", COOLDOWN_MS.book);
              seen.add("book");
            }
          } else if (cls === "laptop" || cls === "keyboard" || cls === "remote" || cls === "tvmonitor") {
            if (!seen.has("device")) {
              logOnce("device", `Extra electronic device detected: ${p.class}`, COOLDOWN_MS.device);
              seen.add("device");
            }
          }
        });
        if (!faceDetectorRef.current) {
          drawResults([], latestObjectsRef.current);
        }
      } catch (e) {
      }
    }, 800);
  };

  const stopObjectDetectionLoop = () => {
    if (objectDetectIntervalRef.current) {
      clearInterval(objectDetectIntervalRef.current);
      objectDetectIntervalRef.current = null;
    }
    latestObjectsRef.current = [];
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      recordedChunksRef.current = [];
      const options = { mimeType: "video/webm; codecs=vp9,opus" };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `recorded_interview_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };
      mediaRecorder.start(1000); 
      setIsRecording(true);
      addLog(`Recording started — ${timestamp()}`);
      setupFaceDetection(videoRef.current);
      await loadObjectModel();
      startObjectDetectionLoop();
    } catch (error) {
      console.error("Error accessing camera/mic:", error);
      addLog(`Webcam access denied or error — ${timestamp()}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopFaceDetection();

    stopObjectDetectionLoop();
    if (objectModelRef.current) {
      objectModelRef.current = null;
    }
    setIsRecording(false);
    addLog(`Recording stopped — ${timestamp()}`);
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="bg-white p-4 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-2">Candidate Video</h2>

      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg w-full h-80 bg-black object-cover"
        ></video>

        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0 w-full h-80 pointer-events-none"
        />
      </div>

      <div className="flex gap-4 mt-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
          >
            Stop Recording
          </button>
        )}

        <button
          onClick={() => {
            addLog(
              `Detection state: recording=${!!isRecording}, faceDetector=${!!faceDetectorRef.current}, objectModel=${!!objectModelRef.current} — ${timestamp()}`
            );
          }}
          className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg shadow"
        >
          Status
        </button>
      </div>
    </div>
  );
};

export default VideoFeed;
