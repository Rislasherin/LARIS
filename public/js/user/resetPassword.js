$(document).ready(function() {
    // Toggle password visibility
    $('.fa-eye-slash').click(function() {
        const input = $(this).closest('.relative').find('input');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            $(this).removeClass('fa-eye-slash').addClass('fa-eye');
        } else {
            input.attr('type', 'password');
            $(this).removeClass('fa-eye').addClass('fa-eye-slash');
        }
    });
});

async function resetPassword(event) {
    event.preventDefault(); 

    const form = document.getElementById("resetForm"); 
    let newPassword = document.getElementById("newPassword").value;
    let confirmPassword = document.getElementById("confirmPassword").value;
    let passwordError1 = document.getElementById("passwordError1");
    let passwordError2 = document.getElementById("passwordError2");

    if (passwordError1) {
        passwordError1.textContent = "";
        passwordError1.style.display = "none";
    }
    if (passwordError2) {
        passwordError2.textContent = "";
        passwordError2.style.display = "none";
    }
    

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
        if (passwordError1){

        passwordError1.textContent = "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.";
        passwordError1.style.display = "block";
    }
        return;
        
    }

    if (newPassword !== confirmPassword) {
        if (passwordError2) {
            passwordError2.textContent = "Passwords do not match.";
            passwordError2.style.display = "block";
        }
        return;
        
    }

    const obj = { password: newPassword, confirmPassword: confirmPassword };

    try {
        const res = await fetch("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(obj)
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire("Success", "Password reset successfully!", "success").then(() => {
                window.location.href = "/login"; 
            })
        } else {
            if (data.type === "msg1") {
                Swal.fire("Error", "Session expired. Please restart the process.", "error");
            } else if (data.type === "msg2") {
                if (passwordError1) {
                    passwordError1.textContent = "Both password fields are required.";
                    passwordError1.style.display = "block";
                }
            } else if (data.type === "msg3") {
                if (passwordError2) {
                    passwordError2.textContent = "Passwords do not match.";
                    passwordError2.style.display = "block";
                }
            } else if (data.type === "msg4") {
                if (passwordError1) {
                    passwordError1.textContent = "Invalid password format.";
                    passwordError1.style.display = "block";
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
        Swal.fire("Error", "Failed to reset password. Try again later.", "error");
    }
}