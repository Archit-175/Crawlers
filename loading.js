const hideLoader = () => {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
};
window.addEventListener('load', hideLoader);
setTimeout(hideLoader, 5000);
