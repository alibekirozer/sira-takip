import { useState } from "react";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function PhotoUpload() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");

  const handleChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return;
    const storageRef = ref(storage, `photos/${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    setUrl(downloadURL);
  };

  return (
    <div className="p-4">
      <input type="file" accept="image/*" onChange={handleChange} />
      <button
        onClick={handleUpload}
        className="ml-2 px-2 py-1 bg-blue-500 text-white rounded"
      >
        Yükle
      </button>
      {url && (
        <div className="mt-4">
          <p>Resim URL'i:</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            {url}
          </a>
        </div>
      )}
    </div>
  );
}
