 const fileMapping = {
            'India': '/Country/India Forest/india.html',
            'Russia': '/Country/Russia Forest/Russia.html',
            'Canada': '/Country/Canada Forest/Canada.html',
            'Brazil': '/Country/Brazil Forest/Brazil.html',
            'USA': '/Country/USA forest/USA.html',
            'China': '/Country/China Forest/China.html',
            'Australia': '/Country/Australia forest/Australia.html',
            'Jim Corbett NP': '/Country/India Forest/Forests/Corbett.html ',
            'Deccan forests': '/Country/India Forest/Forests/Deccan-forest.html ',
            'Kaziranga National Park': '/Country/India Forest/Forests/Corbett.html ',
            'Sundarbans': '/Country/India Forest/Forests/Sundarbun.html ',
            'Western Ghats': '/Country/India Forest/Forests/Westerm_Ghats.html ',
            'Daintree forest': '/Country/Australia Forest/Forests/Daintree.html ',
            'Gondwana forest': '/Country/Australia Forest/Forests/Gondwana.html ',
            'Otway forest': '/Country/Australia Forest/Forests/otway.html ',
            'Tasmania': '/Country/Australia Forest/Forests/tasmania.html ',
            'Amazon forests': '/Country/Brazil Forest/forest/Amazon forests.html ',
            'Cachoeria da Neblina': '/Country/Brazil Forest/forest/Cachoeria-da-Neblina.html ',
            'Floresta da Tijuka': '/Country/Brazil Forest/forest/floresta-da-tijuka.html ',
            'Parque de Sinopa': '/Country/Brazil Forest/forest/Parque-de-Sinopa.html ',
            'Acadian Forest': '/Country/Canada Forest/forest/Acadian.html ',
            'Boreal Forest': '/Country/Canada Forest/forest/Boreal.html ',
            'Columbia Forest': '/Country/Canada Forest/forest/Columbia.html ',
            'Lakes': '/Country/Canada Forest/forest/Lakes.html ',
            'Montane forest': '/Country/Canada Forest/forest/Montane.html ',
            'Broad Leaf Forest': '/Country/China Forest/forest/Broad-leaf-forest.html',
            'Changbai Mountain forest': '/Country/China Forest/forest/Changbai-mountain-mixed-forest.html',
            'Sichuan subtropical forest': '/Country/China Forest/forest/Sichuan-subtropical-forest.html',
            'Tibetian Forest': '/Country/China Forest/forest/Tibetian-plateau-forest.html',
            'Caucasus Forest': '/Country/Russia Forest/Forest/Caucasus.html',
            'Sayan Mountain Forests': '/Country/Russia Forest/Forest/Sayan-Mountains-Forests-Russia.html',
            'Taiga Boreal Forests': '/Country/Russia Forest/Forest/Taiga-Boreal.html',
            'Everglade Forest': '/Country/USA forest/Forest/Everglade.html',
            'Olympic National Forest': '/Country/USA forest/Forest/Olympic_Nationalpark.html',
            'Smoky Mountain Forests': '/Country/USA forest/Forest/SmokyMountain.html',
            'Tonagass National Park': '/Country/USA forest/Forest/Tongass_Nationalpark.html'
        };

        const availableKeywords = Object.keys(fileMapping);
        const resultsBox = document.querySelector(".result-box");
        const inputBox = document.getElementById("input-box");
        const searchButton = document.getElementById("search-button");

        let selectedIndex = -1;

        inputBox.onkeyup = function(e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                return;
            }

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
        };

        inputBox.addEventListener("keydown", function(event) {
            const items = resultsBox.querySelectorAll("li");

            if (event.key === "ArrowDown") {
                if (selectedIndex < items.length - 1) {
                    selectedIndex++;
                    updateSelection(items);
                }
            } else if (event.key === "ArrowUp") {
                if (selectedIndex > 0) {
                    selectedIndex--;
                    updateSelection(items);
                }
            } else if (event.key === "Enter") {
                event.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    inputBox.value = items[selectedIndex].innerHTML;
                    resultsBox.innerHTML = '';
                }
                handleSearch();
            }
        });

        function updateSelection(items) {
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add("selected");
                    inputBox.value = item.innerHTML;
                } else {
                    item.classList.remove("selected");
                }
            });
        }

        function display(result) {
            selectedIndex = -1; // Reset selected index
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
                alert("No matching page found for " + input);
            }
        }

        searchButton.addEventListener("click", handleSearch);
