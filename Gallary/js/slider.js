const slides = document.querySelectorAll(".slide");
const totalSlides = slides.length;
let counter = 0;

function updateSlides() {
    slides.forEach((slide, index) => {
        let offset = index - counter;
        if (offset < 0) offset += totalSlides;
        if (offset > 2) offset -= totalSlides;
        slide.style.transform = `translateX(${offset * 100}%)`;
    });
}

const gonext = () => {
    counter = (counter + 1) % totalSlides;
    updateSlides();
};

const goprev = () => {
    counter = (counter - 1 + totalSlides) % totalSlides;
    updateSlides();
};

// Initial setup
updateSlides();