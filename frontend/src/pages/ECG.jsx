import { useState } from "react";
import axios from "axios";
import ECGViewer from "../components/ECG/viewers/ECGViewer";

export default function ECG() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Choose CSV file first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:8000/ecg/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setResult(res.data);
      console.log(res.data); 
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>ECG Viewer</h1>

      {/* Upload input */}
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} style={{ marginLeft: 10 }}>Upload</button>

      {loading && <p>Loading...</p>}

      {/* Pass data to ECGViewer */}
      <ECGViewer data={result} />
    </div>
  );
}