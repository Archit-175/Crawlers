
 const fileMapping = {
    'India': '/Country/India Forest/india.html',
    

};

const availableKeywords = Object.keys(fileMapping);
const resultsBox = document.querySelector(".result-box");
const inputBox = document.getElementById("input-box");
const searchButton = document.getElementById("search-button");

inputBox.onkeyup = function() {
    let result = [];
    let input = inputBox.value.trim();
    if (input.length) {
        result = availableKeywords.filter((keyword) => {
            return keyword.toLowerCase().includes(input.toLowerCase());
        });
    }
    display(result);

    if (!result.length) {
        resultsBox.innerHTML = '';
    }
}

function display(result) {
    const content = result.map((list) => {
        return `<li onclick="selectInput(this)">${list}</li>`;
    }).join('');

    resultsBox.innerHTML = `<ul>${content}</ul>`;
}
function selectInput(list) {
    inputBox.value = list.innerHTML;
    resultsBox.innerHTML = '';
}

function handleSearch() {
    const input = inputBox.value.trim();
    const lowercaseInput = input.toLowerCase();
    
    const matchingKey = Object.keys(fileMapping).find(key => key.toLowerCase() === lowercaseInput);
    
    if (matchingKey) {
        window.location.href = fileMapping[matchingKey];
    } else {
        console.log("No matching page found for " + input);
        // You can replace this with a more user-friendly feedback mechanism
        alert("No matching page found for " + input);
    }
}

searchButton.addEventListener("click", handleSearch);

inputBox.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
    }
});