document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const mainContent = document.getElementById('main-content');

    setTimeout(() => {
        videoContainer.style.display = 'none';
        mainContent.style.display = 'block';
    }, 4500);
});