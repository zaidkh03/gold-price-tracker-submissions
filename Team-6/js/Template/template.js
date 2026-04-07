fetchdata();

function fetchdata() {
    fetch('/html/Template/header.html')
    .then(response => {
        if (!response.ok) throw new Error("Header not found!");
        return response.text();
    })
    .then(data => {
        // Inject the HTML
        document.getElementById('header-placeholder').innerHTML = data;
        const showDiv = document.getElementById("show");
        const showDiv_resp = document.getElementById("login_resp"); 
        const logoutWrapper = document.getElementById("logout_wrapper");
        const logoutBtn = document.getElementById("logout"); 
        const logout_resp = document.getElementById("logout_resp"); 

        if (showDiv && logoutWrapper) {
            // Check Login Status
            if (localStorage.getItem("isLoggedIn") === "true") {
                showDiv.style.display = "none"; 
                showDiv_resp.style.display = "none"; 
                
                logoutWrapper.style.display = "block"; 
                logout_resp.style.display = "block";
            } else {
                showDiv.style.display = "flex"; 
                showDiv_resp.style.display = "flex"; 
                
                logoutWrapper.style.display = "none";
                logout_resp.style.display = "none";
            }

            // Click Events
            logoutBtn.addEventListener("click", () => {
                localStorage.setItem("isLoggedIn", "false");
                localStorage.setItem("currentUser", "");
                window.location.href = '/index.html'; 
            });

            if (logout_resp) {
                logout_resp.addEventListener("click", () => {
                    localStorage.setItem("isLoggedIn", "false");
                    localStorage.setItem("currentUser", "");
                    window.location.href = '/index.html';
                });
            }
        }
    })
    .catch(error => console.error("Header Error:", error));

    // 2. Fetch Footer
    fetch('/html/Template/footer.html')
    .then(response => {
        if (!response.ok) throw new Error("Footer not found!");
        return response.text();
    })
    .then(data => {
        document.getElementById('footer-placeholder').innerHTML = data;
    })
    .catch(error => console.error("Footer Error:", error));
}

// Sidebar functions
function show_side(){
    const side = document.getElementById("side");
    side.style.display = "flex";
    document.getElementById("menu").style.display = "none";
}

function close_side(){
    const side = document.getElementById("side");
    side.style.display = "none";
    document.getElementById("menu").style.display = "block";
}

window.addEventListener("scroll", () => {
    const header = document.getElementById("header-placeholder");
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    }
});