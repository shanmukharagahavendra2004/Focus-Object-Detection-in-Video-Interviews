import React, { useState } from "react";
import Header from "./components/Header";
import VideoFeed from "./components/VideoFeed";
import Logs from "./components/Logs";
import Candidate from "./components/Candidate";
import "./App.css";

function App() {
  const [logs, setLogs] = useState([]);

  const addLog = (event) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { event, timestamp }]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl mt-6">
        <VideoFeed addLog={addLog} />
        <Logs logs={logs} />
      </div>
    </div>
  );
}

export default App;
