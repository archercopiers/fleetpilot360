// Select once before playback; rotating/resizing never interrupts the video.
(() => {
  const video = document.getElementById('fleet-film-player');
  if (!video) return;
  const mobile = window.matchMedia('(max-width: 640px)').matches;
  video.poster = mobile ? 'assets/video/poster-square.jpg' : 'assets/video/poster-horizontal.jpg';
  video.src = mobile ? 'assets/video/fleetpilot360-square.mp4' : 'assets/video/fleetpilot360-horizontal.mp4';
  video.width = mobile ? 720 : 1280;
  video.height = 720;
})();
