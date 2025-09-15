import React from "react";
import { jsPDF } from "jspdf";

const Logs = ({ logs }) => {
  // helper: decide color based on event text
  const getColorClass = (event) => {
    if (event.includes("Recording started")) return "text-green-600";
    if (event.includes("Recording stopped")) return "text-red-600";
    if (event.includes("looking away")) return "text-yellow-600";
    if (event.includes("No face")) return "text-red-600";
    if (event.includes("Multiple faces")) return "text-orange-600";
    return "text-blue-600"; // default for info/others
  };

  // --- PDF Download ---
  const downloadPDF = () => {
    if (!logs.length) return;

    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Event Logs", 14, 20);

    let y = 30;
    logs.forEach((log, index) => {
      const text = `${log.timestamp} - ${log.event}`;
      doc.text(text, 14, y);
      y += 8;
      if (y > 280) { // create new page if overflow
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`event_logs_${Date.now()}.pdf`);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-md overflow-y-auto max-h-96">
      <h2 className="text-lg font-semibold mb-2">Event Log</h2>

      {logs.length === 0 ? (
        <p className="text-gray-500">No events yet...</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {logs.map((log, index) => (
            <li key={index} className={`text-sm ${getColorClass(log.event)}`}>
              <span className="font-medium text-gray-500">{log.timestamp}</span> - {log.event}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          onClick={downloadPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
};

export default Logs;
