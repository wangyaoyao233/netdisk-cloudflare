import { useEffect, type RefObject } from 'react'
import { FileService, type FileItem } from '../api/fileService'

export function useHlsVideo(videoFile: FileItem | null, videoRef: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;

    const video = videoRef.current;
    const streamUrl = FileService.getVideoStreamUrl(videoFile.id);
    let cancelled = false;
    let destroyHls: (() => void) | undefined;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.load();
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        destroyHls = () => hls.destroy();
      });
    }

    return () => {
      cancelled = true;
      destroyHls?.();
      video.removeAttribute('src');
      video.load();
    };
  }, [videoFile, videoRef]);
}
