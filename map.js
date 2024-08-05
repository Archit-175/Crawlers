// Select the span and all paths with the 'svg-block' class
const span = document.querySelector('#hoverSpan');
const svgPaths = document.querySelectorAll('path.svg-block');
// Add event listeners for mouseenter and mouseleave
span.addEventListener('mouseenter', () => {
  svgPaths.forEach(path => {
    path.classList.add('highlight');
  });
  
  
});

span.addEventListener('mouseleave', () => {
  svgPaths.forEach(path => {
    path.classList.remove('highlight');
  });
});