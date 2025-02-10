import fetch from 'node-fetch';

const numbers = ["+12345678901",]

// Remove duplicates from the numbers array
const uniqueNumbers = [...new Set(numbers)];

const message = `Salam! Ty! 💃🏻🪩`;

const data = {
    phone_numbers: uniqueNumbers,
    messages: [message]
};

console.log(`Sending message to ${uniqueNumbers.length} unique numbers...`);

fetch('http://localhost:5001/sendBulkMessages', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ''
    },
    body: JSON.stringify(data)
})
    .then(response => response.json())
    .then(data => console.log('Success:', data))
    .catch((error) => console.error('Error:', error));