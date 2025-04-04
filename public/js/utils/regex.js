const regex = {
    name: /^[A-Z][a-z\s]*$/,
    email: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
    phone: /^[1-9]\d{9}$/,
    capitalLetter: /(?=.*[A-Z])/,
    digit: /(?=.*\d)/,
}