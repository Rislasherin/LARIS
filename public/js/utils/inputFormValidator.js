function inputfieldValidator(type, value, pattern, error, message) {
    if (value === "") {
      error.style.display = "block";
      error.innerHTML = `Please enter a valid ${type}`;
    } else if (!pattern.test(value)) {
      error.style.display = "block";
      error.innerHTML = message
    } else {
      error.style.display = "none";
      error.innerHTML = "";
    }
  }