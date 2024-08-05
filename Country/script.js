const nextBtn = document.querySelector('.next-btn');
const prevBtn = document.querySelector('.prev-btn');
const slides = Array.from(document.querySelectorAll('.slide'));
const numberOfSlides = slides.length;
let slideNumber = 0;

// Slider next button
nextBtn.addEventListener('click', () => {
    slides[slideNumber].classList.remove('active');
    slideNumber = (slideNumber + 1) % numberOfSlides;
    slides[slideNumber].classList.add('active');

    fetchWeather(index)
});

// Slider previous button
prevBtn.addEventListener('click', () => {
    slides[slideNumber].classList.remove('active');
    slideNumber = (slideNumber - 1 + numberOfSlides) % numberOfSlides;
    slides[slideNumber].classList.add('active');
});