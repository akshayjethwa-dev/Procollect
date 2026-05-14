import { storage, auth, storageRef, uploadBytesResumable, getDownloadURL } from './firebase';
import imageCompression from 'browser-image-compression';

export async function uploadFieldDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string; fileType: string }> {
  if (!auth.currentUser) throw new Error("Agent not authenticated");

  let fileToUpload = file;

  // Compress images to save bandwidth for field agents
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 1, // Max 1MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    } catch (error) {
      console.warn("Image compression failed, using original file", error);
    }
  }

  const timestamp = Date.now();
  // Store under uploads/{agentId}/{timestamp}_{filename}
  const path = `uploads/${auth.currentUser.uid}/${timestamp}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const fileRef = storageRef(storage, path);

  const uploadTask = uploadBytesResumable(fileRef, fileToUpload);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, path, fileType: fileToUpload.type });
      }
    );
  });
}