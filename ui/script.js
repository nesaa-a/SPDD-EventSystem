const EVENT_URL = "http://127.0.0.1:5000/events";
const STATS_URL = "http://127.0.0.1:5001/stats";

async function createEvent() {
    const responseElement = document.getElementById("response");
    
    try {
        // Clear previous response
        responseElement.innerText = "Creating event...";
        responseElement.style.color = "blue";

        const event = {
            title: document.getElementById("title").value,
            author: document.getElementById("author").value,
            location: document.getElementById("location").value,
            event_date: document.getElementById("event_date").value,
            description: document.getElementById("description").value
        };

        // Validate required fields
        if (!event.title || !event.author || !event.location || !event.event_date) {
            responseElement.innerText = "Error: Please fill in all required fields (Title, Author, Location, Date)";
            responseElement.style.color = "red";
            return;
        }

        const res = await fetch(EVENT_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(event)
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        responseElement.innerText = "Success! " + JSON.stringify(data, null, 2);
        responseElement.style.color = "green";

        // Clear form after successful creation
        document.getElementById("title").value = "";
        document.getElementById("author").value = "";
        document.getElementById("location").value = "";
        document.getElementById("event_date").value = "";
        document.getElementById("description").value = "";

    } catch (error) {
        responseElement.innerText = "Error: " + error.message + "\n\nMake sure the event service is running on http://127.0.0.1:5000";
        responseElement.style.color = "red";
        console.error("Error creating event:", error);
    }
}

async function loadStats() {
    const statsBox = document.getElementById("statsBox");
    
    try {
        statsBox.innerText = "Loading stats...";
        
        const res = await fetch(STATS_URL);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        statsBox.innerText = JSON.stringify(data, null, 2);
    } catch (error) {
        statsBox.innerText = "Error: " + error.message + "\n\nMake sure the analytics service is running on http://127.0.0.1:5001";
        console.error("Error loading stats:", error);
    }
}
