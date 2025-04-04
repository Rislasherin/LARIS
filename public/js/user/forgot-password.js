async function forgotPassword(event){
    event.preventDefault();
    console.log("Forgot Password function triggered");

    const form = document.getElementById('forgotForm')

    const email = form.email.value;

    const error1 = document.getElementById("email-error");

    inputfieldValidator(
        'email address',
        email,
        regex.email,
        error1,
        "Invalid email format"
        
    )
    if(error1.innerHTML !== ''){
        console.log("Validation failed: ", error1.innerHTML);
        return
    }

    const obj = {email}

    try {
        console.log("Sending request to server..."); 
        const res = await fetch('/forgot-email-valid',{
            method : 'POSt',
            headers:{
                'Content-Type':'application/json' 
            },
            body: JSON.stringify(obj)
        })
        const data = await res.json()
        console.log("Response received:", data); 

        if(res.ok){
            console.log("Navigating to OTP page...");
            window.location.href = data.redirect || '/forgot-verfy-Otp'
        }else{
            console.log("Error response:", data);
            if (['email1', 'email2', 'email3', 'email4'].includes(data.type)) {
                error1.style.display = 'block';
                error1.innerHTML = data.message;
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Empty Fields',
                    text: 'something went wrong',
                    toast: true,
                    position: 'top-end',
                    timer: 3000
                });
                return;
            }
        }
    } catch (error) {
    console.log(error)
    alert(error)
    } 
}
