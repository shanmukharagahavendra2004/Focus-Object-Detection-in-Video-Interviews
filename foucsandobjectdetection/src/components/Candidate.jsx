import React, { useEffect, useRef } from "react";
import io from "socket.io-client";

const Candidate = () => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const socket = io("http://localhost:5000");

  useEffect(() => {
    const init = async () => {
      pcRef.current = new RTCPeerConnection();

      // Candidate sends ICE to server
      pcRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("ice-candidate", e.candidate);
        }
      };

      // Stream webcam
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current.srcObject = stream;
      stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream));

      // Send offer
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socket.emit("offer", offer);

      // Listen for answer
      socket.on("answer", async (answer) => {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      });

      // Listen for ICE
      socket.on("ice-candidate", async (candidate) => {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(err);
        }
      });
    };

    init();
  }, []);

  return <video ref={videoRef} autoPlay playsInline className="w-96 h-72 bg-black rounded-xl" />;
};

export default Candidate;
