
 const fileMapping = {
    'India': '/Country/India Forest/india.html',
    'Russia': '/Country/Russia Forest/Russia.html',
    'Canada': '/Country/Canada Forest/Canada.html',
    'Brazil': '/Country/Brazil Forest/Brazil.html',
    'USA': '/Country/USA Forest/USA.html',
    'China': '/Country/China Forest/China.html',
    'Australia': '/Country/India Forest/Australia.html',
    'Jim Corbett NP': '/Country/India Forest/Forests/Corbett.html ',
    'Deccan forests':  '/Country/India Forest/Forests/Deccan-forest.html ',
    'Kaziranga National Park' :  '/Country/India Forest/Forests/Corbett.html ',
    'Sundarbans' : '/Country/India Forest/Forests/Sundarbun.html ',
    'Western Ghats' :  '/Country/India Forest/Forests/Westerm_Ghats.html ',
    'Daintree forest':  '/Country/Australia Forest/Forests/Daintree.html ',
    'Gondwana forest': '/Country/Australia Forest/Forests/Gondwana.html ',
    'Otway forest' : '/Country/Australia Forest/Forests/otway.html ',
    'Tasmania' : '/Country/Australia Forest/Forests/tasmania.html ',
    'Amazon forests' : '/Country/Brazil Forest/forest/Amazon forests.html ',
    'Cachoeria da Neblina ' : '/Country/Brazil Forest/forest/Cachoeria-da-Neblina.html ',
    'Floresta da Tijuka' : '/Country/Brazil Forest/forest/floresta-da-tijuka.html ',
    'Parque de Sinopa' : '/Country/Brazil Forest/forest/Parque-de-Sinopa.html ',
    'Acadian Forest' : '/Country/Canada Forest/forest/Acadian.html ',
    'Boreal Forest' : '/Country/Canada Forest/forest/Boreal.html ',
    'Columbia Forest': '/Country/Canada Forest/forest/Columbia.html ',
    'Lakes' : '/Country/Canada Forest/forest/Lakes.html ',
    'Montane forest' : '/Country/Canada Forest/forest/Montane.html ',
  

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
