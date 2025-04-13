async function signup(event) {
    event.preventDefault();

    const form = document.getElementById("signForm");
    const name = form[0].value;
    const email = form[1].value;
    const phone = form[2].value;
    const referralCode = form[3].value; // New field
    const password = form[4].value;
    const confirmPassword = form[5].value;

    // Errors
    const error1 = document.getElementById("error1");
    const error2 = document.getElementById("error2");
    const error3 = document.getElementById("error3");
    const error4 = document.getElementById("error4");
    const error5 = document.getElementById("error5");
    const error6 = document.getElementById("error6");

    // Validate input fields
    inputfieldValidator(
        "name",
        name,
        regex.name,
        error1,
        'Name must start with a capital letter'
    );

    inputfieldValidator(
        "email",
        email,
        regex.email,
        error2,
        "Invalid email format"
    );

    inputfieldValidator(
        "phone number",
        phone,
        regex.phone,
        error3,
        "Invalid phone number"
    );

    inputfieldValidator(
        "password",
        password,
        regex.capitalLetter,
        error4,
        "Password should contain at least one capital letter"
    );

    inputfieldValidator(
        "password",
        password,
        regex.digit,
        error4,
        "Password should contain at least one digit"
    );

    if (password !== confirmPassword) {
        error5.style.display = "block";
        error5.innerHTML = "Passwords do not match";
    } else {
        error5.style.display = "none";
        error5.innerHTML = "";
    }

    // Check for any errors
    const errors = [error1, error2, error3, error4, error5, error6];
    for (let error of errors) {
        if (error.innerHTML !== "") {
            return;
        }
    }

    const obj = {
        name,
        email,
        phone,
        referralCode, // Include referral code
        password,
        confirmPassword
    };

    try {
        const resp = await fetch('/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(obj)
        });

        const data = await resp.json();

        if (resp.ok) {
            window.location.href = '/verifyOtp';
        } else {
            if (data.type === 'email') {
                error2.style.display = 'block';
                error2.innerHTML = data.msg;
            } else if (data.type === 'confirmPassword') {
                error5.style.display = 'block';
                error5.innerHTML = data.msg;
            } else if (data.type === 'referralCode') {
                error6.style.display = 'block';
                error6.innerHTML = data.msg;
            } else {
                alert(data.msg);
            }
        }
    } catch (err) {
        console.error(err);
        alert('An error occurred during signup');
    }
}