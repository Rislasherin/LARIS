// User signup
async function signup(event) {
    event.preventDefault();

    // From event
    // const formData = new FormData(event.target)
    // const name = formData.get('name')
    // console.log(name);

    // From form by id
    const form = document.getElementById("signForm");

    const name = form[0].value;
    const email = form[1].value;
    const phone = form[2].value;
    const password = form[3].value;
    const confirmPassword = form[4].value;

    // Errors
    const error1 = document.getElementById("error1");
    const error2 = document.getElementById("error2");
    const error3 = document.getElementById("error3");
    const error4 = document.getElementById("error4");
    const error5 = document.getElementById("error5");

    // Vaidates input fields

    // Name
    inputfieldValidator(
        "name",
        name,
        regex.name,
        error1,
        "Name must start with a capital letter and contain only alphabets and spaces"
    );

    // Email
    inputfieldValidator(
        "email",
        email,
        regex.email,
        error2,
        "Invalid email format"
    );

    // phone
    inputfieldValidator(
        "phone number",
        phone,
        regex.phone,
        error3,
        "Invalid phone number"
    );

    // password - alphabets
    inputfieldValidator(
        "password",
        password,
        regex.capitalLetter,
        error4,
        "Password should contain atleast one capital letter"
    );

    // password - digit
    inputfieldValidator(
        "password",
        password,
        regex.digit,
        error4,
        "Password should contain atleast one digit"
    );

    // Confirm password
    if (password !== confirmPassword) {
        error5.style.display = "block";
        error5.innerHTML = "Passwords do not match";
    } else {
        error5.style.display = "none";
        error5.innerHTML = "";
    }

    // Is error exist
    let arr = [error1, error2, error3, error4, error5]
    for(let i=0;i<arr.length;i++){
        if(arr[i].innerHTML !== ""){
            return;
        }
    }
    
    const obj = {
        name,
        email,
        phone,
        password,
        confirmPassword
    }

    // Fetch 
   try{
    const resp = await fetch('/signup' , {
        method : 'POST',
        headers : {
            'Content-Type' : 'application/json'
        },
        body : JSON.stringify(obj)
    });

    const data = await resp.json()

    console.log(data)

    console.log(resp)

    if(resp.ok){
       window.location.href = '/verifyOtp'
    }else{
        console.log(data)
        if(data.type === 'email'){
            error2.style.display = 'block'
            error2.innerHTML = data.msg;
        }else if(data.type === 'confirmPassword'){
            error5.style.display = 'block'
            error5.innerHTML = data.msg;
        }else{
            alert(data.msg)
        }
    }

   }catch(err){
    console.log(err)
    alert(err)
   }
}


// Password visibility
function visibility() {
    const input1 = document.getElementById('password1')
    const input2 = document.getElementById('password2')
    const icon = document.getElementById('visibility')

    if (icon.innerHTML === 'visibility') {
        icon.innerHTML = 'visibility_off'
        input1.setAttribute('type', 'password')
        input2.setAttribute('type', 'password')
    } else {
        icon.innerHTML = 'visibility'
        input1.setAttribute('type', 'text')
        input2.setAttribute('type', 'text')
    }
}