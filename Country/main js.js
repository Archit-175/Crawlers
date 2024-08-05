
$(window).scroll(function () {
    var scrollTop = $(this).scrollTop();
    $('.overlay').css({
        opacity: function () {
            var elementHeight = $(this).height(),
                opacity = ((1 - (elementHeight - scrollTop) / elementHeight) * 0.9) + 0.9;
            return opacity;
        }
    })
});

function decreaseOpacityOnScrollUp(overlay) {
    const element = document.querySelector(`.${overlay}`);
    let lastScrollY = window.scrollY;

    window.addEventListener("scroll", () => {
        const currentScrollY = window.scrollY;
        const opacityChange = currentScrollY - lastScrollY;

        if (opacityChange > 0) {
            const newOpacity = Math.max(element.style.opacity - 0.1, 0);
            element.style.opacity = newOpacity;
        }

        lastScrollY = currentScrollY;
    });
}

decreaseOpacityOnScrollUp("overlay"); // Target the "main" class for opacity decrease

document.addEventListener("DOMContentLoaded", function () {
    const contents = document.querySelectorAll(".content");
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const contentIndex = Array.from(contents).indexOf(entry.target);
                const isEven = contentIndex % 2 === 0;
                if (isEven) {
                    entry.target.classList.add("slide-in-left");
                } else {
                    entry.target.classList.add("slide-in-right");
                }
            }
        });
    });

    contents.forEach(content => {
        observer.observe(content);
    });
});


document.addEventListener("DOMContentLoaded", function () {
    const images = document.querySelectorAll("#image");
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("fade-in");
                entry.target.style.opacity = 1;
                entry.target.style.transform = "scale(1)";
            }
        });
    });

    images.forEach(image => {
        observer.observe(image);
    });
});


document.addEventListener("DOMContentLoaded", function () {
    const contents = document.querySelectorAll(".content");
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const contentIndex = Array.from(contents).indexOf(entry.target);
                if (contentIndex % 2 === 0) {
                    entry.target.classList.add("slide-in-left"); // Even-indexed elements slide in from the left
                } else {
                    entry.target.classList.add("slide-in-right"); // Odd-indexed elements slide in from the right
                }
                // Stop observing the element once the animation class is added
                observer.unobserve(entry.target);
            }
        });
    });

    contents.forEach(content => {
        observer.observe(content);
    });
});
