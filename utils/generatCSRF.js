// // Gather the values


// const generateCSRF = () => {

// }
// const secret = process.env.CSRF_SECRET; // HMAC secret key
// const sessionID = session.sessionID; // Current authenticated user session
// randomValue = cryptographic.randomValue(); // Cryptographic random value

// // Create the CSRF Token
// message = sessionID + "!" + randomValue; // HMAC message payload
// hmac = hmac("SHA256", secret, message); // Generate the HMAC hash
// csrfToken = hmac + "." + message; // Combine HMAC hash with message to generate the token. The plain message is required to later authenticate it against its HMAC hash
